export default function resetPasswordEmail(user, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
      .container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; padding: 20px; }
      .header { background: #ff1010; color: #fff; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { margin: 20px 0; }
      .btn { display: inline-block; padding: 12px 20px; background: #ff1010; color: #fff; text-decoration: none; border-radius: 5px; }
      .footer { font-size: 12px; color: #777; margin-top: 20px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Password Reset</div>
      <div class="content">
        <h2>Hello ${user.name},</h2>
        <p>You requested to reset your password. Click the button below to set a new one:</p>
        <a class="btn" href="${resetUrl}">Reset Password</a>
        <p>This link expires in 15 minutes. If you didn’t request this, you can ignore this email.</p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} Shop. All rights reserved.</div>
    </div>
  </body>
  </html>
  `;
}
