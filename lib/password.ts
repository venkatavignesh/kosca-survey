import bcrypt from 'bcryptjs';

export const PASSWORD_POLICY = {
  minLength: 8,
  needsLetter: true,
  needsDigit: true,
  needsSymbol: true,
};

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_POLICY.minLength) {
    return `Password must be at least ${PASSWORD_POLICY.minLength} characters.`;
  }
  if (PASSWORD_POLICY.needsLetter && !/[A-Za-z]/.test(password)) {
    return 'Password must contain a letter.';
  }
  if (PASSWORD_POLICY.needsDigit && !/[0-9]/.test(password)) {
    return 'Password must contain a digit.';
  }
  if (PASSWORD_POLICY.needsSymbol && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain a symbol.';
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const symbols = '!@#$%^&*';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  out += symbols[Math.floor(Math.random() * symbols.length)];
  out += Math.floor(Math.random() * 10);
  return out;
}
