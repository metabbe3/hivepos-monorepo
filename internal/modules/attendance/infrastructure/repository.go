package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"time"

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
		WHERE u."tenantId" = $1 AND u."isActive" = true AND u."pinHash" IS NOT NULL
		ORDER BY u.name`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("querying staff: %w", err)
	}
	defer rows.Close()

	var list []*domain.StaffMember
	for rows.Next() {
		s := &domain.StaffMember{}
		var branchID sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &branchID, &s.PinHash, &s.QrToken, &s.IsActive, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning staff row: %w", err)
		}
		if branchID.Valid {
			s.BranchID = branchID.String
		}
		list = append(list, s)
	}
	return list, nil
}

// FindStaffByPIN loads a staff member by ID (for PIN verification).
func (r *PgAttendanceRepository) FindStaffByPIN(ctx context.Context, tenantID, userID string) (*domain.StaffMember, error) {
	s := &domain.StaffMember{}
	var pinHash, branchID sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.name, u."branchId", u."pinHash", u."qrToken", u."isActive", u."createdAt"
		FROM "User" u
		WHERE u.id = $1 AND u."tenantId" = $2 AND u."isActive" = true`, userID, tenantID,
	).Scan(&s.ID, &s.Name, &branchID, &pinHash, &s.QrToken, &s.IsActive, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding staff: %w", err)
	}
	if branchID.Valid {
		s.BranchID = branchID.String
	}
	if pinHash.Valid {
		v := pinHash.String
		s.PinHash = &v
	}
	return s, nil
}

// ListStatus mirrors TS /api/attendance/status: for each PIN-enabled staff, today's
// worked milliseconds + the open clock-in timestamp (since), or null if clocked out.
func (r *PgAttendanceRepository) ListStatus(ctx context.Context, tenantID, branchID string) ([]*domain.StaffStatus, error) {
	// 1. staff with PIN
	staffArgs := []interface{}{tenantID}
	staffQ := `SELECT u.id, u.name FROM "User" u WHERE u."tenantId" = $1 AND u."isActive" = true AND u."pinHash" IS NOT NULL`
	if branchID != "" && branchID != "ALL" {
		// include attendance-only staff with no branch assignment (NULL branchId)
		staffQ += ` AND (u."branchId" = $2 OR u."branchId" IS NULL)`
		staffArgs = append(staffArgs, branchID)
	}
	staffQ += ` ORDER BY u.name`
	rows, err := r.db.QueryContext(ctx, staffQ, staffArgs...)
	if err != nil {
		return nil, fmt.Errorf("querying staff status: %w", err)
	}
	var order []string
	nameByID := map[string]string{}
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			rows.Close()
			return nil, err
		}
		nameByID[id] = name
		order = append(order, id)
	}
	rows.Close()

	// 2. today's clock events (in branch)
	now := time.Now()
	startToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	evArgs := []interface{}{startToday}
	evQ := `SELECT "userId", type, timestamp FROM "ClockEvent" WHERE timestamp >= $1`
	if branchID != "" && branchID != "ALL" {
		evQ += ` AND "branchId" = $2`
		evArgs = append(evArgs, branchID)
	}
	evQ += ` ORDER BY "userId", timestamp`
	evRows, err := r.db.QueryContext(ctx, evQ, evArgs...)
	if err != nil {
		return nil, fmt.Errorf("querying clock events: %w", err)
	}
	type evState struct {
		openIn  *time.Time
		todayMs int64
	}
	state := map[string]*evState{}
	for evRows.Next() {
		var uid, etype string
		var ts time.Time
		if err := evRows.Scan(&uid, &etype, &ts); err != nil {
			evRows.Close()
			return nil, err
		}
		st, ok := state[uid]
		if !ok {
			st = &evState{}
			state[uid] = st
		}
		if etype == "CLOCK_IN" {
			t := ts
			st.openIn = &t
		} else if etype == "CLOCK_OUT" && st.openIn != nil {
			st.todayMs += ts.Sub(*st.openIn).Milliseconds()
			st.openIn = nil
		}
	}
	evRows.Close()

	out := make([]*domain.StaffStatus, 0, len(order))
	for _, id := range order {
		st := &domain.StaffStatus{ID: id, Name: nameByID[id]}
		if s, ok := state[id]; ok {
			st.TodayMs = s.todayMs
			if s.openIn != nil {
				since := s.openIn.UTC().Format(time.RFC3339)
				st.Since = &since
				st.TodayMs += now.Sub(*s.openIn).Milliseconds()
			}
		}
		out = append(out, st)
	}
	return out, nil
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
		VALUES ($1, $2, $3, $4, CASE WHEN $5 > '1900-01-01'::timestamptz THEN $5 ELSE NOW() END, NOW())
		RETURNING id, timestamp`,
		e.UserID, e.TenantID, e.BranchID, e.Type, e.Timestamp,
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
		SELECT ce.id, ce."userId", u.name, ce."tenantId", ce."branchId", b.name, ce.type, ce.timestamp
		FROM "ClockEvent" ce
		JOIN "User" u ON u.id = ce."userId"
		JOIN "Branch" b ON b.id = ce."branchId"
		%s ORDER BY ce.timestamp DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	args = append(args, f.Limit, offset)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying events: %w", err)
	}
	defer rows.Close()

	var list []*domain.ClockEvent
	for rows.Next() {
		e := &domain.ClockEvent{}
		if err := rows.Scan(&e.ID, &e.UserID, &e.UserName, &e.TenantID, &e.BranchID, &e.BranchName, &e.Type, &e.Timestamp); err != nil {
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
