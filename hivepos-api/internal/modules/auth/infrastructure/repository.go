package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/hivepos/api/internal/modules/auth/domain"
)

// ponytail: in-memory TTL cache for resolved feature flags. Flags change rarely (super-admin edit);
// LoadUserContext runs on every login/refresh. 5m TTL. Invalidate via process restart or a future hook.
const flagTTL = 5 * time.Minute

type cachedFlags struct {
	flags map[string]bool
	at    time.Time
}

var flagCache sync.Map // tenantID → cachedFlags

type PgAuthRepository struct {
	db *sql.DB
}

func NewPgAuthRepository(db *sql.DB) *PgAuthRepository {
	return &PgAuthRepository{db: db}
}

// FindUserByEmail loads a user (with passwordHash + tenantId + role + branchId)
// by email address. Returns (nil, nil) when not found so the service can
// collapse not-found and wrong-password into one 401.
func (r *PgAuthRepository) FindUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	u := &domain.User{}
	var branchID sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.name, u."passwordHash", u."tenantId",
		       u."sessionVersion", u."createdAt",
		       COALESCE(u.role::text, ''), COALESCE(u."branchId", '')
		FROM "User" u
		WHERE u.email = $1`, email,
	).Scan(
		&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.TenantID,
		&u.SessionVersion, &u.CreatedAt,
		&u.Role, &branchID,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding user by email: %w", err)
	}
	if branchID.Valid {
		u.BranchID = branchID.String
	}
	return u, nil
}

// FindUserByID loads a user by id.
func (r *PgAuthRepository) FindUserByID(ctx context.Context, id string) (*domain.User, error) {
	u := &domain.User{}
	var branchID sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.name, u."passwordHash", u."tenantId",
		       u."sessionVersion", u."createdAt",
		       COALESCE(u.role::text, ''), COALESCE(u."branchId", '')
		FROM "User" u
		
		WHERE u.id = $1`, id,
	).Scan(
		&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.TenantID,
		&u.SessionVersion, &u.CreatedAt,
		&u.Role, &branchID,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding user by id: %w", err)
	}
	if branchID.Valid {
		u.BranchID = branchID.String
	}
	return u, nil
}

// LoadUserContext loads the user plus tenant/branch names + permissions/flags.
func (r *PgAuthRepository) LoadUserContext(ctx context.Context, userID string) (*domain.UserContext, error) {
	uc := &domain.UserContext{}
	var branchID sql.NullString
	var branchName sql.NullString
	var rolePerms string
	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.name, u."passwordHash", u."tenantId",
		       u."sessionVersion", u."createdAt",
		       COALESCE(u.role::text, ''), COALESCE(u."branchId", ''),
		       COALESCE(t.name, ''), COALESCE(t.slug, ''),
		       COALESCE(b.name, ''),
		       COALESCE(array_to_string(r.permissions, ','), '')
		FROM "User" u
		LEFT JOIN "Tenant" t ON t.id = u."tenantId"
		LEFT JOIN "Branch" b ON b.id = u."branchId"
		LEFT JOIN "Role" r ON r.id = u."roleId"
		WHERE u.id = $1`, userID,
	).Scan(
		&uc.ID, &uc.Email, &uc.Name, &uc.PasswordHash, &uc.TenantID,
		&uc.SessionVersion, &uc.CreatedAt,
		&uc.Role, &branchID,
		&uc.TenantName, &uc.TenantSlug,
		&branchName,
		&rolePerms,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("loading user context: %w", err)
	}
	if branchID.Valid {
		uc.BranchID = branchID.String
	}
	if branchName.Valid {
		uc.BranchName = branchName.String
	}

	// Load the role's permission matrix (Role.permissions text[]) via the roleId join.
	// Owner wildcard "*" survives strings.Split unchanged. Fall back to the role name so
	// the FE's DEFAULT_ROLES merge still resolves when no Role row is attached.
	if rolePerms != "" {
		uc.Permissions = strings.Split(rolePerms, ",")
	} else if uc.Role != "" {
		uc.Permissions = []string{uc.Role}
	}

	// Resolve feature flags: FeatureFlag defaults overlaid with TenantFeatureFlag overrides.
	uc.FeatureFlags = r.loadFeatureFlags(ctx, uc.TenantID)

	return uc, nil
}

// loadFeatureFlags resolves the effective flag map for a tenant: FeatureFlag defaults
// overlaid with TenantFeatureFlag overrides (tenant wins). Cached 5m. Best-effort —
// returns an empty map on query error (flags are non-critical).
func (r *PgAuthRepository) loadFeatureFlags(ctx context.Context, tenantID string) map[string]bool {
	if tenantID == "" {
		return map[string]bool{}
	}
	if v, ok := flagCache.Load(tenantID); ok {
		c := v.(cachedFlags)
		if time.Since(c.at) < flagTTL {
			return c.flags
		}
	}
	flags := map[string]bool{}
	if dRows, err := r.db.QueryContext(ctx, `SELECT key, enabled FROM "FeatureFlag"`); err == nil {
		for dRows.Next() {
			var key string
			var en bool
			if dRows.Scan(&key, &en) != nil {
				break
			}
			flags[key] = en
		}
		dRows.Close()
	}
	if tRows, err := r.db.QueryContext(ctx,
		`SELECT f.key, tf.enabled FROM "TenantFeatureFlag" tf JOIN "FeatureFlag" f ON f.id = tf."flagId" WHERE tf."tenantId" = $1`,
		tenantID); err == nil {
		for tRows.Next() {
			var key string
			var en bool
			if tRows.Scan(&key, &en) != nil {
				break
			}
			flags[key] = en
		}
		tRows.Close()
	}
	flagCache.Store(tenantID, cachedFlags{flags: flags, at: time.Now()})
	return flags
}

// scanSuperAdmin builds a *domain.UserContext from a SuperAdmin row. Platform
// staff have no tenant/branch, so those fields stay empty. Permissions are the
// wildcard ["*"] (mirrors legacy SUPER_ADMIN claims) so RBAC middleware grants all.
func scanSuperAdmin(id, email, name, passwordHash, role string, sessionVersion int) *domain.UserContext {
	return &domain.UserContext{
		User: domain.User{
			ID:             id,
			Email:          email,
			Name:           name,
			PasswordHash:   passwordHash,
			Role:           role,
			SessionVersion: sessionVersion,
		},
		Permissions:  []string{"*"},
		FeatureFlags: map[string]bool{},
	}
}

// FindSuperAdminByEmail loads a platform-staff account by email. Returns
// (nil, nil) when not found so the service collapses it into one 401.
func (r *PgAuthRepository) FindSuperAdminByEmail(ctx context.Context, email string) (*domain.UserContext, error) {
	var id, pwHash, name, role string
	var sessionVersion int
	err := r.db.QueryRowContext(ctx, `
		SELECT id, email, name, "passwordHash", COALESCE(role::text, 'SUPER_ADMIN'), "sessionVersion"
		FROM "SuperAdmin" WHERE email = $1`, email,
	).Scan(&id, &email, &name, &pwHash, &role, &sessionVersion)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding super-admin by email: %w", err)
	}
	return scanSuperAdmin(id, email, name, pwHash, role, sessionVersion), nil
}

// LoadSuperAdminContext loads a platform-staff account by id (for /me).
func (r *PgAuthRepository) LoadSuperAdminContext(ctx context.Context, id string) (*domain.UserContext, error) {
	var email, name, pwHash, role string
	var sessionVersion int
	err := r.db.QueryRowContext(ctx, `
		SELECT id, email, name, "passwordHash", COALESCE(role::text, 'SUPER_ADMIN'), "sessionVersion"
		FROM "SuperAdmin" WHERE id = $1`, id,
	).Scan(&id, &email, &name, &pwHash, &role, &sessionVersion)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("loading super-admin context: %w", err)
	}
	return scanSuperAdmin(id, email, name, pwHash, role, sessionVersion), nil
}

// BumpSessionVersion increments the user's sessionVersion and returns the new value.
func (r *PgAuthRepository) BumpSessionVersion(ctx context.Context, userID string) (int, error) {
	var newVersion int
	err := r.db.QueryRowContext(ctx, `
		UPDATE "User" SET "sessionVersion" = "sessionVersion" + 1
		WHERE id = $1 RETURNING "sessionVersion"`, userID,
	).Scan(&newVersion)
	if err != nil {
		return 0, fmt.Errorf("bumping session version: %w", err)
	}
	return newVersion, nil
}

// GetSessionVersion reads the user's current sessionVersion (no mutation).
// ponytail: User table only — the super-admin panel has no SessionSyncWrapper
// (app/super-admin/(panel)/layout.tsx runs no useSessionSync), so the
// SuperAdmin table's sessionVersion is never polled here. Route by role
// (LoadContextForRole-style) if super-admin polling is added.
func (r *PgAuthRepository) GetSessionVersion(ctx context.Context, userID string) (int, error) {
	var v int
	err := r.db.QueryRowContext(ctx,
		`SELECT "sessionVersion" FROM "User" WHERE id = $1`, userID,
	).Scan(&v)
	if err != nil {
		return 0, fmt.Errorf("reading session version: %w", err)
	}
	return v, nil
}

// FindUserByGoogleID loads a user by their linked Google sub.
func (r *PgAuthRepository) FindUserByGoogleID(ctx context.Context, googleID string) (*domain.User, error) {
	u := &domain.User{}
	var branchID sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT id, email, name, "passwordHash", "tenantId",
		       "sessionVersion", "createdAt",
		       COALESCE(role::text, ''), COALESCE("branchId", '')
		FROM "User" WHERE "googleId" = $1`, googleID,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.TenantID,
		&u.SessionVersion, &u.CreatedAt, &u.Role, &branchID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding user by google id: %w", err)
	}
	if branchID.Valid {
		u.BranchID = branchID.String
	}
	return u, nil
}

// SetUserGoogleID links a Google identity to an existing user (only if not already linked).
func (r *PgAuthRepository) SetUserGoogleID(ctx context.Context, userID, googleID, avatar string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "User" SET "googleId" = $1, avatar = COALESCE(NULLIF($2, ''), avatar)
		WHERE id = $3 AND ("googleId" IS NULL OR "googleId" = '')`, googleID, avatar, userID)
	if err != nil {
		return fmt.Errorf("linking google id: %w", err)
	}
	return nil
}

// ClearUserGoogleID removes the Google link + avatar from a user.
func (r *PgAuthRepository) ClearUserGoogleID(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE "User" SET "googleId" = NULL, avatar = NULL WHERE id = $1`, userID)
	if err != nil {
		return fmt.Errorf("clearing google id: %w", err)
	}
	return nil
}

// CreateTenantWithOwner provisions a new tenant in one transaction:
// Tenant → User → Branch → UserRole (OWNER) → default Services for the module.
// passwordHash must already be a bcrypt hash (the caller hashes; this layer is crypto-free).
func (r *PgAuthRepository) CreateTenantWithOwner(ctx context.Context, input domain.RegisterInput, passwordHash string) (tenantID, userID, branchID string, err error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", "", "", fmt.Errorf("beginning tx: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// 1. Tenant — auto-approved + 60-day trial (no manual approval needed for self-registration).
	if err = tx.QueryRowContext(ctx, `
		INSERT INTO "Tenant" (name, slug, "ownerEmail", "ownerName", "isActive", "websiteEnabled", "isDemo", "approvedAt", "trialEndsAt", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, true, false, false, NOW(), NOW() + interval '60 days', NOW(), NOW()) RETURNING id`,
		input.TenantName, input.TenantSlug, input.Email, input.OwnerName,
	).Scan(&tenantID); err != nil {
		return "", "", "", fmt.Errorf("inserting tenant: %w", err)
	}

	// 2. User (owner) — link googleId on the row when registering via Google.
	if err = tx.QueryRowContext(ctx, `
		INSERT INTO "User" (email, name, "passwordHash", "tenantId", "googleId", "emailVerified", "sessionVersion", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), NOW(), 0, NOW(), NOW()) RETURNING id`,
		input.Email, input.OwnerName, passwordHash, tenantID, input.GoogleID,
	).Scan(&userID); err != nil {
		return "", "", "", fmt.Errorf("inserting user: %w", err)
	}

	// 3. Branch
	if err = tx.QueryRowContext(ctx, `
		INSERT INTO "Branch" (name, "tenantId", "createdAt", "updatedAt")
		VALUES ($1, $2, NOW(), NOW()) RETURNING id`,
		input.BranchName, tenantID,
	).Scan(&branchID); err != nil {
		return "", "", "", fmt.Errorf("inserting branch: %w", err)
	}

	// Attach the user to the branch.
	if _, err = tx.ExecContext(ctx, `
		UPDATE "User" SET "branchId" = $1 WHERE id = $2`, branchID, userID); err != nil {
		return "", "", "", fmt.Errorf("attaching branch to user: %w", err)
	}

	// 4. Assign OWNER role on the User row directly (Prisma enum, not a join table).
	if _, err = tx.ExecContext(ctx, `
		UPDATE "User" SET role = 'OWNER' WHERE id = $1`, userID); err != nil {
		return "", "", "", fmt.Errorf("setting owner role: %w", err)
	}

	// Seed default services BEFORE commit (synchronous — atomic with the tenant
	// provisioning; no orphan tenant without services on crash).
	seedServices(ctx, tx, branchID, input.Module)
	seedRoles(ctx, tx, tenantID)
	seedExpenseCategories(ctx, tx, branchID)
	seedBranchDefaults(ctx, tx, branchID, tenantID, input.BranchName)

	if err = tx.Commit(); err != nil {
		return "", "", "", fmt.Errorf("committing tenant creation: %w", err)
	}
	return tenantID, userID, branchID, nil
}

// executor is satisfied by both *sql.DB and *sql.Tx (lets seedServices run in-tx or post-commit).
type executor interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

// seedServices inserts a ready-to-use service catalog + groups + a walk-in customer so a new
// tenant can take orders immediately without manual setup.
// ponytail: prices are sensible Indonesian-laundry defaults; make configurable via admin settings
// when per-region pricing is needed.
func seedServices(ctx context.Context, ex executor, branchID, module string) {
	if module != "LAUNDRY" {
		return // ponytail: only LAUNDRY seeded; add FNB/SALON catalogs when those modules ship.
	}

	// 1. Service groups (Kiloan + Satuan).
	var kiloanID, satuanID string
	ex.QueryRowContext(ctx, `
		INSERT INTO "ServiceGroup" (name, "sortOrder", module, "branchId", "createdAt", "updatedAt")
		VALUES ('Kiloan', 0, 'LAUNDRY', $1, NOW(), NOW()) RETURNING id`, branchID,
	).Scan(&kiloanID)
	ex.QueryRowContext(ctx, `
		INSERT INTO "ServiceGroup" (name, "sortOrder", module, "branchId", "createdAt", "updatedAt")
		VALUES ('Satuan', 1, 'LAUNDRY', $1, NOW(), NOW()) RETURNING id`, branchID,
	).Scan(&satuanID)

	// 2. Default services (correct schema: basePrice, branchId, pricingType, etc.).
	type svc struct {
		name        string
		pricingType string
		price       float64
		groupID     string
		isDefault   bool
	}
	defaults := []svc{
		{"Cuci Setrika Reguler", "PER_KG", 7000, kiloanID, true},
		{"Cuci Setrika Express 6 Jam", "PER_KG", 12000, kiloanID, false},
		{"Cuci Lipat Reguler", "PER_KG", 6000, kiloanID, true},
		{"Cuci Lipat Express 6 Jam", "PER_KG", 10000, kiloanID, false},
		{"Setrika Saja", "PER_KG", 5000, kiloanID, true},
		{"Bedcover", "PER_ITEM", 25000, satuanID, false},
		{"Cuci Sepatu", "PER_ITEM", 30000, satuanID, false},
		{"Karpet", "PER_ITEM", 20000, satuanID, false},
	}
	for _, s := range defaults {
		var gid interface{}
		if s.groupID != "" {
			gid = s.groupID
		}
		_, _ = ex.ExecContext(ctx, `
			INSERT INTO "Service" (name, "pricingType", "basePrice", "commissionType", "commissionValue",
				module, "isActive", "isDefaultSpeed", "branchId", "groupId", "createdAt", "updatedAt")
			VALUES ($1, $2, $3, 'NONE', 0, 'LAUNDRY', true, $4, $5, $6, NOW(), NOW())`,
			s.name, s.pricingType, s.price, s.isDefault, branchID, gid,
		)
	}

	// 3. Walk-in customer — so the tenant can create an order immediately.
	_, _ = ex.ExecContext(ctx, `
		INSERT INTO "Customer" (name, phone, "branchId", balance, "createdAt", "updatedAt")
		VALUES ('Pelanggan Umum', NULL, $1, 0, NOW(), NOW())`, branchID,
	)
}

// seedRoles inserts the 4 system role templates (Owner/Manager/Kasir/Staff) for a new tenant.
// Matches the Demo tenant's role definitions exactly — permissions, colors, descriptions.
func seedRoles(ctx context.Context, ex executor, tenantID string) {
	type role struct {
		name, desc, color string
		perms             []string
	}
	defaults := []role{
		{"Owner", "Akses penuh ke semua fitur dan pengaturan", "indigo", []string{"*"}},
		{"Manager", "Kelola operasional harian, staff, dan inventory. Tidak akses billing atau roles.", "blue", []string{
			"dashboard:read", "orders:read", "orders:create", "orders:edit", "orders:delete", "orders:discount",
			"customers:read", "customers:create", "customers:edit", "customers:delete",
			"services:read", "services:create", "services:edit", "services:delete",
			"inventory:read", "inventory:create", "inventory:edit", "inventory:delete",
			"expenses:read", "expenses:create", "expenses:edit", "expenses:delete",
			"deposits:read", "deposits:create", "deposits:edit",
			"reports:read", "reports:export",
			"branches:read", "branches:edit",
			"users:read", "users:create", "users:edit",
			"pickupRequests:read", "pickupRequests:create", "pickupRequests:edit", "pickupRequests:delete",
			"attendance:read", "attendance:edit",
		}},
		{"Kasir", "Kasir: transaksi orders dan data pelanggan saja. Tidak bisa edit/hapus data lain.", "emerald", []string{
			"dashboard:read", "orders:read", "orders:create",
			"customers:read", "customers:create",
			"deposits:read", "deposits:create",
			"services:read", "pickupRequests:read", "pickupRequests:edit", "attendance:read",
		}},
		{"Staff", "Staff operasional: lihat dashboard, transaksi orders, pelanggan, dan inventory.", "amber", []string{
			"dashboard:read", "orders:read", "orders:create",
			"customers:read", "customers:create",
			"inventory:read", "services:read", "pickupRequests:read", "attendance:read",
		}},
	}
	for _, r := range defaults {
		_, _ = ex.ExecContext(ctx, `
			INSERT INTO "Role" (id, name, description, "isSystem", permissions, color, "tenantId", "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, true, $3, $4, $5, NOW(), NOW())`,
			r.name, r.desc, fmt.Sprintf("{%s}", strings.Join(r.perms, ",")), r.color, tenantID,
		)
	}
}

// seedExpenseCategories creates default expense categories so the Expenses page works on day 1.
func seedExpenseCategories(ctx context.Context, ex executor, branchID string) {
	categories := []string{"Operasional", "Gaji", "Listrik & Air", "Perlengkapan", "Lainnya"}
	for _, name := range categories {
		_, _ = ex.ExecContext(ctx, `
			INSERT INTO "ExpenseCategory" (name, "branchId", "createdAt")
			VALUES ($1, $2, NOW())`, name, branchID,
		)
	}
}

// seedBranchDefaults sets operating hours, slug, and work days on the branch + enables the
// public website on the tenant. Without these, the public site shows "closed" and has no URL.
func seedBranchDefaults(ctx context.Context, ex executor, branchID, tenantID, branchName string) {
	slug := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(branchName), " ", "-"))
	hours := `{"min":"08:00-21:00","mon":"08:00-21:00","tue":"08:00-21:00","wed":"08:00-21:00","thu":"08:00-21:00","fri":"08:00-21:00","sat":"08:00-21:00"}`
	_, _ = ex.ExecContext(ctx, `
		UPDATE "Branch" SET "operatingHours" = $1::jsonb, "workDays" = '{0,1,2,3,4,5,6}', slug = $2
		WHERE id = $3`,
		hours, slug, branchID,
	)
	_, _ = ex.ExecContext(ctx, `
		UPDATE "Tenant" SET "websiteEnabled" = true WHERE id = $1`,
		tenantID,
	)
}
