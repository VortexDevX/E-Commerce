export default function welcomeEmail(user) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
      .container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; padding: 20px; }
      .header { background: #4f46e5; color: #fff; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { margin: 20px 0; }
      .btn { display: inline-block; padding: 12px 20px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 5px; }
      .footer { font-size: 12px; color: #777; margin-top: 20px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Welcome to Shop 🚀</div>
      <div class="content">
        <h2>Hello ${user.name},</h2>
        <p>We’re excited to have you join our platform. Start exploring amazing products right away!</p>
        <a class="btn" href="${process.env.FRONTEND_URL}">Start Shopping</a>
      </div>
      <div class="footer">© ${new Date().getFullYear()} Shop. All rights reserved.</div>
    </div>
  </body>
  </html>
  `;
}
