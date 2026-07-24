import express from 'express';
import request from 'supertest';

import { AuthService, requireAuth, type AuthedRequest } from '../../src/api/auth';

describe('AuthService', () => {
  const auth = new AuthService('test-secret');

  it('FR-USR-03: hashes a password so the plaintext is not recoverable from the stored value', async () => {
    const hash = await auth.hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('FR-USR-02: verifyPassword accepts the right password and rejects the wrong one', async () => {
    const hash = await auth.hashPassword('the-real-password');
    expect(await auth.verifyPassword('the-real-password', hash)).toBe(true);
    expect(await auth.verifyPassword('wrong-guess', hash)).toBe(false);
  });

  it('FR-USR-02: signSession/verifySession round-trip the OPEN-12 identifier', () => {
    const token = auth.signSession('507f1f77bcf86cd799439011');
    expect(auth.verifySession(token)).toBe('507f1f77bcf86cd799439011');
  });

  it('FR-USR-04: verifySession rejects a token signed with a different secret', () => {
    const other = new AuthService('a-different-secret');
    const token = other.signSession('someone');
    expect(auth.verifySession(token)).toBeUndefined();
  });

  it('verifySession rejects garbage input rather than throwing', () => {
    expect(auth.verifySession('not-a-jwt')).toBeUndefined();
  });
});

describe('requireAuth middleware', () => {
  const auth = new AuthService('mw-secret');
  const app = express();
  app.get('/protected', requireAuth(auth), (req: AuthedRequest, res) => {
    res.json({ userId: req.userId });
  });

  it('FR-USR-04: rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('FR-USR-04: rejects an invalid token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('FR-USR-04: accepts a valid token and attaches userId to the request', async () => {
    const token = auth.signSession('user-abc');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-abc');
  });
});
