package domain

import (
	"strings"
	"time"
)

// DeriveTenantCode mirrors pos-saas lib/tenant-code.ts deriveTenantCode: a short uppercase
// code derived from the tenant slug, used as the order-number prefix (HBL-20260714-0001).
//   - 0 parts → "ORD"
//   - 1 part  → first 3 chars, uppercased
//   - multi   → first char of each part joined, uppercased, ≤5 chars
//
// ponytail: collisions possible across tenants sharing slug initials (two "Honey Bee Laundry"
// → HBL). System has few tenants today; add a Tenant.code column + uniqueness check if it grows.
func DeriveTenantCode(slug string) string {
	parts := make([]string, 0)
	for _, p := range strings.Split(slug, "-") {
		if p != "" {
			parts = append(parts, p)
		}
	}
	if len(parts) == 0 {
		return "ORD"
	}
	if len(parts) == 1 {
		s := parts[0]
		if len(s) > 3 {
			s = s[:3]
		}
		return strings.ToUpper(s)
	}
	var b strings.Builder
	for _, p := range parts {
		if len(p) > 0 {
			b.WriteByte(p[0])
		}
	}
	s := strings.ToUpper(b.String())
	if len(s) > 5 {
		s = s[:5]
	}
	return s
}

// OrderNumberPrefix builds the per-(tenant,date) order-number prefix "{CODE}-YYYYMMDD-" (UTC),
// matching pos-saas order-number.vo.ts orderNumberPrefix.
func OrderNumberPrefix(date time.Time, code string) string {
	return code + "-" + date.UTC().Format("20060102") + "-"
}
