export function resolveHomeRoute(capabilities: readonly string[], roles: readonly string[] = []): string {
  if (capabilities.includes('imports.view') || roles.includes('cpq-admin')) return '/dashboard';
  if (capabilities.includes('tools.evolis') || roles.includes('cpq-internal-tools')) return '/internal-tools/evolis-decryptor';
  if (capabilities.includes('users.manage') && capabilities.includes('users.assign_roles')) return '/admin/users';
  if (capabilities.includes('roles.manage')) return '/admin/access-studio';
  if (capabilities.includes('audit.view')) return '/admin/activity';
  if (capabilities.includes('system.maintenance')) return '/admin/maintenance';
  return '/forbidden';
}
