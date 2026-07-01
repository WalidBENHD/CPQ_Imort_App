export enum NotificationType {
  // Import notifications
  ImportUploaded = 1,
  ImportRejected = 2,
  ImportApproved = 3,
  ImportCommitted = 4,
  ImportFailed = 5,
  ImportNeedsCorrection = 6,
  // User notifications
  UserPendingApproval = 10,
  UserApproved = 11,
  UserRoleChanged = 12,
  UserDeleted = 13
}

export interface Notification {
  id: string;
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  relatedUserId?: string;
  relatedImportId?: string;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}
