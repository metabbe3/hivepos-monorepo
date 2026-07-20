package infrastructure

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hivepos/api/internal/modules/expenses/application"
	"github.com/hivepos/api/internal/modules/expenses/domain"
)

type PgExpenseRepository struct {
	db *sql.DB
}

func NewPgExpenseRepository(db *sql.DB) *PgExpenseRepository {
	return &PgExpenseRepository{db: db}
}

// expenseColumns lists Expense columns qualified with the "e." alias; the JOIN
// to "Branch" (which also exposes "createdAt") would otherwise be ambiguous.
const expenseColumns = `e.id, e.amount::float, e.description, e.date, e."branchId", e."categoryId", e."createdAt"`

// --- Expenses ---

func (r *PgExpenseRepository) CreateExpense(ctx context.Context, e *domain.Expense) error {
	var descVal interface{}
	if e.Description != nil {
		descVal = e.Description
	}
	var catVal interface{}
	if e.CategoryID != nil {
		catVal = e.CategoryID
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "Expense" (id, amount, description, date, "branchId", "categoryId", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW()) RETURNING id, date, "createdAt"`,
		e.Amount, descVal, e.Date, e.BranchID, catVal,
	).Scan(&e.ID, &e.Date, &e.CreatedAt)
}

func (r *PgExpenseRepository) FindExpenseByID(ctx context.Context, id, tenantID string) (*domain.Expense, error) {
	e := &domain.Expense{}
	err := r.db.QueryRowContext(ctx, `
		SELECT `+expenseColumns+`
		FROM "Expense" e
		JOIN "Branch" b ON b.id = e."branchId"
		WHERE e.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&e.ID, &e.Amount, &e.Description, &e.Date, &e.BranchID, &e.CategoryID, &e.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding expense: %w", err)
	}
	return e, nil
}

func (r *PgExpenseRepository) ListExpenses(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.Expense, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND e."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.CategoryID != "" {
		where += fmt.Sprintf(` AND e."categoryId" = $%d`, idx)
		args = append(args, filter.CategoryID)
		idx++
	}
	if filter.From != "" {
		where += fmt.Sprintf(` AND e.date >= $%d::timestamptz`, idx)
		args = append(args, filter.From)
		idx++
	}
	if filter.To != "" {
		where += fmt.Sprintf(` AND e.date <= $%d::timestamptz`, idx)
		args = append(args, filter.To)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND e.description ILIKE $%d`, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Expense" e JOIN "Branch" b ON b.id = e."branchId" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT %s, ec.id, ec.name, ec.description
		FROM "Expense" e JOIN "Branch" b ON b.id = e."branchId"
		LEFT JOIN "ExpenseCategory" ec ON ec.id = e."categoryId"
		%s ORDER BY e.date DESC, e."createdAt" DESC`, expenseColumns, where)
	if !filter.All {
		query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, filter.Limit, offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying expenses: %w", err)
	}
	defer rows.Close()

	var list []*domain.Expense
	for rows.Next() {
		e := &domain.Expense{}
		var ecID, ecName, ecDesc sql.NullString
		if err := rows.Scan(&e.ID, &e.Amount, &e.Description, &e.Date, &e.BranchID, &e.CategoryID, &e.CreatedAt, &ecID, &ecName, &ecDesc); err != nil {
			return nil, 0, err
		}
		if ecID.Valid {
			desc := ecDesc.String
			e.Category = &domain.ExpenseCategory{ID: ecID.String, Name: ecName.String, Description: &desc}
		}
		list = append(list, e)
	}
	return list, total, nil
}

func (r *PgExpenseRepository) UpdateExpense(ctx context.Context, e *domain.Expense) error {
	var descVal interface{}
	if e.Description != nil {
		descVal = e.Description
	}
	var catVal interface{}
	if e.CategoryID != nil {
		catVal = e.CategoryID
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Expense" SET amount=$1, description=$2, date=$3, "categoryId"=$4 WHERE id=$5`,
		e.Amount, descVal, e.Date, catVal, e.ID)
	return err
}

func (r *PgExpenseRepository) DeleteExpense(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "Expense" e USING "Branch" b WHERE e.id=$1 AND b.id=e."branchId" AND b."tenantId"=$2`, id, tenantID)
	return err
}

// --- ExpenseCategories ---

// categoryColumns lists ExpenseCategory columns qualified with the "c." alias;
// the joined "Branch" also exposes "name"/"createdAt", so all refs must qualify.
const categoryColumns = `c.id, c.name, c.description, c."branchId", c."createdAt"`

func (r *PgExpenseRepository) CreateCategory(ctx context.Context, c *domain.ExpenseCategory) error {
	var descVal interface{}
	if c.Description != nil {
		descVal = c.Description
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "ExpenseCategory" (id, name, description, "branchId", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, NOW()) RETURNING id, "createdAt"`,
		c.Name, descVal, c.BranchID,
	).Scan(&c.ID, &c.CreatedAt)
}

func (r *PgExpenseRepository) FindCategoryByID(ctx context.Context, id, tenantID string) (*domain.ExpenseCategory, error) {
	c := &domain.ExpenseCategory{}
	err := r.db.QueryRowContext(ctx, `
		SELECT `+categoryColumns+`
		FROM "ExpenseCategory" c
		JOIN "Branch" b ON b.id = c."branchId"
		WHERE c.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&c.ID, &c.Name, &c.Description, &c.BranchID, &c.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding expense category: %w", err)
	}
	return c, nil
}

func (r *PgExpenseRepository) ListCategories(ctx context.Context, tenantID string, filter application.CategoryListFilter) ([]*domain.ExpenseCategory, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND c."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND c.name ILIKE $%d`, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "ExpenseCategory" c JOIN "Branch" b ON b.id = c."branchId" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT %s
		FROM "ExpenseCategory" c JOIN "Branch" b ON b.id = c."branchId"
		%s ORDER BY c."createdAt" DESC LIMIT $%d OFFSET $%d`, categoryColumns, where, idx, idx+1)
	args = append(args, filter.Limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying expense categories: %w", err)
	}
	defer rows.Close()

	var list []*domain.ExpenseCategory
	for rows.Next() {
		c := &domain.ExpenseCategory{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.BranchID, &c.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, c)
	}
	return list, total, nil
}

func (r *PgExpenseRepository) UpdateCategory(ctx context.Context, c *domain.ExpenseCategory) error {
	var descVal interface{}
	if c.Description != nil {
		descVal = c.Description
	}
	_, err := r.db.ExecContext(ctx, `UPDATE "ExpenseCategory" SET name=$1, description=$2 WHERE id=$3`, c.Name, descVal, c.ID)
	return err
}

func (r *PgExpenseRepository) DeleteCategory(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "ExpenseCategory" c USING "Branch" b WHERE c.id=$1 AND b.id=c."branchId" AND b."tenantId"=$2`, id, tenantID)
	return err
}
