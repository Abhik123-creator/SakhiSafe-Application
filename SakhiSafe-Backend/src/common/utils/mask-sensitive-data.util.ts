const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'accessCode',
  'authorization',
  'phone',
  'name',
  'fullName',
  'address',
  'notes',
  'caseNotes',
  'message',
  'messageContent',
  'incidentDescription',
  'evidence',
  'evidenceAccessCode',
  'evidenceAccessCodeHash',
  'oneTimeEvidenceAccessCode',
  'evidenceData',
  'safetyNotes',
];

const FULL_REDACT_KEYS = [
  'accessCode',
  'evidenceAccessCode',
  'evidenceAccessCodeHash',
  'oneTimeEvidenceAccessCode',
  'x-evidence-access-code',
];

export function maskValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (text.length <= 4) {
    return '****';
  }
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

export function maskSensitiveData<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => maskSensitiveData(item)) as T;
  }

  if (!input || typeof input !== 'object') {
    return input;
  }

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => {
      const loweredKey = key.toLowerCase();
      const normalizedKey = loweredKey.replace(/[^a-z0-9]/g, '');
      if (
        FULL_REDACT_KEYS.some((sensitiveKey) => {
          const loweredSensitiveKey = sensitiveKey.toLowerCase();
          return loweredKey.includes(loweredSensitiveKey) || normalizedKey.includes(loweredSensitiveKey.replace(/[^a-z0-9]/g, ''));
        })
      ) {
        return [key, '[REDACTED]'];
      }
      if (SENSITIVE_KEYS.some((sensitiveKey) => loweredKey.includes(sensitiveKey.toLowerCase()))) {
        return [key, maskValue(value)];
      }
      return [key, maskSensitiveData(value)];
    }),
  ) as T;
}

export function maskIpAddress(ip?: string): string | undefined {
  if (!ip) {
    return undefined;
  }
  if (ip.includes(':')) {
    return `${ip.split(':').slice(0, 2).join(':')}:****`;
  }
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.***.***` : maskValue(ip);
}
