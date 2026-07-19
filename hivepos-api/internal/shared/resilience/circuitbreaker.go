// Package resilience provides a small, dependency-free CircuitBreaker for
// guarding outbound calls against a cascading dependency failure.
package resilience

import (
	"errors"
	"sync"
	"time"
)

// ErrCircuitOpen is returned by Do when the breaker is open (calls refused).
var ErrCircuitOpen = errors.New("circuit breaker open")

// CircuitBreaker is a minimal per-dependency breaker. It trips after `threshold`
// consecutive failures, fast-fails with ErrCircuitOpen for `cooldown`, then lets
// a single probe through (half-open): a probe success closes the breaker, a probe
// failure re-opens it.
//
// ponytail: in-memory, single-process. Ceiling: with multiple API replicas each
// has its own breaker state — upgrade to a shared store (Redis) if a fleet-level
// view of dependency health is needed.
type CircuitBreaker struct {
	mu        sync.Mutex
	threshold int
	cooldown  time.Duration
	failures  int
	state     cbState
	openedAt  time.Time
}

type cbState int

const (
	cbClosed cbState = iota
	cbOpen
	cbHalfOpen
)

// NewCircuitBreaker returns a breaker (defaults: threshold 5, cooldown 30s).
func NewCircuitBreaker(threshold int, cooldown time.Duration) *CircuitBreaker {
	if threshold <= 0 {
		threshold = 5
	}
	if cooldown <= 0 {
		cooldown = 30 * time.Second
	}
	return &CircuitBreaker{threshold: threshold, cooldown: cooldown}
}

// Do runs fn unless the breaker is open, then records the outcome.
func (cb *CircuitBreaker) Do(fn func() error) error {
	if !cb.allow() {
		return ErrCircuitOpen
	}
	err := fn()
	cb.record(err)
	return err
}

func (cb *CircuitBreaker) allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	switch cb.state {
	case cbClosed, cbHalfOpen:
		return true
	case cbOpen:
		if time.Since(cb.openedAt) >= cb.cooldown {
			cb.state = cbHalfOpen
			return true // let one probe through
		}
		return false
	}
	return true
}

func (cb *CircuitBreaker) record(err error) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if err == nil {
		cb.failures = 0
		cb.state = cbClosed
		return
	}
	cb.failures++
	if cb.state == cbHalfOpen {
		// probe failed → reopen
		cb.state = cbOpen
		cb.openedAt = time.Now()
		return
	}
	if cb.failures >= cb.threshold {
		cb.state = cbOpen
		cb.openedAt = time.Now()
	}
}
