import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify, type Algorithm } from '@node-rs/argon2';
import type { LoginInput, RegisterInput } from '@rum/shared';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { generateToken, sha256 } from '../common/crypto/tokens.js';
import { ApiException } from '../common/errors/api-exception.js';
import { DATABASE, type Database } from '../db/database.js';
import { refreshTokens, users } from '../db/schema.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const ARGON2_OPTIONS = {
  algorithm: 2 as Algorithm,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ckHl099EWQdrkAg/5QdOzA$XRv0fwcBfDRKhpngch573AvOvQPEByRsEfuYiHXdUWE';

export interface Session {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  async register({ email, password }: RegisterInput) {
    const passwordHash = await hash(password, ARGON2_OPTIONS);
    const [user] = await this.db
      .insert(users)
      .values({ email, passwordHash })
      .onConflictDoNothing()
      .returning({ id: users.id, email: users.email });
    if (!user) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'EMAIL_TAKEN',
        'An account with this email already exists',
      );
    }
    return user;
  }

  async login({ email, password }: LoginInput): Promise<Session> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    const valid = await verify(user?.passwordHash ?? DUMMY_HASH, password);
    if (!user || !valid) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }

    const next = newRefreshToken(user.id, randomUUID());
    await this.db.insert(refreshTokens).values(next.row);
    return this.session(user.id, next.token);
  }

  async refresh(presented: string | undefined): Promise<Session> {
    const rotated =
      presented &&
      (await this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, sha256(presented)))
          .for('update');
        if (!current) return null;

        if (current.replacedBy || current.revokedAt) {
          this.logger.warn(
            `Refresh token reuse: revoked family ${current.familyId} of user ${current.userId}`,
          );
          await tx
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(refreshTokens.familyId, current.familyId),
                isNull(refreshTokens.revokedAt),
              ),
            );
          return null;
        }
        if (current.expiresAt <= new Date()) return null;

        const next = newRefreshToken(current.userId, current.familyId);
        await tx.insert(refreshTokens).values(next.row);
        await tx
          .update(refreshTokens)
          .set({ replacedBy: next.row.id, revokedAt: new Date() })
          .where(eq(refreshTokens.id, current.id));
        return { userId: current.userId, token: next.token };
      }));

    if (!rotated) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_REFRESH_TOKEN',
        'Refresh token is invalid or expired',
      );
    }
    return this.session(rotated.userId, rotated.token);
  }

  async logout(userId: string, presented: string | undefined): Promise<void> {
    if (!presented) return;
    const family = this.db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, sha256(presented)),
          eq(refreshTokens.userId, userId),
        ),
      );
    await this.revoke(inArray(refreshTokens.familyId, family));
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revoke(eq(refreshTokens.userId, userId));
  }

  private async revoke(where: SQL): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(where, isNull(refreshTokens.revokedAt)));
  }

  private async session(userId: string, refreshToken: string) {
    return {
      accessToken: await this.jwt.signAsync({ sub: userId }),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    };
  }
}

function newRefreshToken(userId: string, familyId: string) {
  const token = generateToken();
  const row = {
    id: randomUUID(),
    userId,
    familyId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
  return { token, row };
}
