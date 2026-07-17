package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/inventory/application"
	"github.com/hivepos/api/internal/modules/inventory/domain"
)

type PgStockItemRepository struct {
	db *sql.DB
}

func NewPgStockItemRepository(db *sql.DB) *PgStockItemRepository {
	return &PgStockItemRepository{db: db}
}

// stockItemColumns lists StockItem columns qualified with the "s." alias; the
// JOIN to "Branch" (which also exposes "name") would otherwise be ambiguous.
// Callers compose the SELECT as `SELECT <cols> FROM "StockItem" s ...`.
const stockItemColumns = `s.id, s.name, s.unit, s."currentQuantity"::float, s."lowStockThreshold"::float, s."purchasePricePerUnit"::float, s."isActive", s."branchId", s."createdAt", s."updatedAt"`

func (r *PgStockItemRepository) Create(ctx context.Context, s *domain.StockItem) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "StockItem" (name, unit, "currentQuantity", "lowStockThreshold", "purchasePricePerUnit", "isActive", "branchId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id, "createdAt", "updatedAt"`,
		s.Name, s.Unit, s.CurrentQuantity, s.LowStockThreshold, s.PurchasePricePerUnit, s.IsActive, s.BranchID,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *PgStockItemRepository) FindByID(ctx context.Context, id, tenantID string) (*domain.StockItem, error) {
	s := &domain.StockItem{}
	err := r.db.QueryRowContext(ctx, `
		SELECT `+stockItemColumns+`
		FROM "StockItem" s
		JOIN "Branch" b ON b.id = s."branchId"
		WHERE s.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&s.ID, &s.Name, &s.Unit, &s.CurrentQuantity, &s.LowStockThreshold, &s.PurchasePricePerUnit, &s.IsActive, &s.BranchID, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding stock item: %w", err)
	}
	return s, nil
}

func (r *PgStockItemRepository) List(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.StockItem, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND s."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND s.name ILIKE $%d`, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}
	if filter.Active != "" {
		where += fmt.Sprintf(` AND s."isActive" = $%d`, idx)
		args = append(args, filter.Active == "true")
		idx++
	}
	if filter.LowOnly == "true" {
		where += ` AND s."currentQuantity" <= s."lowStockThreshold"`
	}

	var total int64
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "StockItem" s JOIN "Branch" b ON b.id = s."branchId" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT %s
		FROM "StockItem" s JOIN "Branch" b ON b.id = s."branchId"
		%s ORDER BY s."createdAt" DESC`, stockItemColumns, where)
	if !filter.All {
		query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, filter.Limit, offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying stock items: %w", err)
	}
	defer rows.Close()

	var list []*domain.StockItem
	for rows.Next() {
		s := &domain.StockItem{}
		if err := rows.Scan(&s.ID, &s.Name, &s.Unit, &s.CurrentQuantity, &s.LowStockThreshold, &s.PurchasePricePerUnit, &s.IsActive, &s.BranchID, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, s)
	}
	return list, total, nil
}

func (r *PgStockItemRepository) Update(ctx context.Context, s *domain.StockItem) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "StockItem" SET name=$1, unit=$2, "currentQuantity"=$3, "lowStockThreshold"=$4,
		"purchasePricePerUnit"=$5, "isActive"=$6, "updatedAt"=NOW() WHERE id=$7`,
		s.Name, s.Unit, s.CurrentQuantity, s.LowStockThreshold, s.PurchasePricePerUnit, s.IsActive, s.ID)
	return err
}

func (r *PgStockItemRepository) Delete(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "StockItem" s USING "Branch" b WHERE s.id=$1 AND b.id=s."branchId" AND b."tenantId"=$2`, id, tenantID)
	return err
}

// --- StockMovements ---

func (r *PgStockItemRepository) ListMovements(ctx context.Context, stockItemID, tenantID string) ([]*domain.StockMovement, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT m.id, m."stockItemId", m.type, m.quantity::float, m.date, m.notes, m."createdAt"
		FROM "StockMovement" m
		JOIN "StockItem" s ON s.id = m."stockItemId"
		JOIN "Branch" b ON b.id = s."branchId"
		WHERE m."stockItemId" = $1 AND b."tenantId" = $2
		ORDER BY m."createdAt" DESC LIMIT 100`, stockItemID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*domain.StockMovement
	for rows.Next() {
		m := &domain.StockMovement{}
		if err := rows.Scan(&m.ID, &m.StockItemID, &m.Type, &m.Quantity, &m.Date, &m.Notes, &m.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}

// AddMovement inserts a movement and atomically adjusts the parent stock item's
// running quantity inside a single transaction. IN adds, OUT subtracts,
// ADJUSTMENT adds (caller may pass a negative quantity to reduce).
func (r *PgStockItemRepository) AddMovement(ctx context.Context, stockItemID, tenantID string, input application.CreateMovementInput) (*domain.StockMovement, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	delta := input.Quantity
	if input.Type == domain.MovementOut {
		delta = -input.Quantity
	}
	// OUT guard: block if the movement would drive quantity negative. Re-fetch inside the tx
	// (FOR UPDATE) so concurrent movements can't both pass the check.
	if input.Type == domain.MovementOut {
		var current float64
		if err := tx.QueryRowContext(ctx, `SELECT "currentQuantity"::float FROM "StockItem" WHERE id = $1 FOR UPDATE`, stockItemID).Scan(&current); err != nil {
			return nil, fmt.Errorf("locking stock item: %w", err)
		}
		if current-input.Quantity < -1e-9 {
			return nil, fmt.Errorf("insufficient stock: have %.2f, need %.2f", current, input.Quantity)
		}
	}
	_, err = tx.ExecContext(ctx, `UPDATE "StockItem" SET "currentQuantity" = "currentQuantity" + $1, "updatedAt" = NOW() WHERE id = $2`, delta, stockItemID)
	if err != nil {
		return nil, fmt.Errorf("updating stock quantity: %w", err)
	}

	m := &domain.StockMovement{StockItemID: stockItemID, Type: input.Type, Quantity: input.Quantity, Notes: input.Notes}
	var notesVal interface{}
	if input.Notes != nil {
		notesVal = input.Notes
	}
	// Honor a caller-supplied movement date (backdating); default to NOW().
	var dateVal interface{}
	if input.Date != nil && *input.Date != "" {
		if t, perr := time.Parse("2006-01-02", *input.Date); perr == nil {
			dateVal = t
		} else if t, perr := time.Parse(time.RFC3339, *input.Date); perr == nil {
			dateVal = t
		}
	}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO "StockMovement" ("stockItemId", type, quantity, date, notes, "createdAt")
		VALUES ($1, $2, $3, COALESCE($4, NOW()), $5, NOW()) RETURNING id, date, "createdAt"`,
		stockItemID, input.Type, input.Quantity, dateVal, notesVal).Scan(&m.ID, &m.Date, &m.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("inserting stock movement: %w", err)
	}

	return m, tx.Commit()
}
