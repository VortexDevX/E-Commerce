import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import toast from "react-hot-toast";
import BannerHero from "../../components/BannerHero";

type Banner = {
  _id?: string;
  title?: string;
  altText?: string;
  imageUrl: string;
  linkUrl?: string;
  placement: "home_hero" | "category_header";
  categorySlug?: string;
  active: boolean;
  startAt?: string | null;
  endAt?: string | null;
  priority: number;
  impressions?: number;
  clicks?: number;
  updatedAt?: string;

  // NEW fields for brand-safe split banner
  layout?: "image_full" | "split_asym";
  imagePosition?: "left" | "right";
  imageFit?: "contain" | "cover";
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
};

const emptyForm: Banner = {
  title: "",
  altText: "",
  imageUrl: "",
  linkUrl: "",
  placement: "home_hero",
  categorySlug: "",
  active: true,
  startAt: "",
  endAt: "",
  priority: 0,
  layout: "image_full",
  imagePosition: "right",
  imageFit: "contain",
  headline: "",
  subheadline: "",
  ctaLabel: "",
};

function toInputDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function BannersAdminPage() {
  const [list, setList] = useState<Banner[]>([]);
  const [form, setForm] = useState<Banner>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterPlacement, setFilterPlacement] = useState<
    "" | "home_hero" | "category_header"
  >("home_hero");

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/banners", {
        params: filterPlacement ? { placement: filterPlacement } : {},
      });
      setList(data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPlacement]);

  const startEdit = (b: Banner) => {
    setEditingId(b._id!);
    setForm({
      _id: b._id,
      title: b.title || "",
      altText: b.altText || "",
      imageUrl: b.imageUrl || "",
      linkUrl: b.linkUrl || "",
      placement: b.placement,
      categorySlug: b.categorySlug || "",
      active: Boolean(b.active),
      startAt: toInputDateTime(b.startAt as string),
      endAt: toInputDateTime(b.endAt as string),
      priority: b.priority || 0,
      // NEW
      layout: b.layout || "image_full",
      imagePosition: b.imagePosition || "right",
      imageFit: b.imageFit || "contain",
      headline: b.headline || "",
      subheadline: b.subheadline || "",
      ctaLabel: b.ctaLabel || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm, placement: filterPlacement || "home_hero" });
  };

  const save = async () => {
    if (!form.imageUrl || !form.placement) {
      toast.error("imageUrl and placement are required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title,
        altText: form.altText,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl,
        placement: form.placement,
        categorySlug:
          form.placement === "category_header" ? form.categorySlug : undefined,
        active: form.active,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        priority: Number(form.priority) || 0,
        // NEW
        layout: form.layout,
        imagePosition: form.imagePosition,
        imageFit: form.imageFit,
        headline: form.headline,
        subheadline: form.subheadline,
        ctaLabel: form.ctaLabel,
      };

      if (editingId) {
        await api.put(`/admin/banners/${editingId}`, payload);
        toast.success("Banner updated");
      } else {
        await api.post("/admin/banners", payload);
        toast.success("Banner created");
      }
      await fetchList();
      resetForm();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    try {
      await api.delete(`/admin/banners/${id}`);
      toast.success("Deleted");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const previewBanner: Banner = {
    ...form,
    _id: "preview",
  };

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Banners</h1>
            <div className="flex items-center gap-2">
              <select
                value={filterPlacement}
                onChange={(e) => setFilterPlacement(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 text-gray-700"
              >
                <option value="">All placements</option>
                <option value="home_hero">Home — Hero</option>
                <option value="category_header">Category — Header</option>
              </select>
              <button
                onClick={resetForm}
                className="px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                New
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
              >
                {editingId
                  ? saving
                    ? "Updating..."
                    : "Update"
                  : saving
                  ? "Creating..."
                  : "Create"}
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Placement
              </label>
              <select
                value={form.placement}
                onChange={(e) =>
                  setForm((f) => ({ ...f, placement: e.target.value as any }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              >
                <option value="home_hero">Home — Hero</option>
                <option value="category_header">Category — Header</option>
              </select>
            </div>

            {form.placement === "category_header" && (
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Category Slug
                </label>
                <input
                  value={form.categorySlug || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categorySlug: e.target.value }))
                  }
                  placeholder="e.g., electronics"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-700 mb-1">Layout</label>
              <select
                value={form.layout}
                onChange={(e) =>
                  setForm((f) => ({ ...f, layout: e.target.value as any }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              >
                <option value="image_full">Image only (legacy)</option>
                <option value="split_asym">
                  Split (asymmetric, brand-safe)
                </option>
              </select>
            </div>

            {form.layout === "split_asym" && (
              <>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Image Position
                  </label>
                  <select
                    value={form.imagePosition}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        imagePosition: e.target.value as any,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                  >
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Image Fit
                  </label>
                  <select
                    value={form.imageFit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        imageFit: e.target.value as any,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                  >
                    <option value="contain">Contain (show full image)</option>
                    <option value="cover">Cover (crop edges)</option>
                  </select>
                </div>

                <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Headline
                    </label>
                    <input
                      value={form.headline || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, headline: e.target.value }))
                      }
                      placeholder="Big bold headline"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Subheadline
                    </label>
                    <input
                      value={form.subheadline || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, subheadline: e.target.value }))
                      }
                      placeholder="Supporting text"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      CTA Label (optional)
                    </label>
                    <input
                      value={form.ctaLabel || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, ctaLabel: e.target.value }))
                      }
                      placeholder="Shop Now"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Image URL
              </label>
              <input
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
                placeholder="/uploads/....png or https://..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Link URL
              </label>
              <input
                value={form.linkUrl || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkUrl: e.target.value }))
                }
                placeholder="/products or https://..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Start At
              </label>
              <input
                type="datetime-local"
                value={form.startAt || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startAt: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">End At</label>
              <input
                type="datetime-local"
                value={form.endAt || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endAt: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Priority
              </label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: Number(e.target.value || 0),
                  }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              <label htmlFor="active" className="text-sm text-gray-700">
                Active
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview (brand-safe split or legacy image) */}
        <div className="card p-4 mt-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
          {form.layout === "split_asym" || form.headline ? (
            <BannerHero
              banner={previewBanner as any}
              showAdBadge
              disableTracking
            />
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-gray-200">
              <img
                src={form.imageUrl || "/fallback.png"}
                alt={form.altText || form.title || "banner"}
                className="w-full h-64 object-cover"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
                }
              />
            </div>
          )}
        </div>

        {/* List */}
        <div className="card p-4 mt-4 overflow-x-auto">
          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : list.length === 0 ? (
            <div className="text-gray-600">No banners yet.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2">Preview</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Placement</th>
                  <th className="px-3 py-2">Layout</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2">Schedule</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Stats</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b._id} className="border-t border-gray-200">
                    <td className="px-3 py-2">
                      <img
                        src={b.imageUrl}
                        alt={b.altText || b.title || "banner"}
                        className="w-28 h-12 object-cover rounded border border-gray-200"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 truncate">
                        {b.title || "-"}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {b.linkUrl || ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">{b.placement}</td>
                    <td className="px-3 py-2">{b.layout || "image_full"}</td>
                    <td className="px-3 py-2">{b.active ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-700">
                        {b.startAt ? new Date(b.startAt).toLocaleString() : "-"}{" "}
                        → {b.endAt ? new Date(b.endAt).toLocaleString() : "-"}
                      </div>
                    </td>
                    <td className="px-3 py-2">{b.priority ?? 0}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-700">
                        {b.impressions || 0} views · {b.clicks || 0} clicks
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => startEdit(b)}
                          className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(b._id!)}
                          className="px-3 py-1 border border-rose-300 rounded-md bg-white text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
