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
  lastSeenAt: string | null;
  isSuspended: boolean;
  roleIds: string[];
  roleNames: string[];
  capabilities: string[];
}

export interface AccessRole {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isSystem: boolean;
  capabilities: string[];
  assignedUsers: number;
}

export interface SaveAccessRoleRequest {
  name: string;
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
}

export interface AuthTokenResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: AuthUser;
}
