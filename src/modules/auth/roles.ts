export const SUPER_ADMIN_ROLE = "super_admin";

export function isSuperAdmin(user: { role: string | null } | null | undefined): boolean {
  return user?.role === SUPER_ADMIN_ROLE;
}
