package application

import "golang.org/x/crypto/bcrypt"

// hashPassword generates a bcrypt hash from a plaintext password or PIN.
// Shared by the password and PIN code paths.
func hashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
