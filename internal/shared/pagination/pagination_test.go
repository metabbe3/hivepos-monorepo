package pagination_test

import (
	"testing"

	"github.com/hivepos/api/internal/shared/pagination"
)

func TestNormalize(t *testing.T) {
	tests := []struct {
		name        string
		page, limit int
		wantPage    int
		wantLimit   int
		wantOffset  int
	}{
		{"defaults zero", 0, 0, 1, pagination.DefaultLimit, 0},
		{"negative clamps", -3, -5, 1, pagination.DefaultLimit, 0},
		{"page2 limit10", 2, 10, 2, 10, 10},
		{"page3 limit20", 3, 20, 3, 20, 40},
		{"limit over max clamps", 1, 9999, 1, pagination.MaxLimit, 0},
		{"limit exactly max", 2, pagination.MaxLimit, 2, pagination.MaxLimit, pagination.MaxLimit},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			p, l, off := pagination.Normalize(tc.page, tc.limit)
			if p != tc.wantPage || l != tc.wantLimit || off != tc.wantOffset {
				t.Fatalf("Normalize(%d,%d) = (%d,%d,%d), want (%d,%d,%d)",
					tc.page, tc.limit, p, l, off, tc.wantPage, tc.wantLimit, tc.wantOffset)
			}
		})
	}
}

func TestMeta(t *testing.T) {
	m := pagination.Meta(105, 2, 20)
	if m["total"].(int) != 105 || m["page"].(int) != 2 || m["limit"].(int) != 20 {
		t.Fatalf("meta basic fields wrong: %v", m)
	}
	if m["totalPages"].(int) != 6 { // 105/20 = 5.25 → 6
		t.Fatalf("totalPages = %v, want 6", m["totalPages"])
	}
	// Exact multiple: 100/20 = 5 pages, no phantom page.
	if got := pagination.Meta(100, 1, 20)["totalPages"].(int); got != 5 {
		t.Fatalf("exact totalPages = %d, want 5", got)
	}
	// Zero total → zero pages, no division panic.
	if got := pagination.Meta(0, 1, 20)["totalPages"].(int); got != 0 {
		t.Fatalf("zero-total totalPages = %d, want 0", got)
	}
	// Zero limit guard → zero pages (no divide-by-zero).
	if got := pagination.Meta(10, 1, 0)["totalPages"].(int); got != 0 {
		t.Fatalf("zero-limit totalPages = %d, want 0", got)
	}
}
