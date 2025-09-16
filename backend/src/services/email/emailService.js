// backend/src/services/email/emailService.js

import nodemailer from "nodemailer";
import dotenv from "dotenv";

import EmailTemplate from "../../models/EmailTemplate.js";

import welcomeEmail from "./templates/welcomeEmail.js";
import resetPasswordEmail from "./templates/resetPasswordEmail.js";
import orderConfirmationEmail from "./templates/orderConfirmationEmail.js";
import orderDeliveredEmail from "./templates/orderDeliveredEmail.js";
import sellerRequestApprovedEmail from "./templates/sellerRequestApprovedEmail.js";
import sellerRequestRejectedEmail from "./templates/sellerRequestRejectedEmail.js";
import priceDropEmail from "./templates/priceDropEmail.js";

dotenv.config();

const IS_DEV = process.env.NODE_ENV !== "production";
const EMAIL_DISABLED =
  String(process.env.EMAIL_DISABLED || "").toLowerCase() === "true";

function createTransport() {
  if (EMAIL_DISABLED) {
    // Safe no-op transport: emails go to console/json
    return nodemailer.createTransport({ jsonTransport: true });
  }

  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();

  if (provider === "mailhog" || (!provider && IS_DEV)) {
    // Default to MailHog in dev if not explicitly set
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "127.0.0.1",
      port: Number(process.env.SMTP_PORT || 1025),
      secure: false,
    });
  }

  if (provider === "mailersend") {
    return nodemailer.createTransport({
      host: process.env.MAILERSEND_HOST,
      port: Number(process.env.MAILERSEND_PORT || 587),
      secure: false,
      auth: {
        user: process.env.MAILERSEND_USER, // "apikey"
        pass: process.env.MAILERSEND_PASS, // actual API key
      },
    });
  }

  // Safe fallback: do not throw; use jsonTransport to avoid crashing
  console.warn(
    `[email] Unknown EMAIL_PROVIDER "${provider}". Falling back to jsonTransport (no-op).`
  );
  return nodemailer.createTransport({ jsonTransport: true });
}

const transporter = createTransport();

// -------------------------
// Generic sendEmail (never throws fatally)
// -------------------------
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const from = process.env.EMAIL_FROM || "no-reply@localhost";
    const info = await transporter.sendMail({ from, to, subject, html });

    if (IS_DEV) {
      // In dev jsonTransport prints the message; MailHog shows in UI
      console.log(
        `[email] Sent to ${to} | subject: ${subject} | id: ${
          info?.messageId || "-"
        }`
      );
    }
    return info;
  } catch (err) {
    // Do not crash the request cycle because of email
    console.error("[email] Failed to send:", err?.message || err);
    return { error: err?.message || String(err) };
  }
};

// -------------------------
// Overrides helper (DB) with token replacement
// -------------------------
/**
 * Renders email content possibly using DB override.
 * Tokens supported in overrides:
 *  - {{user.name}}, {{user.email}}
 *  - {{order._id}}, {{order.totalAmount}}, {{order.itemsHtml}}
 *  - {{frontend.orderUrl}} (uses FRONTEND_URL/orders/:id)
 *  - {{token}}
 */
async function renderWithOverride(
  key,
  data,
  defaultSubject,
  defaultHtmlBuilder
) {
  try {
    const override = await EmailTemplate.findOne({ key }).lean();

    // Defaults
    const defaultHtml =
      typeof defaultHtmlBuilder === "function"
        ? defaultHtmlBuilder(data)
        : String(defaultHtmlBuilder || "");

    if (!override || !override.subject || !override.html) {
      return { subject: defaultSubject, html: defaultHtml };
    }

    const itemsHtml =
      data?.order?.items
        ?.map(
          (it) =>
            `<li>${it.product?.title || "Item"} (x${it.qty}) - ₹${
              it.price
            }</li>`
        )
        .join("") || "";

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    const map = {
      "{{user.name}}": data?.user?.name || "",
      "{{user.email}}": data?.user?.email || "",
      "{{order._id}}": data?.order?._id || "",
      "{{order.totalAmount}}": data?.order?.totalAmount || "",
      "{{order.itemsHtml}}": itemsHtml,
      "{{frontend.orderUrl}}": `${baseUrl}/orders/${data?.order?._id || ""}`,
      "{{token}}": data?.token || "",
      // New placeholders:
      "{{frontend.baseUrl}}": baseUrl,
      "{{frontend.resetPasswordUrl}}": `${baseUrl}/auth/reset-password?token=${
        data?.token || ""
      }`,
    };

    let subject = override.subject;
    let html = override.html;
    for (const [k, v] of Object.entries(map)) {
      subject = subject.replaceAll(k, String(v));
      html = html.replaceAll(k, String(v));
    }
    return { subject: subject || defaultSubject, html: html || defaultHtml };
  } catch (_err) {
    const html =
      typeof defaultHtmlBuilder === "function"
        ? defaultHtmlBuilder(data)
        : String(defaultHtmlBuilder || "");
    return { subject: defaultSubject, html };
  }
}

// -------------------------
// Specific Emails (with override support)
// -------------------------
export const sendWelcomeEmail = async (user) => {
  const { subject, html } = await renderWithOverride(
    "welcome",
    { user },
    "Welcome to Shop 🎉",
    (d) => welcomeEmail(d.user)
  );
  return sendEmail({ to: user.email, subject, html });
};

export const sendPasswordResetEmail = async (user, token) => {
  const { subject, html } = await renderWithOverride(
    "resetPassword",
    { user, token },
    "Reset Your Password",
    (d) => resetPasswordEmail(d.user, d.token)
  );
  return sendEmail({ to: user.email, subject, html });
};

export const sendOrderConfirmationEmail = async (user, order) => {
  const { subject, html } = await renderWithOverride(
    "orderConfirmation",
    { user, order },
    "Order Confirmation ✔️",
    (d) => orderConfirmationEmail(d.user, d.order)
  );
  return sendEmail({ to: user.email, subject, html });
};

export const sendOrderDeliveredEmail = async (user, order) => {
  const { subject, html } = await renderWithOverride(
    "orderDelivered",
    { user, order },
    "Order Delivered 🎉",
    (d) => orderDeliveredEmail(d.user, d.order)
  );
  return sendEmail({ to: user.email, subject, html });
};

export const sendSellerRequestApprovedEmail = async (user) => {
  const { subject, html } = await renderWithOverride(
    "sellerApproved",
    { user },
    "Your Seller Request Has Been Approved 🎉",
    (d) => sellerRequestApprovedEmail(d.user)
  );
  return sendEmail({ to: user.email, subject, html });
};

export const sendSellerRequestRejectedEmail = async (user) => {
  const { subject, html } = await renderWithOverride(
    "sellerRejected",
    { user },
    "Your Seller Request Has Been Rejected ❌",
    (d) => sellerRequestRejectedEmail(d.user)
  );
  return sendEmail({ to: user.email, subject, html });
};

export const sendPriceDropEmail = async (user, product, oldPrice, newPrice) => {
  const subject = `Price drop: ${product.title} now at ₹${Number(
    newPrice
  ).toLocaleString("en-IN")}`;
  const html = priceDropEmail(user, product, oldPrice, newPrice);
  return sendEmail({ to: user.email, subject, html });
};
