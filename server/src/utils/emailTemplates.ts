
export const getBaseEmailTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; text-decoration: none; }
    .content { background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; margin-top: 20px; }
    .footer { margin-top: 30px; text-align: center; font-size: 14px; color: #6b7280; }
  </style>
</head>
<body style="background-color: #f9fafb;">
  <div class="container">
    <div class="header">
      <a href="${process.env.CLIENT_URL || '#'}" class="logo">TaskMaster</a>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} TaskMaster. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const getInvitationEmailHtml = (
    orgName: string,
    inviterName: string,
    inviteLink: string,
    role: string
) => {
    const content = `
    <h2>You've been invited to join ${orgName}</h2>
    <p>Hello,</p>
    <p><strong>${inviterName}</strong> has invited you to join the organization <strong>${orgName}</strong> as a <strong>${role}</strong> on TaskMaster.</p>
    <p>Collaborate with your team, manage tasks, and boost productivity together.</p>
    <div style="text-align: center;">
      <a href="${inviteLink}" class="button" style="color: #ffffff;">Accept Invitation</a>
    </div>
    <p style="margin-top: 20px; font-size: 14px; color: #666;">This invitation will expire in 7 days.</p>
    <p style="font-size: 12px; color: #999;">If the button doesn't work, copy and paste this link into your browser:<br> <a href="${inviteLink}">${inviteLink}</a></p>
  `;
    return getBaseEmailTemplate(content);
};
