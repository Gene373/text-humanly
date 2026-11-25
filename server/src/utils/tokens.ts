import { createHash, randomBytes } from 'node:crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
}
