package infrastructure

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hivepos/api/internal/modules/attendance/application"
	"github.com/hivepos/api/internal/modules/attendance/domain"
)

type PgAttendanceRepository struct {
	db *sql.DB
}

func NewPgAttendanceRepository(db *sql.DB) *PgAttendanceRepository {
	return &PgAttendanceRepository{db: db}
}

// ListStaff returns all active staff members for the tenant.
func (r *PgAttendanceRepository) ListStaff(ctx context.Context, tenantID string) ([]*domain.StaffMember, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT u.id, u.name, u."branchId", u."pinHash", u."qrToken", u."isActive", u."createdAt"
		FROM "User" u
		WHERE u."tenantId" = $1 AND u."isActive" = true
		ORDER BY u.name`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("querying staff: %w", err)
	}
	defer rows.Close()

	var list []*domain.StaffMember
	for rows.Next() {
		s := &domain.StaffMember{}
		if err := rows.Scan(&s.ID, &s.Name, &s.BranchID, &s.PinHash, &s.QrToken, &s.IsActive, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning staff row: %w", err)
		}
		list = append(list, s)
	}
	return list, nil
}

// FindStaffByPIN loads a staff member by ID (for PIN verification).
func (r *PgAttendanceRepository) FindStaffByPIN(ctx context.Context, tenantID, userID string) (*domain.StaffMember, error) {
	s := &domain.StaffMember{}
	var pinHash sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.name, u."branchId", u."pinHash", u."qrToken", u."isActive", u."createdAt"
		FROM "User" u
		WHERE u.id = $1 AND u."tenantId" = $2 AND u."isActive" = true`, userID, tenantID,
	).Scan(&s.ID, &s.Name, &s.BranchID, &pinHash, &s.QrToken, &s.IsActive, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding staff: %w", err)
	}
	if pinHash.Valid {
		v := pinHash.String
		s.PinHash = &v
	}
	return s, nil
}

// ListStatus returns each staff member with their current clock state.
// This joins the latest event per user via DISTINCT ON (Postgres extension).
func (r *PgAttendanceRepository) ListStatus(ctx context.Context, tenantID, branchID string) ([]*domain.StaffStatus, error) {
	args := []interface{}{tenantID}
	q := `
		SELECT u.id, u.name,
		       COALESCE(le.type, 'CLOCKED_OUT') AS status,
		       le.id, le."userId", le."tenantId", le."branchId", le.type, le.timestamp
		FROM "User" u
		LEFT JOIN LATERAL (
			SELECT * FROM "ClockEvent" ce
			WHERE ce."userId" = u.id
			ORDER BY ce.timestamp DESC LIMIT 1
		) le ON true
		WHERE u."tenantId" = $1 AND u."isActive" = true`
	if branchID != "" && branchID != "ALL" {
		q += ` AND u."branchId" = $2`
		args = append(args, branchID)
	}
	q += ` ORDER BY u.name`

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("querying staff status: %w", err)
	}
	defer rows.Close()

	var list []*domain.StaffStatus
	for rows.Next() {
		st := &domain.StaffStatus{}
		var evID, evUID, evTID, evBID, evType sql.NullString
		var evTS sql.NullTime
		if err := rows.Scan(&st.UserID, &st.Name, &st.Status, &evID, &evUID, &evTID, &evBID, &evType, &evTS); err != nil {
			return nil, fmt.Errorf("scanning status row: %w", err)
		}
		if evID.Valid {
			st.LastEvent = &domain.ClockEvent{
				ID:        evID.String,
				UserID:    evUID.String,
				TenantID:  evTID.String,
				BranchID:  evBID.String,
				Type:      domain.ClockEventType(evType.String),
				Timestamp: evTS.Time,
			}
		}
		list = append(list, st)
	}
	return list, nil
}

// LastEvent returns the most recent clock event for a user.
func (r *PgAttendanceRepository) LastEvent(ctx context.Context, userID string) (*domain.ClockEvent, error) {
	e := &domain.ClockEvent{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, "userId", "tenantId", "branchId", type, timestamp
		FROM "ClockEvent" WHERE "userId" = $1 ORDER BY timestamp DESC LIMIT 1`, userID,
	).Scan(&e.ID, &e.UserID, &e.TenantID, &e.BranchID, &e.Type, &e.Timestamp)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding last event: %w", err)
	}
	return e, nil
}

// CreateEvent inserts a new clock event.
func (r *PgAttendanceRepository) CreateEvent(ctx context.Context, e *domain.ClockEvent) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "ClockEvent" ("userId", "tenantId", "branchId", type, timestamp, "createdAt")
		VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, timestamp`,
		e.UserID, e.TenantID, e.BranchID, e.Type,
	).Scan(&e.ID, &e.Timestamp)
}

// FindEventByID loads a single event (tenant-scoped).
func (r *PgAttendanceRepository) FindEventByID(ctx context.Context, id, tenantID string) (*domain.ClockEvent, error) {
	e := &domain.ClockEvent{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, "userId", "tenantId", "branchId", type, timestamp
		FROM "ClockEvent" WHERE id = $1 AND "tenantId" = $2`, id, tenantID,
	).Scan(&e.ID, &e.UserID, &e.TenantID, &e.BranchID, &e.Type, &e.Timestamp)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding event: %w", err)
	}
	return e, nil
}

// ListEvents returns paginated clock events with optional filters.
func (r *PgAttendanceRepository) ListEvents(ctx context.Context, tenantID string, f application.ListFilter) ([]*domain.ClockEvent, int64, error) {
	where := `WHERE ce."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if f.BranchID != "" && f.BranchID != "ALL" {
		where += fmt.Sprintf(` AND ce."branchId" = $%d`, idx)
		args = append(args, f.BranchID)
		idx++
	}
	if f.UserID != "" {
		where += fmt.Sprintf(` AND ce."userId" = $%d`, idx)
		args = append(args, f.UserID)
		idx++
	}
	if f.From != "" {
		where += fmt.Sprintf(` AND ce.timestamp >= $%d`, idx)
		args = append(args, f.From+" 00:00:00")
		idx++
	}
	if f.To != "" {
		where += fmt.Sprintf(` AND ce.timestamp <= $%d`, idx)
		args = append(args, f.To+" 23:59:59")
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "ClockEvent" ce `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting events: %w", err)
	}

	offset := (f.Page - 1) * f.Limit
	q := fmt.Sprintf(`
		SELECT ce.id, ce."userId", ce."tenantId", ce."branchId", ce.type, ce.timestamp
		FROM "ClockEvent" ce %s ORDER BY ce.timestamp DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	args = append(args, f.Limit, offset)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying events: %w", err)
	}
	defer rows.Close()

	var list []*domain.ClockEvent
	for rows.Next() {
		e := &domain.ClockEvent{}
		if err := rows.Scan(&e.ID, &e.UserID, &e.TenantID, &e.BranchID, &e.Type, &e.Timestamp); err != nil {
			return nil, 0, fmt.Errorf("scanning event: %w", err)
		}
		list = append(list, e)
	}
	return list, total, nil
}

// UpdateEvent patches an existing event's type and/or timestamp.
func (r *PgAttendanceRepository) UpdateEvent(ctx context.Context, id, tenantID string, upd application.UpdateEventInput) error {
	sets := []string{}
	args := []interface{}{}
	idx := 1
	if upd.Type != nil {
		sets = append(sets, fmt.Sprintf(`type = $%d`, idx))
		args = append(args, *upd.Type)
		idx++
	}
	if upd.Timestamp != nil {
		sets = append(sets, fmt.Sprintf(`timestamp = $%d`, idx))
		args = append(args, *upd.Timestamp)
		idx++
	}
	if len(sets) == 0 {
		return nil // nothing to update
	}
	q := fmt.Sprintf(`UPDATE "ClockEvent" SET %s WHERE id = $%d AND "tenantId" = $%d`,
		joinStr(sets, ", "), idx, idx+1)
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("updating event: %w", err)
	}
	return nil
}

// DeleteEvent hard-deletes an event.
func (r *PgAttendanceRepository) DeleteEvent(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "ClockEvent" WHERE id = $1 AND "tenantId" = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("deleting event: %w", err)
	}
	return nil
}

// CreateQuickStaff inserts an attendance-only user (no password/email — PIN clock only).
func (r *PgAttendanceRepository) CreateQuickStaff(ctx context.Context, name, pinHash, branchID string) (*domain.StaffMember, error) {
	s := &domain.StaffMember{PinHash: &pinHash, IsActive: true}
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "User" (name, "pinHash", "branchId", "isActive", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, true, NOW(), NOW())
		RETURNING id, "createdAt"`, name, pinHash, branchID,
	).Scan(&s.ID, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("inserting quick staff: %w", err)
	}
	s.Name = name
	s.BranchID = branchID
	return s, nil
}

// joinStr is a tiny strings.Join shim to avoid pulling in "strings" for one call.
func joinStr(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}
