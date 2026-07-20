package infrastructure

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hivepos/api/internal/modules/pickup/application"
	"github.com/hivepos/api/internal/modules/pickup/domain"
)

type PgPickupRepository struct {
	db *sql.DB
}

func NewPgPickupRepository(db *sql.DB) *PgPickupRepository {
	return &PgPickupRepository{db: db}
}

// scanPickup maps a row into a PickupRequest, handling nullable fields.
func scanPickup(scanner interface{ Scan(...interface{}) error }, p *domain.PickupRequest) error {
	return scanner.Scan(
		&p.ID, &p.TenantID, &p.BranchID, &p.Status, &p.CustomerName, &p.CustomerPhone,
		&p.Address, &p.RequestedDate, &p.RequestedSlot, &p.Notes, &p.ConvertedOrderID,
		&p.CreatedAt, &p.UpdatedAt,
	)
}

const pickupColumns = `id, "tenantId", "branchId", status, "customerName", "customerPhone",
	"addressText", "requestedDate", "requestedSlot", notes, "convertedOrderId", "createdAt", "updatedAt"`

func (r *PgPickupRepository) Create(ctx context.Context, p *domain.PickupRequest) error {
	// requestedDate is sent as a string from the client; store as timestamp if present.
	var requestedDate interface{}
	if p.RequestedDate != nil {
		requestedDate = *p.RequestedDate
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "PickupRequest" (id, "tenantId", "branchId", status, "customerName",
			"customerPhone", "customerId", "addressText", "requestedDate", "requestedSlot", notes, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
		RETURNING id, "createdAt", "updatedAt"`,
		p.TenantID, p.BranchID, p.Status, p.CustomerName,
		p.CustomerPhone, p.CustomerID, p.Address, requestedDate, p.RequestedSlot, p.Notes,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PgPickupRepository) FindByID(ctx context.Context, id, tenantID string) (*domain.PickupRequest, error) {
	p := &domain.PickupRequest{}
	err := r.db.QueryRowContext(ctx, fmt.Sprintf(`
		SELECT %s FROM "PickupRequest" WHERE id = $1 AND "tenantId" = $2`, pickupColumns), id, tenantID,
	).Scan(
		&p.ID, &p.TenantID, &p.BranchID, &p.Status, &p.CustomerName, &p.CustomerPhone,
		&p.Address, &p.RequestedDate, &p.RequestedSlot, &p.Notes, &p.ConvertedOrderID,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding pickup request: %w", err)
	}
	return p, nil
}

func (r *PgPickupRepository) List(ctx context.Context, tenantID string, f application.ListFilter) ([]*domain.PickupRequest, int64, error) {
	where := `WHERE p."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if f.BranchID != "" && f.BranchID != "ALL" {
		where += fmt.Sprintf(` AND p."branchId" = $%d`, idx)
		args = append(args, f.BranchID)
		idx++
	}
	if f.Status != "" {
		where += fmt.Sprintf(` AND p.status = $%d`, idx)
		args = append(args, f.Status)
		idx++
	}
	if f.Search != "" {
		where += fmt.Sprintf(` AND (p."customerName" ILIKE $%d OR p."customerPhone" ILIKE $%d)`, idx, idx)
		args = append(args, "%"+f.Search+"%")
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "PickupRequest" p `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting pickup requests: %w", err)
	}

	offset := (f.Page - 1) * f.Limit
	q := fmt.Sprintf(`
		SELECT %s FROM "PickupRequest" p %s ORDER BY p."createdAt" DESC LIMIT $%d OFFSET $%d`,
		pickupColumns, where, idx, idx+1)
	args = append(args, f.Limit, offset)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying pickup requests: %w", err)
	}
	defer rows.Close()

	var list []*domain.PickupRequest
	for rows.Next() {
		p := &domain.PickupRequest{}
		if err := scanPickup(rows, p); err != nil {
			return nil, 0, fmt.Errorf("scanning pickup request: %w", err)
		}
		list = append(list, p)
	}
	return list, total, nil
}

// UpdateStatus applies a status transition and stores transition-specific fields.
// convertedOrderId is carried in TransitionInput.AssignedTo (caller convention).
func (r *PgPickupRepository) UpdateStatus(ctx context.Context, id, tenantID string, status domain.PickupStatus, inp application.TransitionInput) error {
	sets := []string{`status = $1`, `"updatedAt" = NOW()`}
	args := []interface{}{status}
	idx := 2

	if inp.ScheduledDate != nil {
		sets = append(sets, fmt.Sprintf(`"requestedDate" = $%d`, idx))
		args = append(args, *inp.ScheduledDate)
		idx++
	}
	if inp.ScheduledSlot != nil {
		sets = append(sets, fmt.Sprintf(`"requestedSlot" = $%d`, idx))
		args = append(args, *inp.ScheduledSlot)
		idx++
	}
	// assignedTo doubles as convertedOrderId for the CONVERTED transition.
	if inp.AssignedTo != nil {
		sets = append(sets, fmt.Sprintf(`"convertedOrderId" = $%d`, idx))
		args = append(args, *inp.AssignedTo)
		idx++
	}

	q := fmt.Sprintf(`UPDATE "PickupRequest" SET %s WHERE id = $%d AND "tenantId" = $%d`,
		joinComma(sets), idx, idx+1)
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("updating pickup status: %w", err)
	}
	return nil
}

func (r *PgPickupRepository) CountPending(ctx context.Context, tenantID, branchID string) (int64, error) {
	q := `SELECT COUNT(*) FROM "PickupRequest" WHERE "tenantId" = $1 AND status = 'PENDING'`
	args := []interface{}{tenantID}
	if branchID != "" && branchID != "ALL" {
		q += ` AND "branchId" = $2`
		args = append(args, branchID)
	}
	var count int64
	if err := r.db.QueryRowContext(ctx, q, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("counting pending pickup requests: %w", err)
	}
	return count, nil
}

func joinComma(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}
