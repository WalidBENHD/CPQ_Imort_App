export interface AuthUser {
  id: string;
  userName: string;
  displayName: string;
  role: string;
  isApproved: boolean;
  isAdmin: boolean;
  createdAt: string;
  approvedAt: string | null;
  approvedByUserName: string | null;
  lastLoginAt: string | null;
}

export interface AuthTokenResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: AuthUser;
}
