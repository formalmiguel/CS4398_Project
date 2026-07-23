/**
 * FR-USR-02/03, FR-USR-04's mechanism. Password hashing (bcrypt, NFR-SEC-02) and session
 * issuance/verification (JWT, `jsonwebtoken`) are kept together because both are "how the
 * System knows who is asking" — but neither reaches into `TaskRepository` or `UserStore`, so
 * this file has no persistence of its own.
 *
 * The session payload's `sub` claim IS OPEN-12's identifier — the Mongo `_id` of the `User`
 * document, stringified. Nothing about the email reaches the token.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

const SALT_ROUNDS = 12;
const SESSION_LIFETIME = '7d';

export interface AuthedRequest extends Request {
  userId?: string;
}

export class AuthService {
  constructor(private readonly jwtSecret: string) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /** FR-USR-03: the plaintext is never recoverable from what this compares against. */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** FR-USR-02: "establish a session." A signed, stateless JWT carrying OPEN-12's identifier. */
  signSession(userId: string): string {
    return jwt.sign({ sub: userId }, this.jwtSecret, { expiresIn: SESSION_LIFETIME });
  }

  /** Returns the userId the token was signed for, or undefined if invalid, expired, or malformed. */
  verifySession(token: string): string | undefined {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      if (typeof payload === 'object' && payload !== null && typeof payload.sub === 'string') {
        return payload.sub;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}

/** FR-USR-04's mechanism: no valid session, no access — to anything past this middleware. */
export const requireAuth =
  (auth: AuthService) =>
  (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.header('Authorization');
    if (header === undefined || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'missing bearer token' });
      return;
    }
    const userId = auth.verifySession(header.slice('Bearer '.length));
    if (userId === undefined) {
      res.status(401).json({ error: 'invalid or expired session' });
      return;
    }
    req.userId = userId;
    next();
  };
