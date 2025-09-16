export default function orderDeliveredEmail(user, order) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
      .container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; padding: 20px; }
      .header { background: #2563eb; color: #fff; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { margin: 20px 0; }
      .btn { display: inline-block; padding: 12px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 5px; }
      .footer { font-size: 12px; color: #777; margin-top: 20px; text-align: center; }
      .items { margin: 15px 0; padding: 0; }
      .items li { margin: 5px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Order Delivered 🎉</div>
      <div class="content">
        <h2>Hello ${user.name},</h2>
        <p>Your order <strong>#${
          order._id
        }</strong> has been delivered successfully.</p>
        <ul class="items">
          ${order.items
            .map(
              (item) =>
                `<li>${item.product.title} (x${item.qty}) - ₹${item.price}</li>`
            )
            .join("")}
        </ul>
        <p><strong>Total Paid: ₹${order.totalAmount}</strong></p>
        <p>We’d love your feedback. Please leave a review for your purchased items.</p>
        <a class="btn" href="${process.env.FRONTEND_URL}/orders/${
    order._id
  }">Leave a Review</a>
      </div>
      <div class="footer">© ${new Date().getFullYear()} Shop. All rights reserved.</div>
    </div>
  </body>
  </html>
  `;
}
