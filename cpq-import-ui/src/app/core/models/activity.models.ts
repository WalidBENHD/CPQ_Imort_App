export type ActivityCategory = 'Authentication' | 'Import' | 'Admin' | 'Navigation' | 'System';

export interface ActivityEvent {
  id: string;
  occurredAtUtc: string;
  category: ActivityCategory;
  categoryLabel: string;
  action: string;
  description: string | null;
  userId: string | null;
  userDisplayName: string | null;
  userRole: string | null;
  targetType: string | null;
  targetId: string | null;
  route: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  metadataJson: string | null;
}

export interface ActivityOverview {
  totalLast24h: number;
  authEventsLast24h: number;
  importEventsLast24h: number;
  failuresLast24h: number;
}

export interface ActivityTrackViewRequest {
  page: string;
  title: string | null;
  referrer: string | null;
  clientTime: string;
}
