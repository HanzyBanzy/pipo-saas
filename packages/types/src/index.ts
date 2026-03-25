// Tenant scope attached to every authenticated request
export interface TenantScope {
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

// Canonical inbound message from any channel
export interface CanonicalInboundMessage {
  externalId: string;
  externalConversationId: string;
  guestName?: string;
  guestMessage: string;
  channel: string;
  propertyExternalId: string;
  metadata: Record<string, unknown>;
  receivedAt: Date;
}

// AI response result
export interface ConciergeResult {
  reply: string;
  meta: {
    needs_escalation: boolean;
    escalation_reason: string;
    is_emergency: boolean;
  };
  activePersonality: string;
  sourceItemIds: string[];
  injectionScore: number;
  tokensUsed: { input: number; output: number };
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      tenantScope?: TenantScope;
    }
  }
}
