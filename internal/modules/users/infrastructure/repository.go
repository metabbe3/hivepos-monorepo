package infrastructure

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hivepos/api/internal/modules/users/application"
	"github.com/hivepos/api/internal/modules/users/domain"
)

type PgUserRepository struct {
	db *sql.DB
}

func NewPgUserRepository(db *sql.DB) *PgUserRepository {
	return &PgUserRepository{db: db}
}

// ====================
// Users
// ====================

func (r *PgUserRepository) CreateUser(ctx context.Context, u *domain.User) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "User" (email, "passwordHash", name, phone, role, "roleId",
			"tenantId", "branchId", "sessionVersion", "isActive", "pinHash", "qrToken", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, NULL, NOW(), NOW())
		RETURNING id, "sessionVersion", "createdAt", "updatedAt"`,
		u.Email, u.PasswordHash, u.Name, u.Phone, u.Role, u.RoleID,
		u.TenantID, u.BranchID, u.IsActive, u.PinHash,
	).Scan(&u.ID, &u.SessionVersion, &u.CreatedAt, &u.UpdatedAt)
}

func (r *PgUserRepository) FindUserByID(ctx context.Context, id, tenantID string) (*domain.User, error) {
	u := &domain.User{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, email, "passwordHash", name, phone, role, "roleId",
		       "tenantId", "branchId", "sessionVersion", "isActive", "pinHash", "qrToken", "createdAt", "updatedAt"
		FROM "User" WHERE id = $1 AND "tenantId" = $2`, id, tenantID,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Phone, &u.Role, &u.RoleID,
		&u.TenantID, &u.BranchID, &u.SessionVersion, &u.IsActive, &u.PinHash, &u.QrToken, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding user: %w", err)
	}
	return u, nil
}

func (r *PgUserRepository) ListUsers(ctx context.Context, tenantID string, f application.ListFilter) ([]*domain.User, int64, error) {
	where := `WHERE u."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if f.BranchID != "" && f.BranchID != "ALL" {
		where += fmt.Sprintf(` AND u."branchId" = $%d`, idx)
		args = append(args, f.BranchID)
		idx++
	}
	if f.Role != "" {
		where += fmt.Sprintf(` AND u.role = $%d`, idx)
		args = append(args, f.Role)
		idx++
	}
	if f.Search != "" {
		where += fmt.Sprintf(` AND (u.name ILIKE $%d OR u.email ILIKE $%d OR u.phone ILIKE $%d)`, idx, idx, idx)
		args = append(args, "%"+f.Search+"%")
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "User" u `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting users: %w", err)
	}

	offset := (f.Page - 1) * f.Limit
	q := fmt.Sprintf(`
		SELECT u.id, u.email, u."passwordHash", u.name, u.phone, u.role, u."roleId",
		       u."tenantId", u."branchId", u."sessionVersion", u."isActive", u."pinHash", u."qrToken", u."createdAt", u."updatedAt"
		FROM "User" u %s ORDER BY u."createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	args = append(args, f.Limit, offset)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying users: %w", err)
	}
	defer rows.Close()

	var list []*domain.User
	for rows.Next() {
		u := &domain.User{}
		if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Phone, &u.Role, &u.RoleID,
			&u.TenantID, &u.BranchID, &u.SessionVersion, &u.IsActive, &u.PinHash, &u.QrToken, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scanning user: %w", err)
		}
		list = append(list, u)
	}
	return list, total, nil
}

func (r *PgUserRepository) UpdateUser(ctx context.Context, id, tenantID string, upd application.UpdateUserInput) error {
	sets := []string{}
	args := []interface{}{}
	idx := 1
	if upd.Email != nil {
		sets = append(sets, fmt.Sprintf(`email = $%d`, idx))
		args = append(args, *upd.Email)
		idx++
	}
	if upd.Name != nil {
		sets = append(sets, fmt.Sprintf(`name = $%d`, idx))
		args = append(args, *upd.Name)
		idx++
	}
	if upd.Phone != nil {
		sets = append(sets, fmt.Sprintf(`phone = $%d`, idx))
		args = append(args, *upd.Phone)
		idx++
	}
	if upd.Role != nil {
		sets = append(sets, fmt.Sprintf(`role = $%d`, idx))
		args = append(args, *upd.Role)
		idx++
	}
	if upd.RoleID != nil {
		sets = append(sets, fmt.Sprintf(`"roleId" = $%d`, idx))
		args = append(args, *upd.RoleID)
		idx++
	}
	if upd.BranchID != nil {
		sets = append(sets, fmt.Sprintf(`"branchId" = $%d`, idx))
		args = append(args, *upd.BranchID)
		idx++
	}
	if upd.IsActive != nil {
		sets = append(sets, fmt.Sprintf(`"isActive" = $%d`, idx))
		args = append(args, *upd.IsActive)
		idx++
	}
	if len(sets) == 0 {
		return nil
	}
	sets = append(sets, `"updatedAt" = NOW()`)
	q := fmt.Sprintf(`UPDATE "User" SET %s WHERE id = $%d AND "tenantId" = $%d`,
		joinStrings(sets, ", "), idx, idx+1)
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("updating user: %w", err)
	}
	return nil
}

func (r *PgUserRepository) DeleteUser(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "User" WHERE id = $1 AND "tenantId" = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("deleting user: %w", err)
	}
	return nil
}

func (r *PgUserRepository) SetPIN(ctx context.Context, id, tenantID, pinHash string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "User" SET "pinHash" = $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3`,
		pinHash, id, tenantID)
	if err != nil {
		return fmt.Errorf("setting pin: %w", err)
	}
	return nil
}

// ====================
// Roles
// ====================

func (r *PgUserRepository) CreateRole(ctx context.Context, role *domain.Role) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "Role" (name, description, "isSystem", color, permissions, "tenantId", "createdAt", "updatedAt")
		VALUES ($1, $2, false, $3, $4, $5, NOW(), NOW())
		RETURNING id, "isSystem", "createdAt", "updatedAt"`,
		role.Name, role.Description, role.Color, role.Permissions, role.TenantID,
	).Scan(&role.ID, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
}

func (r *PgUserRepository) FindRoleByID(ctx context.Context, id, tenantID string) (*domain.Role, error) {
	role := &domain.Role{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, description, "isSystem", color, permissions, "tenantId", "createdAt", "updatedAt"
		FROM "Role" WHERE id = $1 AND "tenantId" = $2`, id, tenantID,
	).Scan(&role.ID, &role.Name, &role.Description, &role.IsSystem, &role.Color, &role.Permissions, &role.TenantID, &role.CreatedAt, &role.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding role: %w", err)
	}
	return role, nil
}

func (r *PgUserRepository) ListRoles(ctx context.Context, tenantID string, f application.ListFilter) ([]*domain.Role, int64, error) {
	where := `WHERE r."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if f.Search != "" {
		where += fmt.Sprintf(` AND r.name ILIKE $%d`, idx)
		args = append(args, "%"+f.Search+"%")
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Role" r `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting roles: %w", err)
	}

	offset := (f.Page - 1) * f.Limit
	q := fmt.Sprintf(`
		SELECT r.id, r.name, r.description, r."isSystem", r.color, r.permissions, r."tenantId", r."createdAt", r."updatedAt"
		FROM "Role" r %s ORDER BY r."createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	args = append(args, f.Limit, offset)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying roles: %w", err)
	}
	defer rows.Close()

	var list []*domain.Role
	for rows.Next() {
		role := &domain.Role{}
		if err := rows.Scan(&role.ID, &role.Name, &role.Description, &role.IsSystem, &role.Color, &role.Permissions, &role.TenantID, &role.CreatedAt, &role.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scanning role: %w", err)
		}
		list = append(list, role)
	}
	return list, total, nil
}

func (r *PgUserRepository) UpdateRole(ctx context.Context, id, tenantID string, upd application.UpdateRoleInput) error {
	sets := []string{}
	args := []interface{}{}
	idx := 1
	if upd.Name != nil {
		sets = append(sets, fmt.Sprintf(`name = $%d`, idx))
		args = append(args, *upd.Name)
		idx++
	}
	if upd.Description != nil {
		sets = append(sets, fmt.Sprintf(`description = $%d`, idx))
		args = append(args, *upd.Description)
		idx++
	}
	if upd.Color != nil {
		sets = append(sets, fmt.Sprintf(`color = $%d`, idx))
		args = append(args, *upd.Color)
		idx++
	}
	if upd.Permissions != nil {
		sets = append(sets, fmt.Sprintf(`permissions = $%d`, idx))
		args = append(args, *upd.Permissions)
		idx++
	}
	if len(sets) == 0 {
		return nil
	}
	sets = append(sets, `"updatedAt" = NOW()`)
	q := fmt.Sprintf(`UPDATE "Role" SET %s WHERE id = $%d AND "tenantId" = $%d`,
		joinStrings(sets, ", "), idx, idx+1)
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("updating role: %w", err)
	}
	return nil
}

func (r *PgUserRepository) DeleteRole(ctx context.Context, id, tenantID string) error {
	// System roles are protected from deletion.
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM "Role" WHERE id = $1 AND "tenantId" = $2 AND "isSystem" = false`, id, tenantID)
	if err != nil {
		return fmt.Errorf("deleting role: %w", err)
	}
	return nil
}

// joinStrings is a small strings.Join shim to avoid importing "strings" for two calls.
func joinStrings(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}
