package infrastructure

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hivepos/api/internal/modules/services/application"
	"github.com/hivepos/api/internal/modules/services/domain"
)

type PgServiceRepository struct {
	db *sql.DB
}

func NewPgServiceRepository(db *sql.DB) *PgServiceRepository {
	return &PgServiceRepository{db: db}
}

// serviceColumns lists Service columns fully qualified with the "s." alias so a
// JOIN to "Branch" (which also has a "name" column) does not raise an ambiguous
// column reference. Callers compose the SELECT as `SELECT <cols> FROM "Service" s ...`.
const serviceColumns = `s.id, s.name, s.description, s."pricingType", s."basePrice"::float, s."commissionType", s."commissionValue"::float, s.module, s."isActive", s."isDefaultSpeed", s."branchId", s."groupId", s."createdAt", s."updatedAt"`

func scanService(row interface{}, s *domain.Service) error {
	type scanner interface {
		Scan(dest ...interface{}) error
	}
	sc, ok := row.(scanner)
	if !ok {
		return fmt.Errorf("scanService: unsupported row type")
	}
	return sc.Scan(
		&s.ID, &s.Name, &s.Description, &s.PricingType, &s.BasePrice,
		&s.CommissionType, &s.CommissionValue, &s.Module, &s.IsActive,
		&s.IsDefaultSpeed, &s.BranchID, &s.GroupID, &s.CreatedAt, &s.UpdatedAt,
	)
}

func (r *PgServiceRepository) Create(ctx context.Context, s *domain.Service) error {
	var groupVal interface{}
	if s.GroupID != nil {
		groupVal = s.GroupID
	}
	var descVal interface{}
	if s.Description != nil {
		descVal = s.Description
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "Service" (id, name, description, "pricingType", "basePrice", "commissionType", "commissionValue", module, "isActive", "isDefaultSpeed", "branchId", "groupId", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
		RETURNING id, "createdAt", "updatedAt"`,
		s.Name, descVal, s.PricingType, s.BasePrice, s.CommissionType, s.CommissionValue,
		s.Module, s.IsActive, s.IsDefaultSpeed, s.BranchID, groupVal,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *PgServiceRepository) FindByID(ctx context.Context, id, tenantID string) (*domain.Service, error) {
	s := &domain.Service{}
	err := r.db.QueryRowContext(ctx, `
		SELECT `+serviceColumns+`
		FROM "Service" s
		JOIN "Branch" b ON b.id = s."branchId"
		WHERE s.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(
		&s.ID, &s.Name, &s.Description, &s.PricingType, &s.BasePrice,
		&s.CommissionType, &s.CommissionValue, &s.Module, &s.IsActive,
		&s.IsDefaultSpeed, &s.BranchID, &s.GroupID, &s.CreatedAt, &s.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding service: %w", err)
	}
	return s, nil
}

func (r *PgServiceRepository) List(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.Service, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND s."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.Module != "" {
		where += fmt.Sprintf(` AND s.module = $%d`, idx)
		args = append(args, filter.Module)
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
	if filter.GroupID != "" {
		where += fmt.Sprintf(` AND s."groupId" = $%d`, idx)
		args = append(args, filter.GroupID)
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Service" s JOIN "Branch" b ON b.id = s."branchId" `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting services: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT %s
		FROM "Service" s JOIN "Branch" b ON b.id = s."branchId"
		%s ORDER BY s."createdAt" DESC`, serviceColumns, where)
	if !filter.All {
		query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying services: %w", err)
	}
	defer rows.Close()

	var list []*domain.Service
	for rows.Next() {
		s := &domain.Service{}
		if err := scanService(rows, s); err != nil {
			return nil, 0, err
		}
		list = append(list, s)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating services: %w", err)
	}
	return list, total, nil
}

// ListItems returns the curated ServiceListItem DTO with nested group (matches
// TS /api/services). Shares List's WHERE build.
func (r *PgServiceRepository) ListItems(ctx context.Context, tenantID string, filter application.ListFilter) ([]*application.ServiceListItem, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND s."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.Module != "" {
		where += fmt.Sprintf(` AND s.module = $%d`, idx)
		args = append(args, filter.Module)
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
	if filter.GroupID != "" {
		where += fmt.Sprintf(` AND s."groupId" = $%d`, idx)
		args = append(args, filter.GroupID)
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Service" s JOIN "Branch" b ON b.id = s."branchId" `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting services: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT s.id, s.name, s.description, s."pricingType", s."basePrice"::float, s."commissionType",
		       s."commissionValue"::float, s.module, s."isActive", s."isDefaultSpeed", s."groupId",
		       s."createdAt", s."updatedAt", sg.id, sg.name
		FROM "Service" s JOIN "Branch" b ON b.id = s."branchId"
		LEFT JOIN "ServiceGroup" sg ON sg.id = s."groupId"
		%s ORDER BY s."createdAt" DESC`, where)
	if !filter.All {
		query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying service items: %w", err)
	}
	defer rows.Close()

	var out []*application.ServiceListItem
	for rows.Next() {
		it := &application.ServiceListItem{}
		var groupID, sgID, sgName sql.NullString
		if err := rows.Scan(
			&it.ID, &it.Name, &it.Description, &it.PricingType, &it.BasePrice, &it.CommissionType,
			&it.CommissionValue, &it.Module, &it.IsActive, &it.IsDefaultSpeed, &groupID,
			&it.CreatedAt, &it.UpdatedAt, &sgID, &sgName,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning service item: %w", err)
		}
		if groupID.Valid {
			g := groupID.String
			it.GroupID = &g
		}
		if sgID.Valid {
			it.Group = &application.ServiceGroupRef{ID: sgID.String, Name: sgName.String}
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating service items: %w", err)
	}
	return out, total, nil
}

func (r *PgServiceRepository) Update(ctx context.Context, s *domain.Service) error {
	var groupVal interface{}
	if s.GroupID != nil {
		groupVal = s.GroupID
	}
	var descVal interface{}
	if s.Description != nil {
		descVal = s.Description
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Service" SET name=$1, description=$2, "pricingType"=$3, "basePrice"=$4,
		"commissionType"=$5, "commissionValue"=$6, module=$7, "isActive"=$8,
		"isDefaultSpeed"=$9, "groupId"=$10, "updatedAt"=NOW() WHERE id=$11`,
		s.Name, descVal, s.PricingType, s.BasePrice, s.CommissionType,
		s.CommissionValue, s.Module, s.IsActive, s.IsDefaultSpeed, groupVal, s.ID)
	return err
}

func (r *PgServiceRepository) Delete(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "Service" s USING "Branch" b WHERE s.id=$1 AND b.id=s."branchId" AND b."tenantId"=$2`, id, tenantID)
	return err
}

// CountUsage reports how many OrderItems reference the service (tenant-scoped). Used by the
// service layer to block delete with a clear 409 instead of a raw FK-violation 500.
// ponytail: pre-check only — admin op, low concurrency; a racing insert would still surface as
// the original FK 500, acceptable.
func (r *PgServiceRepository) CountUsage(ctx context.Context, id, tenantID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM "OrderItem" oi
		JOIN "Order" o ON o.id = oi."orderId"
		JOIN "Branch" b ON b.id = o."branchId"
		WHERE oi."serviceId" = $1 AND b."tenantId" = $2`, id, tenantID).Scan(&n)
	return n, err
}

// --- ServiceGroup ---

// groupColumns lists ServiceGroup columns qualified with the "g." alias (the
// joined "Branch" also exposes "name", so all refs must be qualified).
const groupColumns = `g.id, g.name, g.description, g."sortOrder", g.module, g."branchId", g."createdAt", g."updatedAt"`

func (r *PgServiceRepository) CreateGroup(ctx context.Context, g *domain.ServiceGroup) error {
	var descVal interface{}
	if g.Description != nil {
		descVal = g.Description
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "ServiceGroup" (id, name, description, "sortOrder", module, "branchId", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id, "createdAt", "updatedAt"`,
		g.Name, descVal, g.SortOrder, g.Module, g.BranchID,
	).Scan(&g.ID, &g.CreatedAt, &g.UpdatedAt)
}

func (r *PgServiceRepository) FindGroupByID(ctx context.Context, id, tenantID string) (*domain.ServiceGroup, error) {
	g := &domain.ServiceGroup{}
	err := r.db.QueryRowContext(ctx, `
		SELECT `+groupColumns+`
		FROM "ServiceGroup" g
		JOIN "Branch" b ON b.id = g."branchId"
		WHERE g.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&g.ID, &g.Name, &g.Description, &g.SortOrder, &g.Module, &g.BranchID, &g.CreatedAt, &g.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding service group: %w", err)
	}
	return g, nil
}

func (r *PgServiceRepository) ListGroups(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.ServiceGroup, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND g."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.Module != "" {
		where += fmt.Sprintf(` AND g.module = $%d`, idx)
		args = append(args, filter.Module)
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "ServiceGroup" g JOIN "Branch" b ON b.id = g."branchId" `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting service groups: %w", err)
	}

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT %s
		FROM "ServiceGroup" g JOIN "Branch" b ON b.id = g."branchId"
		%s ORDER BY g."sortOrder" ASC, g."createdAt" DESC LIMIT $%d OFFSET $%d`, groupColumns, where, idx, idx+1)
	args = append(args, filter.Limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying service groups: %w", err)
	}
	defer rows.Close()

	var list []*domain.ServiceGroup
	for rows.Next() {
		g := &domain.ServiceGroup{}
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.SortOrder, &g.Module, &g.BranchID, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, g)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating service groups: %w", err)
	}
	return list, total, nil
}

func (r *PgServiceRepository) UpdateGroup(ctx context.Context, g *domain.ServiceGroup) error {
	var descVal interface{}
	if g.Description != nil {
		descVal = g.Description
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE "ServiceGroup" SET name=$1, description=$2, "sortOrder"=$3, module=$4, "updatedAt"=NOW() WHERE id=$5`,
		g.Name, descVal, g.SortOrder, g.Module, g.ID)
	return err
}

func (r *PgServiceRepository) DeleteGroup(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "ServiceGroup" g USING "Branch" b WHERE g.id=$1 AND b.id=g."branchId" AND b."tenantId"=$2`, id, tenantID)
	return err
}
