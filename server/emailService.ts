import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface InvitationEmailData {
  email: string;
  inviterName: string;
  accountName: string;
  invitationToken: string;
  role: string;
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('Email service not configured - would send invitation to:', data.email);
    console.log('Invitation link:', `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/accept-invitation/${data.invitationToken}`);
    return;
  }

  const invitationUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/accept-invitation/${data.invitationToken}`;
  
  try {
    await resend.emails.send({
      from: 'UTM Builder <noreply@utmbuilder.com>',
      to: [data.email],
      subject: `You've been invited to join ${data.accountName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>You've been invited to join ${data.accountName}</h2>
          
          <p>Hi there!</p>
          
          <p>${data.inviterName} has invited you to join their UTM Builder account as a <strong>${data.role}</strong>.</p>
          
          <p>UTM Builder is a comprehensive tool for creating and managing UTM tracking links for your marketing campaigns.</p>
          
          <div style="margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all;">
            ${invitationUrl}
          </p>
          
          <p>This invitation will expire in 7 days.</p>
          
          <p>Best regards,<br>The UTM Builder Team</p>
        </div>
      `,
    });
    
    console.log('Invitation email sent successfully to:', data.email);
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    throw new Error('Failed to send invitation email');
  }
}