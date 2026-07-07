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

const serviceColumns = `id, name, description, "pricingType", "basePrice"::float, "commissionType", "commissionValue"::float, module, "isActive", "isDefaultSpeed", "branchId", "groupId", "createdAt", "updatedAt"`

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
		INSERT INTO "Service" (name, description, "pricingType", "basePrice", "commissionType", "commissionValue", module, "isActive", "isDefaultSpeed", "branchId", "groupId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
		RETURNING id, "createdAt", "updatedAt"`,
		s.Name, descVal, s.PricingType, s.BasePrice, s.CommissionType, s.CommissionValue,
		s.Module, s.IsActive, s.IsDefaultSpeed, s.BranchID, groupVal,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *PgServiceRepository) FindByID(ctx context.Context, id, tenantID string) (*domain.Service, error) {
	s := &domain.Service{}
	err := r.db.QueryRowContext(ctx, `
		SELECT s.`+serviceColumns+`
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
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Service" s JOIN "Branch" b ON b.id = s."branchId" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT s.%s
		FROM "Service" s JOIN "Branch" b ON b.id = s."branchId"
		%s ORDER BY s."createdAt" DESC LIMIT $%d OFFSET $%d`, serviceColumns, where, idx, idx+1)
	args = append(args, filter.Limit, offset)

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
	return list, total, nil
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

// --- ServiceGroup ---

const groupColumns = `id, name, description, "sortOrder", module, "branchId", "createdAt", "updatedAt"`

func (r *PgServiceRepository) CreateGroup(ctx context.Context, g *domain.ServiceGroup) error {
	var descVal interface{}
	if g.Description != nil {
		descVal = g.Description
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "ServiceGroup" (name, description, "sortOrder", module, "branchId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id, "createdAt", "updatedAt"`,
		g.Name, descVal, g.SortOrder, g.Module, g.BranchID,
	).Scan(&g.ID, &g.CreatedAt, &g.UpdatedAt)
}

func (r *PgServiceRepository) FindGroupByID(ctx context.Context, id, tenantID string) (*domain.ServiceGroup, error) {
	g := &domain.ServiceGroup{}
	err := r.db.QueryRowContext(ctx, `
		SELECT g.`+groupColumns+`
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
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "ServiceGroup" g JOIN "Branch" b ON b.id = g."branchId" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT g.%s
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
