import bcrypt from "bcrypt";

/**
 * Cost factor used when hashing user passwords.
 *
 * Centralized so that every call site (user create, user update, password
 * reset, …) hashes with the same strength. Bumping this value is a one-line
 * change that takes effect on the next password write.
 */
export const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext password using the project's standard cost factor.
 */
export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored hash.
 */
export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
