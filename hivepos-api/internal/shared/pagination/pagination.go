// Package pagination centralizes list-request math so every paginated endpoint
// clamps and reports the same way. Replaces the duplicated page/limit blocks
// across the domain modules.
package pagination

const (
	DefaultLimit = 20
	MaxLimit     = 100
)

// Normalize clamps page (>=1) and limit (1..MaxLimit, default DefaultLimit) and
// returns (page, limit, offset) where offset is the SQL row offset.
func Normalize(page, limit int) (int, int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = DefaultLimit
	}
	if limit > MaxLimit {
		limit = MaxLimit
	}
	return page, limit, (page - 1) * limit
}

// MetaNoLimit is like Meta but omits "limit" — some TS endpoints (e.g. orders)
// return { total, page, totalPages } without limit.
func MetaNoLimit(total, page, limit int) map[string]any {
	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}
	return map[string]any{
		"total":      total,
		"page":       page,
		"totalPages": totalPages,
	}
}

// Meta builds the response meta map for a paginated list, including totalPages.
// Matches the TS ResponseMeta shape ({ page, limit, total, totalPages }).
func Meta(total, page, limit int) map[string]any {
	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}
	return map[string]any{
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	}
}
