export type NotificationCategory = 'TRANSACTION' | 'PROMOTION' | 'SECURITY' | 'SYSTEM';
export interface NotificationRecord { id: string; userId: string; category: NotificationCategory; title: string; body: string; readAt?: string; createdAt: string; }

export class NotificationService {
  create(input: Omit<NotificationRecord, 'createdAt'>): NotificationRecord {
    return { ...input, createdAt: new Date().toISOString() };
  }
}
