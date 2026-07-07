package application

import "golang.org/x/crypto/bcrypt"

// hashPIN generates a bcrypt hash from a plaintext PIN.
// Same algorithm as password hashing in the auth module.
func hashPIN(pin string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// comparePIN verifies a plaintext PIN against a stored bcrypt hash.
// Returns nil on a match, bcrypt.ErrMismatchedHashAndPassword otherwise.
func comparePIN(pin, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pin))
}
