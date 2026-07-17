package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	apphttp "github.com/hivepos/api/internal/shared/http"
)

// RateLimit returns a middleware that allows max `limit` requests per `window` per IP.
// ponytail: in-memory (per-process). Upgrade to Redis for multi-instance.
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	type bucket struct {
		count  int
		reset  time.Time
	}
	var mu sync.Mutex
	ips := make(map[string]*bucket)

	// Lazy cleanup: drop expired buckets every `window`.
	go func() {
		t := time.NewTicker(window)
		defer t.Stop()
		for range t.C {
			mu.Lock()
			now := time.Now()
			for ip, b := range ips {
				if now.After(b.reset) {
					delete(ips, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			mu.Lock()
			b, ok := ips[ip]
			now := time.Now()
			if !ok || now.After(b.reset) {
				ips[ip] = &bucket{count: 1, reset: now.Add(window)}
				mu.Unlock()
				next.ServeHTTP(w, r)
				return
			}
			b.count++
			remaining := limit - b.count
			mu.Unlock()

			if remaining < 0 {
				w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
				apphttp.Error(w, http.StatusTooManyRequests, "Too many requests. Slow down.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// clientIP extracts the client IP from the request (X-Forwarded-For or RemoteAddr).
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// First IP in the chain.
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}
	host := r.RemoteAddr
	for i := len(host) - 1; i >= 0; i-- {
		if host[i] == ':' {
			return host[:i]
		}
	}
	return host
}
