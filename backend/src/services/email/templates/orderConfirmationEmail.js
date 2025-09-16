export default function orderConfirmationEmail(user, order) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
      .container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; padding: 20px; }
      .header { background: #16a34a; color: #fff; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { margin: 20px 0; }
      .btn { display: inline-block; padding: 12px 20px; background: #16a34a; color: #fff; text-decoration: none; border-radius: 5px; }
      .footer { font-size: 12px; color: #777; margin-top: 20px; text-align: center; }
      .items { margin: 15px 0; padding: 0; }
      .items li { margin: 5px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Order Confirmation</div>
      <div class="content">
        <h2>Hi ${user.name},</h2>
        <p>Thanks for your purchase! Your order <strong>#${
          order._id
        }</strong> has been placed successfully.</p>
        <ul class="items">
          ${order.items
            .map(
              (item) =>
                `<li>${item.product.title} (x${item.qty}) - ₹${item.price}</li>`
            )
            .join("")}
        </ul>
        <p><strong>Total Paid: ₹${order.totalAmount}</strong></p>
        <a class="btn" href="${process.env.FRONTEND_URL}/orders/${
    order._id
  }">View Order</a>
      </div>
      <div class="footer">© ${new Date().getFullYear()} Shop. All rights reserved.</div>
    </div>
  </body>
  </html>
  `;
}
