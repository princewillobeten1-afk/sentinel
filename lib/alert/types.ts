export enum AlertCategory {
  PRICE = 'PRICE',
  VOLUME = 'VOLUME',
  LIQUIDITY = 'LIQUIDITY',
  OWNERSHIP = 'OWNERSHIP',
  CREATOR = 'CREATOR',
  INSIDER = 'INSIDER',
  ORGANIC_VOLUME = 'ORGANIC_VOLUME',
  EXITABILITY = 'EXITABILITY',
  RISK = 'RISK',
  WALLET = 'WALLET',
  COPY_TRADE = 'COPY_TRADE',
  PORTFOLIO = 'PORTFOLIO',
  ORDER = 'ORDER',
  EXECUTION = 'EXECUTION',
  LAUNCH = 'LAUNCH',
  SECURITY = 'SECURITY',
  MARKET = 'MARKET'
}

export enum AlertSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AlertConfidence {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum AlertReadState {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ACTIONED = 'ACTIONED',
  DISMISSED = 'DISMISSED'
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
  DISCORD = 'DISCORD',
  WEBHOOK = 'WEBHOOK'
}

export interface AlertCondition {
  field: string;
  operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'NOT_IN' | 'CONTAINS';
  value: any;
}

export interface MultiConditionGroup {
  operator: 'AND' | 'OR' | 'NOT';
  conditions: (AlertCondition | MultiConditionGroup)[];
}

export interface AlertRule {
  id: string;
  userId: string;
  name?: string;
  scope: Record<string, any>;
  category: AlertCategory;
  conditions: MultiConditionGroup;
  severity: AlertSeverity;
  channels: NotificationChannel[];
  cooldownMinutes: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertEvent {
  id: string;
  userId: string;
  ruleId?: string;
  category: AlertCategory;
  severity: AlertSeverity;
  confidence: AlertConfidence;
  relevanceScore?: number;
  message: string;
  evidence: Record<string, any>;
  snapshot: Record<string, any>;
  readState: AlertReadState;
  groupId?: string;
  createdAt: Date;
  readAt?: Date;
  actionedAt?: Date;
  dismissedAt?: Date;
}

export interface NotificationJob {
  id: string;
  eventId: string;
  channel: NotificationChannel;
  provider: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY';
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertPreferences {
  userId: string;
  channels: Record<string, boolean>; // Maps channel ENUM to boolean
  quietHoursStart?: string; // HH:mm
  quietHoursEnd?: string; // HH:mm
  quietHoursTimezone: string;
  overrideCritical: boolean;
  updatedAt: Date;
}

export interface RawEvent {
  id: string;
  category: AlertCategory;
  timestamp: Date;
  payload: Record<string, any>;
  context?: Record<string, any>;
}
