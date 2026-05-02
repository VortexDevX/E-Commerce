import dynamic from "next/dynamic";
import React, { useState, memo } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import SellerLayout from "../../components/layout/SellerLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";

// Extract Field so it doesn't remount on each parent re-render (prevents input losing focus)
type TextFieldProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
};
const TextField = memo(function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
}: TextFieldProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
      autoComplete="off"
    />
  );
});

function SellerApplyPage() {
  const [form, setForm] = useState({
    businessName: "",
    legalName: "",
    phone: "",
    website: "",
    gst: "",
    address: "",
    message: "",
    documents: [] as { url: string; name?: string }[],
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const uploadDoc = async () => {
    if (!docFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", docFile); // matches /users/apply/upload
    try {
      const { data } = await api.post("/users/apply/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({
        ...f,
        documents: [...f.documents, { url: data.url, name: docFile.name }],
      }));
      setDocFile(null);
      toast.success("Document uploaded");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.post("/users/seller-request", form);
      toast.success("Application submitted");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <SellerLayout>
        <div className="space-y-2 mb-8 border-b-[3px] border-border pb-4">
          <h1 className="text-3xl font-black uppercase tracking-widest text-foreground">
            Apply for Seller
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-2">
            Share your business details. Our team will review and reach out.
          </p>
        </div>

        <div className="rounded-none border-[3px] border-border bg-card shadow-[8px_8px_0px_hsl(var(--foreground))] p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-3">
            <TextField
              placeholder="Business Name"
              value={form.businessName}
              onChange={(v) => setForm((f) => ({ ...f, businessName: v }))}
            />
            <TextField
              placeholder="Legal Name"
              value={form.legalName}
              onChange={(v) => setForm((f) => ({ ...f, legalName: v }))}
            />
            <TextField
              placeholder="Phone"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            <TextField
              placeholder="Website"
              value={form.website}
              onChange={(v) => setForm((f) => ({ ...f, website: v }))}
            />
            <TextField
              placeholder="GST Number"
              value={form.gst}
              onChange={(v) => setForm((f) => ({ ...f, gst: v }))}
            />
            <TextField
              placeholder="Registered Address"
              value={form.address}
              onChange={(v) => setForm((f) => ({ ...f, address: v }))}
            />
          </div>

          <textarea
            placeholder="Describe your store and the products you plan to sell..."
            value={form.message}
            onChange={(e) =>
              setForm((f) => ({ ...f, message: e.target.value }))
            }
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            rows={4}
          />

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="file"
              id="media-upload"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <label
              htmlFor="media-upload"
              className="inline-flex items-center gap-2 px-4 py-3 uppercase tracking-widest text-xs font-black border-[3px] border-border bg-card text-foreground cursor-pointer shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
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
            <button
              onClick={uploadDoc}
              disabled={!docFile || uploading}
              className="px-6 py-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload document"}
            </button>
          </div>

          {form.documents.length > 0 && (
            <ul className="text-sm text-gray-700 list-disc ml-5">
              {form.documents.map((d, i) => (
                <li key={i}>
                  {d.name || "doc"} —{" "}
                  <a
                    className="text-purple-600 underline"
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    preview
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-4 border-t-[3px] border-border">
            <button
              onClick={submit}
              disabled={submitting}
              className="px-8 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 disabled:opacity-50 mt-4 w-full md:w-auto"
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </div>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerApplyPage), { ssr: false });
