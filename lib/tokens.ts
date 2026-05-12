import crypto from 'crypto';

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateConfirmCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
