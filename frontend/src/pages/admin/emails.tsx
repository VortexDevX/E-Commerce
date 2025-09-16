import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { hasPerm } from "../../utils/permissions";

type TemplateMeta = { key: string; hasOverride: boolean };
type TemplateData = {
  key: string;
  default: { subject: string; html: string };
  override: { subject: string; html: string } | null;
  samples: any;
};

function IframePreview({ html }: { html: string }) {
  const srcDoc = useMemo(
    () => html || "<html><body><p>No preview</p></body></html>",
    [html]
  );
  return (
    <iframe
      className="w-full h-[600px] bg-white rounded border border-gray-200"
      srcDoc={srcDoc}
      sandbox=""
    />
  );
}

function AdminEmailsPage() {
  const { user } = useAuth();
  const canRead = hasPerm(user as any, "emailTemplates:read");
  const canWrite = hasPerm(user as any, "emailTemplates:write");

  const [list, setList] = useState<TemplateMeta[]>([]);
  const [active, setActive] = useState<string>("welcome");
  const [data, setData] = useState<TemplateData | null>(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    const { data } = await api.get("/admin/emails");
    setList(data);
  };

  const fetchOne = async (key: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/emails/${key}`);
      setData(data);
      setSubject(data.override?.subject || data.default.subject);
      setHtml(data.override?.html || data.default.html);
      const preview = await api.post("/admin/emails/render", {
        key,
        subject: data.override?.subject,
        html: data.override?.html,
      });
      setPreviewHtml(preview.data.html);
    } catch {
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canRead) return;
    fetchList();
  }, [canRead]);

  useEffect(() => {
    if (!canRead || !active) return;
    fetchOne(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, canRead]);

  const renderPreview = async () => {
    try {
      const { data } = await api.post("/admin/emails/render", {
        key: active,
        subject,
        html,
      });
      setPreviewHtml(data.html);
    } catch {
      toast.error("Preview failed");
    }
  };

  const save = async () => {
    if (!canWrite) {
      toast.error("You don’t have permission to modify templates");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/admin/emails/${active}`, { subject, html });
      toast.success("Template saved");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <h1 className="text-2xl font-semibold text-gray-900">
          Email Templates
        </h1>

        {!canRead ? (
          <div className="card p-6 text-gray-700">
            You don’t have access to Email Templates.
          </div>
        ) : (
          <div className="grid lg:grid-cols-[260px,1fr,1fr] gap-6">
            {/* Sidebar list */}
            <aside className="card p-4 h-fit">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Templates
              </h3>
              <div className="space-y-1">
                {list.map((t) => {
                  const activeCls =
                    t.key === active
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50";
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActive(t.key)}
                      className={`w-full text-left px-3 py-2 rounded-lg border ${activeCls}`}
                    >
                      {t.key}
                      {t.hasOverride && (
                        <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 rounded">
                          Override
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Editor */}
            <section className="space-y-3">
              {loading || !data ? (
                <div className="card p-6 text-gray-600">Loading...</div>
              ) : (
                <>
                  <div className="card p-4">
                    <label className="block text-sm text-gray-700 mb-1">
                      Subject
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={!canWrite}
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:opacity-60"
                    />
                  </div>
                  <div className="card p-4">
                    <label className="block text-sm text-gray-700 mb-1">
                      HTML
                    </label>
                    <textarea
                      value={html}
                      onChange={(e) => setHtml(e.target.value)}
                      disabled={!canWrite}
                      className="w-full h-[480px] bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:opacity-60"
                    />
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={renderPreview}
                        className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      >
                        Preview
                      </button>

                      <PermissionGate perm="emailTemplates:write">
                        <button
                          onClick={save}
                          disabled={saving}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save Override"}
                        </button>
                      </PermissionGate>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Available tokens: {"{{frontend.resetPasswordUrl}}"},{" "}
                      {"{{user.name}}"}, {"{{user.email}}"}, {"{{order._id}}"},{" "}
                      {"{{order.totalAmount}}"}, {"{{order.itemsHtml}}"},{" "}
                      {"{{frontend.orderUrl}}"}, {"{{token}}"},{" "}
                      {"{{product.title}}"},{"{{oldPrice}}"},{"{{newPrice}}"},{" "}
                      {"{{frontend.productUrl}}"}
                    </p>
                  </div>
                </>
              )}
            </section>

            {/* Preview */}
            <section>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Preview
              </h3>
              <IframePreview html={previewHtml} />
            </section>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminEmailsPage), { ssr: false });
