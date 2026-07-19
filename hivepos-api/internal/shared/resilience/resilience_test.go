package resilience

import (
	"errors"
	"testing"
	"time"
)

var errTransient = errors.New("transient")

func TestCircuitBreaker_OpensAfterThreshold(t *testing.T) {
	cb := NewCircuitBreaker(2, time.Minute)
	fail := func() error { return errTransient }
	if err := cb.Do(fail); !errors.Is(err, errTransient) {
		t.Fatalf("1st: err=%v", err)
	}
	if err := cb.Do(fail); !errors.Is(err, errTransient) {
		t.Fatalf("2nd: err=%v", err)
	} // threshold reached → open
	if err := cb.Do(fail); !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("3rd: err=%v, want ErrCircuitOpen", err)
	}
}

func TestCircuitBreaker_HalfOpenProbeCloses(t *testing.T) {
	cb := NewCircuitBreaker(1, time.Millisecond)
	_ = cb.Do(func() error { return errTransient }) // open
	time.Sleep(5 * time.Millisecond)                 // cooldown elapsed → half-open on next allow
	if err := cb.Do(func() error { return nil }); err != nil { // successful probe
		t.Fatalf("probe: err=%v, want nil", err)
	}
	// closed now — breaker no longer refuses calls
	if err := cb.Do(func() error { return nil }); err != nil {
		t.Fatalf("post-close: err=%v, want nil", err)
	}
}

func TestCircuitBreaker_HalfOpenProbeReopens(t *testing.T) {
	cb := NewCircuitBreaker(1, time.Millisecond)
	_ = cb.Do(func() error { return errTransient }) // open
	time.Sleep(5 * time.Millisecond)                // half-open
	_ = cb.Do(func() error { return errTransient }) // probe fails → reopen
	if err := cb.Do(func() error { return nil }); !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("after failed probe: err=%v, want ErrCircuitOpen", err)
	}
}
