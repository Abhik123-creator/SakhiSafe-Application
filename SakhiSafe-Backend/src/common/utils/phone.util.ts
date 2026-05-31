export function normalizePhone(phone?: string | null) {
  const normalized = phone?.replace(/\D/g, '') ?? '';
  return normalized.length > 0 ? normalized : undefined;
}

export function isAnonymousName(name?: string | null) {
  return name?.trim().toLowerCase() === 'anonymous';
}
