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
      className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 w-full"
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
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Apply for Seller
          </h1>
          <p className="text-sm text-gray-600">
            Share your business details. Our team will review and reach out.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
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
            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            rows={4}
          />

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="file"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="block"
            />
            <button
              onClick={uploadDoc}
              disabled={!docFile || uploading}
              className="px-3 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50"
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
