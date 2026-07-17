package tickets

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	appauth "github.com/hivepos/api/internal/auth"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the tenant support-ticket domain. RBAC-free like the legacy
// pos-saas app: every logged-in tenant user (not SUPER_ADMIN) gets access.
type Module struct {
	db *sql.DB
}

func NewModule(db *sql.DB) *Module { return &Module{db: db} }

func (m *Module) Register(r chi.Router) {
	r.Get("/unread", m.unread)
	r.Post("/unread", m.markRead)
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.detail)
		r.Post("/comments", m.addComment)
		r.Post("/csat", m.setCSAT)
	})
}

// tenantUser resolves the calling user's id + tenantId, rejecting SUPER_ADMIN
// (super-admins use /api/super-admin/tickets). Mirrors requireTenantUser().
func tenantUser(req *http.Request) (userID, tenantID string, ok bool) {
	claims := appauth.GetClaims(req)
	if claims == nil || claims.UserID == "" || claims.Role == "SUPER_ADMIN" {
		return "", "", false
	}
	if claims.TenantID == "" {
		return "", "", false
	}
	return claims.UserID, claims.TenantID, true
}

func ts(t time.Time) string { return t.UTC().Format(time.RFC3339) }
func tsPtr(t sql.NullTime) *string {
	if !t.Valid {
		return nil
	}
	s := ts(t.Time)
	return &s
}

// GET /unread — admin-side ticket.* audit events since the user's last read.
func (m *Module) unread(w http.ResponseWriter, req *http.Request) {
	userID, tenantID, ok := tenantUser(req)
	if !ok {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	var lastRead sql.NullTime
	_ = m.db.QueryRowContext(req.Context(),
		`SELECT "lastTicketEventReadAt" FROM "User" WHERE id=$1`, userID).Scan(&lastRead)

	rows, err := m.db.QueryContext(req.Context(), `
		SELECT id, action, "targetId", COALESCE("actorEmail",''), "createdAt"
		FROM "AuditLog"
		WHERE "tenantId"=$1 AND action LIKE 'ticket.%' AND "actorId" <> $2
		  AND ($3::timestamp IS NULL OR "createdAt" > $3)
		ORDER BY "createdAt" DESC LIMIT 5`,
		tenantID, userID, lastRead)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	events := []TicketEvent{}
	for rows.Next() {
		var e TicketEvent
		var created time.Time
		if err := rows.Scan(&e.ID, &e.Kind, &e.TicketID, &e.ActorEmail, &created); err != nil {
			apphttp.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		e.CreatedAt = ts(created)
		events = append(events, e)
	}
	apphttp.Success(w, UnreadResult{
		UnreadCount: len(events),
		LastReadAt:  tsPtr(lastRead),
		Events:      events,
	})
}

// POST /unread — mark all current events read (stamp lastTicketEventReadAt).
func (m *Module) markRead(w http.ResponseWriter, req *http.Request) {
	userID, _, ok := tenantUser(req)
	if !ok {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	_, err := m.db.ExecContext(req.Context(),
		`UPDATE "User" SET "lastTicketEventReadAt"=$1 WHERE id=$2`, time.Now().UTC(), userID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{"ok": true})
}

// GET / — tickets the user submitted OR that belong to their tenant.
func (m *Module) list(w http.ResponseWriter, req *http.Request) {
	userID, tenantID, ok := tenantUser(req)
	if !ok {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	rows, err := m.db.QueryContext(req.Context(), `
		SELECT id, subject, description, category::text, priority::text, status::text,
		       "createdAt", "resolvedAt", "closedAt", "csatRating",
		       (SELECT count(*) FROM "TicketComment" tc WHERE tc."ticketId" = st.id)
		FROM "SupportTicket" st
		WHERE "submittedById"=$1 OR "tenantId"=$2
		ORDER BY "createdAt" DESC`, userID, tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []Summary{}
	for rows.Next() {
		var s Summary
		var resolved, closed sql.NullTime
		var csat sql.NullInt64
		if err := rows.Scan(&s.ID, &s.Subject, &s.Description, &s.Category, &s.Priority, &s.Status,
			&s.CreatedAt, &resolved, &closed, &csat, &s.CommentCount); err != nil {
			apphttp.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		s.ResolvedAt = tsPtr(resolved)
		s.ClosedAt = tsPtr(closed)
		if csat.Valid {
			v := int(csat.Int64)
			s.CSATRating = &v
		}
		out = append(out, s)
	}
	apphttp.Success(w, out)
}

// GET /{id} — detail + comments. Own ticket OR same tenant.
func (m *Module) detail(w http.ResponseWriter, req *http.Request) {
	userID, tenantID, ok := tenantUser(req)
	if !ok {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	id := chi.URLParam(req, "id")
	var d Detail
	var resolved, closed sql.NullTime
	var csat sql.NullInt64
	var csatComment sql.NullString
	var submittedByID, ticketTenant sql.NullString
	err := m.db.QueryRowContext(req.Context(), `
		SELECT id, subject, description, category::text, priority::text, status::text,
		       "createdAt", "resolvedAt", "closedAt", "csatRating", "csatComment",
		       "submitterName", "submitterEmail", "submittedById", "tenantId"
		FROM "SupportTicket" WHERE id=$1`, id).
		Scan(&d.ID, &d.Subject, &d.Description, &d.Category, &d.Priority, &d.Status,
			&d.CreatedAt, &resolved, &closed, &csat, &csatComment,
			&d.SubmitterName, &d.SubmitterEmail, &submittedByID, &ticketTenant)
	if err == sql.ErrNoRows {
		apphttp.NotFoundError(w, "SupportTicket not found")
		return
	}
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// ponytail: scope check — own ticket OR same tenant. Prevents cross-tenant leak.
	if submittedByID.String != userID && ticketTenant.String != tenantID {
		apphttp.ForbiddenError(w, "You do not have access to this ticket")
		return
	}
	d.ResolvedAt = tsPtr(resolved)
	d.ClosedAt = tsPtr(closed)
	if csat.Valid {
		v := int(csat.Int64)
		d.CSATRating = &v
	}
	if csatComment.Valid {
		s := csatComment.String
		d.CSATComment = &s
	}

	crows, err := m.db.QueryContext(req.Context(), `
		SELECT id, "authorName", "authorRole", body, "createdAt"
		FROM "TicketComment" WHERE "ticketId"=$1 ORDER BY "createdAt" ASC`, id)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer crows.Close()
	d.Comments = []Comment{}
	for crows.Next() {
		var c Comment
		var created time.Time
		if err := crows.Scan(&c.ID, &c.AuthorName, &c.AuthorRole, &c.Body, &created); err != nil {
			apphttp.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		c.CreatedAt = ts(created)
		d.Comments = append(d.Comments, c)
	}
	apphttp.Success(w, d)
}

// POST / — create a ticket. Refresh name/email/phone from DB for the snapshot.
func (m *Module) create(w http.ResponseWriter, req *http.Request) {
	userID, tenantID, ok := tenantUser(req)
	if !ok {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	var body struct {
		Subject     string `json:"subject"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Priority    string `json:"priority"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if body.Subject == "" {
		apphttp.ValidationError(w, "subject is required")
		return
	}
	var name, email sql.NullString
	var phone sql.NullString
	_ = m.db.QueryRowContext(req.Context(),
		`SELECT name, email, phone FROM "User" WHERE id=$1`, userID).Scan(&name, &email, &phone)

	var id string
	err := m.db.QueryRowContext(req.Context(), `
		INSERT INTO "SupportTicket" (id, subject, description, category, priority, status,
		    "tenantId", "submitterName", "submitterEmail", "submitterPhone", "submittedById", "userAgent", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,'OPEN',$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`,
		newID(), body.Subject, body.Description, def(body.Category, "OTHER"), def(body.Priority, "NORMAL"),
		tenantID, name.String, email.String, phone.String, userID, req.UserAgent(), time.Now().UTC()).Scan(&id)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, map[string]any{"id": id})
}

// POST /{id}/comments — tenant reply; reopens RESOLVED/CLOSED tickets.
func (m *Module) addComment(w http.ResponseWriter, req *http.Request) {
	userID, tenantID, ok := tenantUser(req)
	if !ok {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	id := chi.URLParam(req, "id")
	var body struct{ Body string `json:"body"` }
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if body.Body == "" {
		apphttp.ValidationError(w, "body is required")
		return
	}
	var status string
	var submittedByID sql.NullString
	var ticketTenant sql.NullString
	err := m.db.QueryRowContext(req.Context(),
		`SELECT status, "submittedById", "tenantId" FROM "SupportTicket" WHERE id=$1`, id).
		Scan(&status, &submittedByID, &ticketTenant)
	if err == sql.ErrNoRows {
		apphttp.NotFoundError(w, "SupportTicket not found")
		return
	}
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if submittedByID.String != userID && ticketTenant.String != tenantID {
		apphttp.ForbiddenError(w, "You do not have access to this ticket")
		return
	}

	tx, err := m.db.BeginTx(req.Context(), nil)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	if status == "RESOLVED" || status == "CLOSED" {
		if _, err := tx.Exec(`UPDATE "SupportTicket" SET status='OPEN', "resolvedAt"=NULL, "updatedAt"=$1 WHERE id=$2`,
			time.Now().UTC(), id); err != nil {
			apphttp.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	var name, email sql.NullString
	_ = tx.QueryRow(`SELECT name, email FROM "User" WHERE id=$1`, userID).Scan(&name, &email)
	var c Comment
	var created time.Time
	err = tx.QueryRow(`
		INSERT INTO "TicketComment" (id, "ticketId", "authorName", "authorEmail", "authorRole", body, "createdAt")
		VALUES ($1,$2,$3,$4,'TENANT_USER',$5,$6)
		RETURNING id, "authorName", "authorRole", body, "createdAt"`,
		newID(), id, name.String, email.String, body.Body, time.Now().UTC()).
		Scan(&c.ID, &c.AuthorName, &c.AuthorRole, &c.Body, &created)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := tx.Commit(); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	c.CreatedAt = ts(created)
	apphttp.Created(w, c)
}

// POST /{id}/csat — submitter rates a RESOLVED/CLOSED ticket (once).
func (m *Module) setCSAT(w http.ResponseWriter, req *http.Request) {
	userID, _, ok := tenantUser(req)
	if !ok {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}
	id := chi.URLParam(req, "id")
	var body struct {
		Rating   int    `json:"rating"`
		Comment  string `json:"comment"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	var submittedByID sql.NullString
	var status string
	var csat sql.NullInt64
	err := m.db.QueryRowContext(req.Context(),
		`SELECT "submittedById", status, "csatRating" FROM "SupportTicket" WHERE id=$1`, id).
		Scan(&submittedByID, &status, &csat)
	if err == sql.ErrNoRows {
		apphttp.NotFoundError(w, "SupportTicket not found")
		return
	}
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if submittedByID.String != userID {
		apphttp.ForbiddenError(w, "Only the submitter can rate this ticket")
		return
	}
	if status != "RESOLVED" && status != "CLOSED" {
		apphttp.ForbiddenError(w, "Ticket must be resolved before rating")
		return
	}
	if csat.Valid {
		apphttp.ForbiddenError(w, "This ticket has already been rated")
		return
	}
	_, err = m.db.ExecContext(req.Context(),
		`UPDATE "SupportTicket" SET "csatRating"=$1, "csatComment"=$2, "csatAt"=$3 WHERE id=$4`,
		body.Rating, nullable(body.Comment), time.Now().UTC(), id)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{"id": id, "csatRating": body.Rating})
}

// --- small helpers ---

func def(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}
func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}
func newID() string {
	var b [9]byte
	_, _ = rand.Read(b[:])
	return "tck_" + hex.EncodeToString(b[:])
}
