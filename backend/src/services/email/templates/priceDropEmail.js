export default function priceDropEmail(user, product, oldPrice, newPrice) {
  const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
  const link = `${frontend}/products/${product._id || product.slug || ""}`;
  return `
  <div style="font-family: Inter,Segoe UI,Arial,sans-serif; color:#111; line-height:1.5;">
    <h2>Price drop on ${product.title}</h2>
    <p>Good news ${user.name || ""}, the price just dropped!</p>
    <p>
      <strong>Old:</strong> ₹${oldPrice.toLocaleString("en-IN")}<br/>
      <strong>Now:</strong> <span style="color:#7c3aed;">₹${newPrice.toLocaleString(
        "en-IN"
      )}</span>
    </p>
    <p>
      <a href="${link}" style="display:inline-block;padding:10px 16px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;">View product</a>
    </p>
    <p style="font-size:12px;color:#666;">You are receiving this because you enabled price-drop alerts.</p>
  </div>
  `;
}
