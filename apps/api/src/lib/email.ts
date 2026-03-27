import { Resend } from 'resend';
import { logger } from '../config/logger.js';

function getResend(): Resend | null {
  const key = process.env['RESEND_API_KEY'];
  if (!key) return null;
  return new Resend(key);
}

export async function sendEscalationEmail(params: {
  to: string;
  propertyName: string;
  guestName: string;
  reason: string;
  urgency: string;
  conversationId: string;
  propertyId: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    logger.warn('Resend not configured — escalation email skipped');
    return;
  }

  const urgencyEmoji =
    ({ CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' } as Record<string, string>)[
      params.urgency
    ] ?? '⚠️';

  try {
    await resend.emails.send({
      from: 'Pipo House <onboarding@resend.dev>',
      to: params.to,
      subject: `${urgencyEmoji} ${params.urgency} escalation — ${params.propertyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e94560;">⚠️ Guest Needs Your Help</h2>
          <p><strong>Property:</strong> ${params.propertyName}</p>
          <p><strong>Guest:</strong> ${params.guestName}</p>
          <p><strong>Urgency:</strong> ${params.urgency}</p>
          <p><strong>Reason:</strong> ${params.reason}</p>
          <p style="margin-top: 24px;">
            <a href="http://localhost:3000/properties/${params.propertyId}/escalations"
               style="background: #e94560; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
              View Escalation
            </a>
          </p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">
            Sent by Pipo — Personal House Companion
          </p>
        </div>
      `,
    });
    logger.info({ to: params.to }, 'Escalation email sent');
  } catch (err) {
    logger.error({ err }, 'Failed to send escalation email');
  }
}
