package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"golang.org/x/crypto/hkdf"
)

// Auth.js v5 (@auth/core/jwt) issues JWE-encrypted session tokens, NOT plain
// signed JWTs. Parameters (mirroring @auth/core/jwt encode/decode):
//   alg = "dir"            (CEK is the derived key directly; no key-wrapping)
//   enc = "A256CBC-HS512"  (AES_256_CBC_HMAC_SHA512, RFC 7518 §5.2)
//   CEK  = HKDF-SHA256(secret, salt, info, 64)
//   salt = "authjs.session-token"
//   info = "Auth.js Generated Encryption Key (authjs.session-token)"
// CEK layout (A256CBC-HS512): first 32 bytes = HMAC-SHA512 key, last 32 = AES-256 key.
// Auth tag = first 32 bytes of HMAC-SHA512(MACkey, AAD || IV || C), AAD = base64url protected header.

const nextAuthSalt = "authjs.session-token"

func nextAuthInfo(salt string) []byte {
	return []byte("Auth.js Generated Encryption Key (" + salt + ")")
}

// cekRaw derives the 64-byte content-encryption key Auth.js uses. Auth.js calls
// hkdf("sha256", secret, salt, info, 64) — so HKDF-SHA256, not SHA-512.
func cekRaw(secret, salt string) ([]byte, error) {
	cek := make([]byte, 64)
	r := hkdf.New(sha256.New, []byte(secret), []byte(salt), nextAuthInfo(salt))
	if _, err := io.ReadFull(r, cek); err != nil {
		return nil, fmt.Errorf("nextauth: hkdf: %w", err)
	}
	return cek, nil
}

// EncodeNextAuth encrypts claims into an Auth.js v5 JWE token. The protected
// header omits `kid`, so Auth.js's decoder accepts it via its kid===undefined
// fast path — meaning tokens Go issues validate in the TS app too.
func EncodeNextAuth(claims *Claims, secret string, maxAgeSeconds int64) (string, error) {
	return encodeNextAuth(claims, secret, nextAuthSalt, maxAgeSeconds)
}

// DecodeNextAuth decrypts an Auth.js v5 JWE token (TS/NextAuth-issued) into Claims.
func DecodeNextAuth(tokenStr, secret string) (*Claims, error) {
	return decodeNextAuth(tokenStr, secret, nextAuthSalt)
}

func encodeNextAuth(claims *Claims, secret, salt string, maxAgeSeconds int64) (string, error) {
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("nextauth: marshal claims: %w", err)
	}

	cek, err := cekRaw(secret, salt)
	if err != nil {
		return "", err
	}
	macKey, encKey := cek[:32], cek[32:]

	protected, err := json.Marshal(map[string]string{"alg": "dir", "enc": "A256CBC-HS512"})
	if err != nil {
		return "", err
	}
	protectedB64 := base64.RawURLEncoding.EncodeToString(protected)

	// AES-256-CBC with PKCS#7 padding, random 128-bit IV.
	iv := make([]byte, aes.BlockSize)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	padded := pkcs7Pad(payload, aes.BlockSize)
	block, err := aes.NewCipher(encKey)
	if err != nil {
		return "", err
	}
	ciphertext := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, padded)

	// Auth tag = first 32 bytes of HMAC-SHA512(macKey, AAD || IV || C || u64be(len(AAD)*8)).
	// The trailing 64-bit AAD bit-length is the McGrew AES_CBC_HMAC_SHA2 "al" field
	// (jose content_encryption.js cbcEncrypt appends uint64be(aad.length << 3)).
	h := hmac.New(sha512.New, macKey)
	h.Write([]byte(protectedB64))
	h.Write(iv)
	h.Write(ciphertext)
	h.Write(u64be(uint64(len(protectedB64)) << 3))
	tag := h.Sum(nil)[:32]

	var b strings.Builder
	b.WriteString(protectedB64)
	b.WriteByte('.')
	b.WriteString("") // encrypted key — empty for "dir"
	b.WriteByte('.')
	b.WriteString(base64.RawURLEncoding.EncodeToString(iv))
	b.WriteByte('.')
	b.WriteString(base64.RawURLEncoding.EncodeToString(ciphertext))
	b.WriteByte('.')
	b.WriteString(base64.RawURLEncoding.EncodeToString(tag))
	return b.String(), nil
}

func decodeNextAuth(tokenStr, secret, salt string) (*Claims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 5 {
		return nil, fmt.Errorf("nextauth: expected 5-part JWE, got %d", len(parts))
	}
	protectedB64 := parts[0]
	// parts[1] is empty for "dir".
	iv, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("nextauth: iv: %w", err)
	}
	ciphertext, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil {
		return nil, fmt.Errorf("nextauth: ciphertext: %w", err)
	}
	tag, err := base64.RawURLEncoding.DecodeString(parts[4])
	if err != nil {
		return nil, fmt.Errorf("nextauth: tag: %w", err)
	}

	protected, err := base64.RawURLEncoding.DecodeString(protectedB64)
	if err != nil {
		return nil, fmt.Errorf("nextauth: protected header: %w", err)
	}
	var hdr struct {
		Alg string `json:"alg"`
		Enc string `json:"enc"`
	}
	if err := json.Unmarshal(protected, &hdr); err != nil {
		return nil, fmt.Errorf("nextauth: header json: %w", err)
	}
	if hdr.Alg != "dir" || hdr.Enc != "A256CBC-HS512" {
		return nil, fmt.Errorf("nextauth: unsupported alg/enc %s/%s", hdr.Alg, hdr.Enc)
	}

	cek, err := cekRaw(secret, salt)
	if err != nil {
		return nil, err
	}
	macKey, encKey := cek[:32], cek[32:]

	if len(iv) != aes.BlockSize || len(ciphertext)%aes.BlockSize != 0 || len(ciphertext) == 0 {
		return nil, fmt.Errorf("nextauth: bad ciphertext/iv lengths")
	}

	// Verify auth tag (constant time): HMAC-SHA512(macKey, AAD || IV || C || u64be(len(AAD)*8))[:32].
	h := hmac.New(sha512.New, macKey)
	h.Write([]byte(protectedB64))
	h.Write(iv)
	h.Write(ciphertext)
	h.Write(u64be(uint64(len(protectedB64)) << 3))
	expected := h.Sum(nil)[:32]
	if subtle.ConstantTimeCompare(expected, tag) != 1 {
		return nil, fmt.Errorf("nextauth: auth tag mismatch (wrong secret?)")
	}

	// AES-256-CBC decrypt + strip PKCS#7.
	block, err := aes.NewCipher(encKey)
	if err != nil {
		return nil, err
	}
	padded := make([]byte, len(ciphertext))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(padded, ciphertext)
	plain, err := pkcs7Unpad(padded, aes.BlockSize)
	if err != nil {
		return nil, fmt.Errorf("nextauth: %w", err)
	}

	c := &Claims{}
	if err := json.Unmarshal(plain, c); err != nil {
		return nil, fmt.Errorf("nextauth: claims json: %w", err)
	}
	return c, nil
}

// u64be returns v as an 8-byte big-endian slice (the JWE AAD length encoding).
func u64be(v uint64) []byte {
	return []byte{byte(v >> 56), byte(v >> 48), byte(v >> 40), byte(v >> 32),
		byte(v >> 24), byte(v >> 16), byte(v >> 8), byte(v)}
}

func pkcs7Pad(b []byte, blockSize int) []byte {
	pad := blockSize - len(b)%blockSize
	out := make([]byte, len(b)+pad)
	copy(out, b)
	for i := len(b); i < len(out); i++ {
		out[i] = byte(pad)
	}
	return out
}

func pkcs7Unpad(b []byte, blockSize int) ([]byte, error) {
	if len(b) == 0 || len(b)%blockSize != 0 {
		return nil, fmt.Errorf("invalid padding length")
	}
	pad := int(b[len(b)-1])
	if pad < 1 || pad > blockSize || pad > len(b) {
		return nil, fmt.Errorf("invalid padding value")
	}
	return b[:len(b)-pad], nil
}
