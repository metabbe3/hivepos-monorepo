package infrastructure

import (
	"database/sql"
	"testing"
	"time"
)

func TestOutletStatus(t *testing.T) {
	now := time.Date(2026, 7, 28, 0, 0, 0, 0, time.UTC)
	cases := []struct {
		name       string
		coverageEnd sql.NullTime
		isFreeTier bool
		wantStatus string
		wantDays   *int
	}{
		{"free tier", sql.NullTime{}, true, "FREE", nil},
		{"no coverage", sql.NullTime{}, false, "FREE", nil},
		{"active far future", sql.NullTime{Valid: true, Time: now.AddDate(0, 0, 60)}, false, "ACTIVE", intPtr(60)},
		{"expiring boundary 14", sql.NullTime{Valid: true, Time: now.AddDate(0, 0, 14)}, false, "EXPIRING", intPtr(14)},
		{"expiring within", sql.NullTime{Valid: true, Time: now.AddDate(0, 0, 3)}, false, "EXPIRING", intPtr(3)},
		{"locked day 0", sql.NullTime{Valid: true, Time: now.AddDate(0, 0, -1)}, false, "LOCKED", intPtr(-1)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gotStatus, gotDays := outletStatus(c.coverageEnd, c.isFreeTier, now)
			if gotStatus != c.wantStatus {
				t.Errorf("status = %q, want %q", gotStatus, c.wantStatus)
			}
			if !sameIntPtr(gotDays, c.wantDays) {
				t.Errorf("expiresInDays = %v, want %v", ptrVal(gotDays), ptrVal(c.wantDays))
			}
		})
	}
}

func intPtr(n int) *int { return &n }

func sameIntPtr(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func ptrVal(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}
