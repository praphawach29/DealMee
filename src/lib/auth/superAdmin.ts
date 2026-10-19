// The one place that decides who is a DealMee Super Admin.
//
// Only the emails listed here are Super Admins. users.role is deliberately not
// consulted: accounts picked up role = 'superadmin' from an old self-grant button,
// and an email list in code can't be changed by anyone signing up.
export const SUPER_ADMIN_EMAILS: readonly string[] = ['praphawach@gmail.com']

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
