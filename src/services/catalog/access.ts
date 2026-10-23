const DEFAULT_ADMINS = ['demo@avishopper.cl', 'manuel.aravenal@gmail.com'];

export function isAdminEmail(email?: string | null, extra = process.env.ADMIN_EMAILS): boolean {
  const allowed = new Set(DEFAULT_ADMINS);
  for (const item of (extra || '').split(',')) {
    const value = item.trim().toLowerCase();
    if (value) allowed.add(value);
  }
  return Boolean(email && allowed.has(email.toLowerCase()));
}
