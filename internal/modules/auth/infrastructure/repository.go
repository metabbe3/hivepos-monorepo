package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/auth/domain"
)

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
		       COALESCE(ur.role, ''), COALESCE(u."branchId", '')
		FROM "User" u
		LEFT JOIN "UserRole" ur ON ur."userId" = u.id
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
		       COALESCE(ur.role, ''), COALESCE(u."branchId", '')
		FROM "User" u
		LEFT JOIN "UserRole" ur ON ur."userId" = u.id
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
	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.name, u."passwordHash", u."tenantId",
		       u."sessionVersion", u."createdAt",
		       COALESCE(ur.role, ''), COALESCE(u."branchId", ''),
		       COALESCE(t.name, ''), COALESCE(t.slug, ''),
		       COALESCE(b.name, '')
		FROM "User" u
		LEFT JOIN "UserRole" ur ON ur."userId" = u.id
		LEFT JOIN "Tenant" t ON t.id = u."tenantId"
		LEFT JOIN "Branch" b ON b.id = u."branchId"
		WHERE u.id = $1`, userID,
	).Scan(
		&uc.ID, &uc.Email, &uc.Name, &uc.PasswordHash, &uc.TenantID,
		&uc.SessionVersion, &uc.CreatedAt,
		&uc.Role, &branchID,
		&uc.TenantName, &uc.TenantSlug,
		&branchName,
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

	// ponytail: <ceiling> — load full permission matrix from Role.permissions JSON when wiring RBAC.
	// For now the role name doubles as the sole permission entry.
	if uc.Role != "" {
		uc.Permissions = []string{uc.Role}
	}

	// ponytail: <ceiling> — resolve feature flags from the FeatureFlag table.
	uc.FeatureFlags = map[string]bool{}

	return uc, nil
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

	// 1. Tenant
	if err = tx.QueryRowContext(ctx, `
		INSERT INTO "Tenant" (name, slug, "createdAt", "updatedAt")
		VALUES ($1, $2, NOW(), NOW()) RETURNING id`,
		input.TenantName, input.TenantSlug,
	).Scan(&tenantID); err != nil {
		return "", "", "", fmt.Errorf("inserting tenant: %w", err)
	}

	// 2. User (owner)
	if err = tx.QueryRowContext(ctx, `
		INSERT INTO "User" (email, name, "passwordHash", "tenantId", "emailVerified", "sessionVersion", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, NOW(), 0, NOW(), NOW()) RETURNING id`,
		input.Email, input.OwnerName, passwordHash, tenantID,
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

	// 4. UserRole (assign OWNER role)
	if _, err = tx.ExecContext(ctx, `
		INSERT INTO "UserRole" ("userId", role, "tenantId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, NOW(), NOW())`,
		userID, "OWNER", tenantID); err != nil {
		return "", "", "", fmt.Errorf("inserting user role: %w", err)
	}

	// 5. Seed default services for the module.
	seedServices(ctx, tx, tenantID, input.Module)

	if err = tx.Commit(); err != nil {
		return "", "", "", fmt.Errorf("committing tenant creation: %w", err)
	}
	return tenantID, userID, branchID, nil
}

// seedServices inserts the module's default service catalog.
//
// ponytail: <ceiling> — this placeholder list should live in a config/seed file
// per module (LAUNDRY/FNB/SALON) with real default prices, not hardcoded here.
func seedServices(ctx context.Context, tx *sql.Tx, tenantID, module string) {
	type svc struct {
		name  string
		price float64
	}
	var defaults []svc
	switch module {
	case "LAUNDRY":
		defaults = []svc{
			{"Cuci Kering", 7000},
			{"Cuci Setrika", 9000},
			{"Setrika Saja", 5000},
		}
	case "FNB":
		// ponytail: <ceiling> — define FNB default services.
		break
	case "SALON":
		// ponytail: <ceiling> — define SALON default services.
		break
	}

	now := time.Now()
	for _, s := range defaults {
		_, _ = tx.ExecContext(ctx, `
			INSERT INTO "Service" (name, price, "tenantId", "isActive", "createdAt", "updatedAt")
			VALUES ($1, $2, $3, true, $4, $4)`,
			s.name, s.price, tenantID, now,
		)
		// Best-effort: a bad seed row should not abort tenant creation.
	}
}
