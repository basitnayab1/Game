export interface AuditEventInput { actorUserId?: string; action: string; entityType: string; entityId?: string; requestId?: string; ipHash?: string; metadata?: Record<string, unknown>; }
export class AuditService { async record(input: AuditEventInput): Promise<void> { void input; } }
