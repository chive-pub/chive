/**
 * Alpha approval email template.
 *
 * @packageDocumentation
 */

/**
 * Alpha approval email data.
 */
export interface AlphaApprovalEmailData {
  readonly handle?: string;
  readonly email: string;
  readonly zulipInviteUrl: string;
}

/**
 * Rendered email content.
 */
export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/**
 * Render the alpha approval email.
 *
 * @param data - Email data
 * @returns Rendered email content
 */
export function renderAlphaApprovalEmail(data: AlphaApprovalEmailData): RenderedEmail {
  const { handle, zulipInviteUrl } = data;

  const greeting = handle ? `Hi @${handle}` : 'Hello';

  const subject = 'Welcome to the Chive Alpha!';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Chive Alpha</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 20px 20px 20px;">
    <img src="https://chive.pub/chive-logo.svg" alt="Chive" style="width: 80px; height: 80px; border-radius: 16px;">
    <p style="margin: 12px 0 0 0; font-size: 24px; font-weight: 600; color: #333;">Chive</p>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 0 20px;">
    <h1 style="color: #157200; margin: 0 0 20px 0; font-size: 24px; text-align: center;">Welcome to the Alpha!</h1>
    <p style="font-size: 16px; margin-top: 0;">${greeting},</p>

    <p style="font-size: 16px;">Your application to join the Chive alpha has been approved! We're excited to have you as one of our early testers.</p>

    <h2 style="color: #157200; font-size: 20px; margin-top: 24px;">What's Next?</h2>

    <ol style="font-size: 16px; padding-left: 20px;">
      <li style="margin-bottom: 12px;">
        <strong>Join our Zulip community</strong><br>
        Connect with other alpha testers and the Chive team.
        <br><br>
        <a href="${zulipInviteUrl}" style="display: inline-block; background: #157200; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Join Zulip Community</a>
      </li>
      <li style="margin-bottom: 12px;">
        <strong>Sign in to Chive</strong><br>
        Use your AT Protocol identity to access the platform at <a href="https://chive.pub" style="color: #157200;">chive.pub</a>
      </li>
      <li style="margin-bottom: 12px;">
        <strong>Share your feedback</strong><br>
        Your input is invaluable! Report bugs and suggestions in our Zulip community.
      </li>
    </ol>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin-top: 24px;">
      <p style="margin: 0; font-size: 14px; color: #125f00;">
        <strong>Alpha Reminder:</strong> Chive is in early development. Features may change, and you will encounter bugs. Your patience and feedback help us build a better platform for scholarly communication.
      </p>
    </div>

    <h2 style="color: #157200; font-size: 20px; margin-top: 24px;">Resources</h2>
    <ul style="font-size: 16px; padding-left: 20px;">
      <li style="margin-bottom: 8px;">
        <a href="https://docs.chive.pub" style="color: #157200;">Documentation</a>: learn how to use Chive
      </li>
      <li style="margin-bottom: 8px;">
        <a href="https://github.com/chive-pub/chive" style="color: #157200;">GitHub</a>: view source code and submit issues
      </li>
    </ul>

    <p style="font-size: 16px; margin-top: 24px;">Thank you for being part of this journey to make academic publishing more open and accessible.</p>

    <p style="font-size: 16px; margin-bottom: 0;">
      Best regards,<br>
      <strong>The Chive Team</strong>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">Chive - Decentralized Scholarly Publishing</p>
    <p style="margin: 4px 0 0 0;"><a href="https://chive.pub" style="color: #157200;">chive.pub</a></p>
  </div>
</body>
</html>
`.trim();

  const text = `
${greeting},

Your application to join the Chive alpha has been approved! We're excited to have you as one of our early testers.

WHAT'S NEXT?

1. Join our Zulip community
   Connect with other alpha testers and the Chive team.
   ${zulipInviteUrl}

2. Sign in to Chive
   Use your AT Protocol identity to access the platform at https://chive.pub

3. Share your feedback
   Your input is invaluable! Report bugs and suggestions in our Zulip community.

ALPHA REMINDER: Chive is in early development. Features may change, and you will encounter bugs. Your patience and feedback help us build a better platform for scholarly communication.

RESOURCES

Documentation (learn how to use Chive): https://docs.chive.pub
GitHub (view source code and submit issues): https://github.com/chive-pub/chive

Thank you for being part of this journey to make academic publishing more open and accessible.

Best regards,
The Chive Team

Chive: Decentralized Scholarly Publishing
https://chive.pub
`.trim();

  return { subject, html, text };
}
