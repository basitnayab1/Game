export type NotificationCategory = 'TRANSACTION'|'PROMOTION'|'SECURITY'|'SYSTEM';
export type TicketStatus = 'OPEN'|'IN_PROGRESS'|'WAITING_FOR_USER'|'RESOLVED'|'CLOSED'|'REOPENED';
export const supportNotificationPlayerEndpoints = { notifications:'/api/v1/notifications', markRead:(id:string)=>`/api/v1/notifications/${id}/read`, readAll:'/api/v1/notifications/read-all', tickets:'/api/v1/support/tickets', ticket:(id:string)=>`/api/v1/support/tickets/${id}`, messages:(id:string)=>`/api/v1/support/tickets/${id}/messages` } as const;
