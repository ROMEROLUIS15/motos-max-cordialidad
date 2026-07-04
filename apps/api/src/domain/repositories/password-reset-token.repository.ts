export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface PasswordResetTokenRepository {
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Invalidates any previously issued, still-unused token for this user. */
  deleteUnusedForUser(userId: string): Promise<void>;
  /**
   * Atomically updates the user's password hash and marks the token as used,
   * returning the identity fields needed for the post-reset notification.
   */
  consumeAndUpdatePassword(
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<{ email: string; fullName: string }>;
  /** Deletes expired, unused tokens (used tokens are kept for audit). Returns how many were removed. */
  deleteExpiredUnused(): Promise<number>;
}

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PasswordResetTokenRepository');
