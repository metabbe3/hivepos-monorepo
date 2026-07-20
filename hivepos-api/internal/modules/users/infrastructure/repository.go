package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
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
	// Ownership guard: the assigned branch must belong to the user's tenant
	// (prevents attaching a user to another tenant's outlet by spoofing branchId).
	var ok int
	if err := r.db.QueryRowContext(ctx,
		`SELECT 1 FROM "Branch" WHERE id = $1 AND "tenantId" = $2`, u.BranchID, u.TenantID,
	).Scan(&ok); err != nil {
		return fmt.Errorf("branch does not belong to tenant")
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "User" (id, email, "passwordHash", name, phone, role, "roleId",
			"tenantId", "branchId", "sessionVersion", "isActive", "pinHash", "qrToken", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, NULL, NOW(), NOW())
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
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating users: %w", err)
	}
	return list, total, nil
}

// ListUserItems returns the curated user DTO with nested branch + roleRef,
// matching the running TS /api/users shape.
func (r *PgUserRepository) ListUserItems(ctx context.Context, tenantID string, f application.ListFilter) ([]*application.UserListItem, int64, error) {
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
		SELECT u.id, u.email, u.name, u.phone, u.role, u."roleId", u."branchId", u."createdAt",
		       b.id, b.name, r.id, r.name, r.color
		FROM "User" u
		LEFT JOIN "Branch" b ON b.id = u."branchId"
		LEFT JOIN "Role" r ON r.id = u."roleId"
		%s ORDER BY u."createdAt" DESC`, where)
	if !f.All {
		q += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, f.Limit, offset)
	}
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying user items: %w", err)
	}
	defer rows.Close()

	var out []*application.UserListItem
	for rows.Next() {
		it := &application.UserListItem{}
		var email, phone, roleID, branchID, bID, bName, rID, rName, rColor sql.NullString
		if err := rows.Scan(&it.ID, &email, &it.Name, &phone, &it.Role, &roleID, &branchID, &it.CreatedAt,
			&bID, &bName, &rID, &rName, &rColor); err != nil {
			return nil, 0, fmt.Errorf("scanning user item: %w", err)
		}
		if email.Valid {
			e := email.String
			it.Email = &e
		}
		if phone.Valid {
			p := phone.String
			it.Phone = &p
		}
		if roleID.Valid {
			rid := roleID.String
			it.RoleID = &rid
		}
		if branchID.Valid {
			it.BranchID = branchID.String
		}
		if bID.Valid {
			it.Branch = &application.BranchRef{ID: bID.String, Name: bName.String}
		}
		if rID.Valid {
			rr := &application.RoleRef{ID: rID.String, Name: rName.String}
			if rColor.Valid {
				c := rColor.String
				rr.Color = &c
			}
			it.RoleRef = rr
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating user items: %w", err)
	}
	return out, total, nil
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

// ResetUserPassword writes a new passwordHash AND bumps sessionVersion (invalidates
// the staff's current sessions). The tenantId clause keeps it tenant-scoped — an
// owner can't reset a user outside their tenant. No row → "user not found".
func (r *PgUserRepository) ResetUserPassword(ctx context.Context, id, tenantID, hashed string) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE "User" SET "passwordHash" = $1, "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW()
		WHERE id = $2 AND "tenantId" = $3`,
		hashed, id, tenantID)
	if err != nil {
		return fmt.Errorf("resetting password: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// ====================
// Roles
// ====================

func (r *PgUserRepository) CreateRole(ctx context.Context, role *domain.Role) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "Role" (id, name, description, "isSystem", color, permissions, "tenantId", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, false, $3, $4, $5, NOW(), NOW())
		RETURNING id, "isSystem", "createdAt", "updatedAt"`,
		role.Name, role.Description, role.Color, role.Permissions, role.TenantID,
	).Scan(&role.ID, &role.IsSystem, &role.CreatedAt, &role.UpdatedAt)
}

func (r *PgUserRepository) FindRoleByID(ctx context.Context, id, tenantID string) (*domain.Role, error) {
	role := &domain.Role{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, description, "isSystem", color, COALESCE(permissions, '{}'), "tenantId", "createdAt", "updatedAt"
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

// GetRoleName returns just the role name for the role enum derivation.
func (r *PgUserRepository) GetRoleName(ctx context.Context, id, tenantID string) (string, error) {
	var name string
	err := r.db.QueryRowContext(ctx, `SELECT name FROM "Role" WHERE id = $1 AND "tenantId" = $2`, id, tenantID).Scan(&name)
	if err != nil {
		return "", err
	}
	return name, nil
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
		SELECT r.id, r.name, r.description, r."isSystem", r.color, COALESCE(r.permissions, '{}'), r."tenantId", r."createdAt", r."updatedAt"
		FROM "Role" r %s ORDER BY r."createdAt" DESC`, where)
	if !f.All {
		q += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, f.Limit, offset)
	}

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
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating roles: %w", err)
	}
	return list, total, nil
}

// ListRoleItems returns the curated role DTO with userCount + permissions as a
// JSON array, matching the running TS /api/roles shape.
func (r *PgUserRepository) ListRoleItems(ctx context.Context, tenantID string, f application.ListFilter) ([]*application.RoleListItem, int64, error) {
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
		SELECT r.id, r.name, r.description, r.color, COALESCE(array_to_json(r.permissions), '[]'),
		       r."isSystem", r."createdAt",
		       (SELECT COUNT(*) FROM "User" u WHERE u."roleId" = r.id)
		FROM "Role" r %s ORDER BY r."createdAt" DESC`, where)
	if !f.All {
		q += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, f.Limit, offset)
	}
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying role items: %w", err)
	}
	defer rows.Close()

	var out []*application.RoleListItem
	for rows.Next() {
		it := &application.RoleListItem{}
		var permsJSON sql.NullString
		if err := rows.Scan(&it.ID, &it.Name, &it.Description, &it.Color, &permsJSON, &it.IsSystem, &it.CreatedAt, &it.UserCount); err != nil {
			return nil, 0, fmt.Errorf("scanning role item: %w", err)
		}
		if err := json.Unmarshal([]byte(permsJSON.String), &it.Permissions); err != nil {
			return nil, 0, fmt.Errorf("decoding role permissions: %w", err)
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating role items: %w", err)
	}
	return out, total, nil
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
		args = append(args, upd.Permissions)
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
