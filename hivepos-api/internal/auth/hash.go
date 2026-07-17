package auth

import "golang.org/x/crypto/bcrypt"

// HashPassword bcrypts a plaintext password or PIN (mirrors the TS hashing).
// bcrypt's input ceiling is 72 bytes; longer inputs are truncated so a long
// password never yields a 500 (parity with bcryptjs, which truncates silently).
func HashPassword(plain string) (string, error) {
	if len(plain) > 72 {
		plain = plain[:72]
	}
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	return string(b), err
}

// ComparePassword verifies a plaintext password against a stored bcrypt hash.
// Returns nil on a match, bcrypt.ErrMismatchedHashAndPassword otherwise.
func ComparePassword(hash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}
