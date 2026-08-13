// Login IDs replace email addresses in the UI. Supabase Auth still needs an
// email-shaped identifier internally, so we map each login ID to a
// synthetic, never-emailed address under a fake domain.
export function loginIdToEmail(loginId: string): string {
  return `${loginId.trim().toLowerCase()}@login.internal`;
}

export function isValidLoginId(loginId: string): boolean {
  return /^[a-zA-Z0-9]{4,32}$/.test(loginId);
}

export function isValidPassword(password: string): boolean {
  // Matches Supabase Auth's default minimum password length.
  return password.length >= 6;
}
