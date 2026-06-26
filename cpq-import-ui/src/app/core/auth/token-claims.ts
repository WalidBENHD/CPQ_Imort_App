export type TokenClaims = Record<string, unknown>;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

export function readAccessTokenClaims(accessToken: string | null | undefined): TokenClaims {
  if (!accessToken) return {};

  const parts = accessToken.split('.');
  if (parts.length < 2) return {};

  try {
    const payload = decodeBase64Url(parts[1]);
    return JSON.parse(payload) as TokenClaims;
  } catch {
    return {};
  }
}

export function mergeClaims(
  identityClaims: TokenClaims | null | undefined,
  accessTokenClaims: TokenClaims | null | undefined
): TokenClaims {
  return {
    ...(identityClaims ?? {}),
    ...(accessTokenClaims ?? {})
  };
}

export function readRoles(claims: TokenClaims): string[] {
  const roleClaims = [
    claims['roles'],
    claims['role'],
    claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
  ];

  const roles = roleClaims.flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  });

  return roles
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
