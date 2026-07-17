package tickets

// Tenant ticket shapes mirror the legacy pos-saas /api/tickets contract
// (lib/tickets-tenant.ts) so the ported web client works unchanged.

type Summary struct {
	ID          string  `json:"id"`
	Subject     string  `json:"subject"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	Priority    string  `json:"priority"`
	Status      string  `json:"status"`
	CreatedAt   string  `json:"createdAt"`
	ResolvedAt  *string `json:"resolvedAt"`
	ClosedAt    *string `json:"closedAt"`
	CSATRating  *int    `json:"csatRating"`
	CommentCount int    `json:"commentCount"`
}

type Comment struct {
	ID         string `json:"id"`
	AuthorName string `json:"authorName"`
	AuthorRole string `json:"authorRole"`
	Body       string `json:"body"`
	CreatedAt  string `json:"createdAt"`
}

type Detail struct {
	Summary
	CSATComment   *string   `json:"csatComment"`
	SubmitterName string    `json:"submitterName"`
	SubmitterEmail string   `json:"submitterEmail"`
	Comments      []Comment `json:"comments"`
}

type TicketEvent struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	TicketID   string `json:"ticketId"`
	ActorEmail string `json:"actorEmail"`
	CreatedAt  string `json:"createdAt"`
}

type UnreadResult struct {
	UnreadCount int            `json:"unreadCount"`
	LastReadAt  *string        `json:"lastReadAt"`
	Events      []TicketEvent  `json:"events"`
}
