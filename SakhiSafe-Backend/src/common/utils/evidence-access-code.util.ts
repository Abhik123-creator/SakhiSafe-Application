import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const ACCESS_CODE_LENGTH = 6;

export function generateEvidenceAccessCode() {
  return String(randomInt(0, 1_000_000)).padStart(ACCESS_CODE_LENGTH, '0');
}

export function normalizeEvidenceAccessCode(code?: string | null) {
  return code?.replace(/\D/g, '').trim() ?? '';
}

export function isEvidenceAccessCodeFormat(code?: string | null) {
  return /^\d{6}$/.test(normalizeEvidenceAccessCode(code));
}

export function hashEvidenceAccessCode(code: string, secret: string) {
  return createHmac('sha256', secret).update(normalizeEvidenceAccessCode(code)).digest('hex');
}

export function verifyEvidenceAccessCode(code: string, expectedHash: string, secret: string) {
  const actualHash = hashEvidenceAccessCode(code, secret);
  const actual = Buffer.from(actualHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function maskEvidenceAccessCode(code: string) {
  const normalized = normalizeEvidenceAccessCode(code);
  return normalized.length === ACCESS_CODE_LENGTH ? `****${normalized.slice(-2)}` : '******';
}
