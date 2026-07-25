package superadmin

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"strings"

	"github.com/hivepos/api/internal/middleware"
)

// audit writes a best-effort row to "AuditLog" for a super-admin mutation.
//
// ponytail: best-effort — never fails the request on audit error (matches the
// existing impersonation-stop pattern). ceiling: one extra SELECT per audited
// request to resolve actor email (Claims has no email field). Upgrade path: add
// Email to auth.Claims to drop the lookup.
//
// AuditLog.actorId/actorEmail/targetId are NOT NULL with no default — the old
// stopImpersonation INSERT omitted them and silently failed (0 rows). This helper
// always supplies them.
func (m *Module) audit(r *http.Request, action, targetType, targetID, reason string) {
	if m == nil || m.db == nil {
		return
	}
	ctx := r.Context()
	actorID := middleware.GetUserID(r)
	if actorID == "" {
		return // nothing to attribute to; skip rather than violate NOT NULL
	}
	email := m.actorEmail(ctx, actorID)
	ip := clientIP(r)
	// best-effort: never fail the request — but log so a broken audit trail is observable.
	if _, err := m.db.ExecContext(ctx, `
INSERT INTO "AuditLog" (id, action, "targetType", "targetId", "actorId", "actorEmail", reason, "ipAddress", "createdAt")
VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''), NOW())`,
		action, targetType, targetID, actorID, email, reason, ip); err != nil {
		log.Printf("audit write failed (action=%s target=%s/%s): %v", action, targetType, targetID, err)
	}
}

// actorEmail resolves the super-admin's email by id. Empty string if missing —
// AuditLog.actorEmail is NOT NULL, so callers must have a real actorID (audit() guards on that).
func (m *Module) actorEmail(ctx context.Context, id string) string {
	var email string
	if err := m.db.QueryRowContext(ctx, `SELECT email FROM "SuperAdmin" WHERE id = $1`, id).Scan(&email); err != nil && err != sql.ErrNoRows {
		log.Printf("audit actor email lookup failed (id=%s): %v", id, err)
	}
	return email
}

// clientIP returns the caller IP, honoring a single X-Forwarded-For hop.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i >= 0 {
		host = host[:i]
	}
	return strings.Trim(host, "[]")
}

// ptrStr safely dereferences a *string for use as an audit targetID.
func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}