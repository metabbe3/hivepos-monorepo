package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Prometheus metrics for RED-style observability (rate, errors, duration).
// Scraped at /metrics (registered in internal/router). ponytail: in-process
// registry — fine for one replica; for >1 replica run a Prometheus sidecar that
// scrapes each pod (the registry is per-process, not shared).

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests by method, route, and status.",
	}, []string{"method", "route", "status"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency in seconds by method and route.",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "route"})
)

// Metrics records http_requests_total and http_request_duration_seconds for every
// request. Reuses the in-package statusCapture to read the final status. Route is
// the chi route pattern (e.g. /api/orders/{id}) so label cardinality stays bounded;
// falls back to "unmatched" for 404s / routes with no pattern.
func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sc := &statusCapture{ResponseWriter: w, status: 0}
		next.ServeHTTP(sc, r)

		route := chi.RouteContext(r.Context()).RoutePattern()
		if route == "" {
			route = "unmatched"
		}
		status := sc.status
		if status == 0 {
			status = http.StatusOK
		}
		httpRequestsTotal.WithLabelValues(r.Method, route, strconv.Itoa(status)).Inc()
		httpRequestDuration.WithLabelValues(r.Method, route).Observe(time.Since(start).Seconds())
	})
}
