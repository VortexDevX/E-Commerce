import { useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { toast } from "react-hot-toast";
import api from "../utils/api";

const HCaptcha = dynamic(() => import("@hcaptcha/react-hcaptcha"), {
  ssr: false,
});

export default function ContactPage() {
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    orderId: "",
    message: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files || []);
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const filtered = f.filter((x) => allowed.includes(x.type)).slice(0, 3);
    const tooBig = filtered.some((x) => x.size > 5 * 1024 * 1024);
    if (tooBig) {
      toast.error("Each image must be under 5MB.");
      return;
    }
    if (f.length !== filtered.length) {
      toast("Some files were skipped (only images: JPG/PNG/WebP).", {
        icon: "ℹ️",
      });
    }
    setFiles(filtered);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const canSubmit =
    form.name.trim() &&
    /^\S+@\S+\.\S+$/.test(form.email) &&
    form.subject.trim() &&
    form.message.trim() &&
    (!siteKey || !!captchaToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("email", form.email.trim());
      fd.append("subject", form.subject.trim());
      if (form.orderId.trim()) fd.append("orderId", form.orderId.trim());
      fd.append("message", form.message.trim());
      if (captchaToken) fd.append("captchaToken", captchaToken);
      files.forEach((f) => fd.append("attachments", f, f.name));

      await api.post("/contact", fd);
      toast.success("Message sent. We’ll get back to you soon!");
      setForm({ name: "", email: "", subject: "", orderId: "", message: "" });
      setFiles([]);
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send message.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Contact Us · Luxora</title>
        <meta name="description" content="Get in touch with Luxora support." />
      </Head>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Contact Us</h1>
        <p className="text-gray-600 mt-2">
          We typically reply within 1 business day. For order questions, include
          your Order ID.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Name</label>
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Subject</label>
            <input
              name="subject"
              type="text"
              value={form.subject}
              onChange={handleChange}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Order ID (optional)
            </label>
            <input
              name="orderId"
              type="text"
              value={form.orderId}
              onChange={handleChange}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
              placeholder="e.g., 64f1d2..."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Message</label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              rows={6}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Please be descriptive; include any relevant details.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Attachments (optional)
            </label>
            <input
              type="file"
              id="media-upload"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onFileChange}
              className="sr-only"
            />
            <label
              htmlFor="media-upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <svg
                className="w-4 h-4 text-gray-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
              </svg>
              Choose file
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Up to 3 images, max 5MB each (JPG, PNG, WebP).
            </p>
            {files.length > 0 && (
              <ul className="mt-2 text-sm text-gray-700 list-disc pl-5">
                {files.map((f) => (
                  <li key={f.name}>{f.name}</li>
                ))}
              </ul>
            )}
          </div>

          {siteKey && (
            <div>
              <HCaptcha
                key={captchaKey}
                sitekey={siteKey}
                onVerify={(token: string) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full sm:w-auto inline-flex justify-center items-center bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium rounded-md px-6 py-2"
          >
            {submitting ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </>
  );
}
