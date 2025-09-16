// routes/testEmail.js
import express from "express";
import { sendEmail } from "../services/email/emailService.js";

const router = express.Router();

router.post("/send-test", async (req, res) => {
  try {
    const recipient =
      req.body && req.body.to ? req.body.to : "test@example.com";
    await sendEmail({
      to: recipient,
      subject: "MailHog Test ✔️",
      html: "<p>If you see this in MailHog, your setup works.</p>",
    });
    res.json({ success: true, message: `Test email sent to ${recipient}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
export default router;
