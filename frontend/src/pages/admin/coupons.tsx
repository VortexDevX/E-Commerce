import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { currency } from "../../utils/format";
import { useAuth } from "../../hooks/useAuth";
import { hasPerm } from "../../utils/permissions";

type Coupon = {
  _id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  startsAt?: string;
  expiresAt?: string;
  minOrderValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount?: number;
  perUserLimit?: number;
  description?: string;
  allowedCategories?: string[];
  allowedBrands?: string[];
  createdAt?: string;
};

type Category = { _id: string; name: string; slug: string; active: boolean };

export default function AdminCouponsPage() {
  const { user } = useAuth();
  const canRead = hasPerm(user as any, "coupons:read");
  const canWrite = hasPerm(user as any, "coupons:write");

  const [list, setList] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // categories for scope
  const [categories, setCategories] = useState<Category[]>([]);

  // editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<Partial<Coupon>>({
    code: "",
    type: "percent",
    value: 10,
    active: true,
    minOrderValue: 0,
    allowedCategories: [],
    allowedBrands: [],
  });

  const load = async () => {
    setLoading(true);
    try {
      const calls: Promise<any>[] = [];
      if (canRead) calls.push(api.get("/admin/coupons"));
      calls.push(api.get("/categories"));
      const results = await Promise.all(calls);
      const couponsRes = canRead ? results[0] : null;
      const catsRes = results[canRead ? 1 : 0];
      if (couponsRes) setList(couponsRes.data || []);
      setCategories((catsRes.data || []).filter((c: Category) => c.active));
    } catch {
      if (canRead) toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const startCreate = () => {
    if (!canWrite) {
      toast.error("You don’t have permission to create coupons");
      return;
    }
    setEditing(null);
    setForm({
      code: "",
      type: "percent",
      value: 10,
      active: true,
      minOrderValue: 0,
      maxDiscount: undefined,
      usageLimit: undefined,
      perUserLimit: undefined,
      startsAt: undefined,
      expiresAt: undefined,
      description: "",
      allowedCategories: [],
      allowedBrands: [],
    });
    setEditorOpen(true);
  };

  const startEdit = (c: Coupon) => {
    if (!canWrite) {
      toast.error("You don’t have permission to edit coupons");
      return;
    }
    setEditing(c);
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      active: c.active,
      minOrderValue: c.minOrderValue,
      maxDiscount: c.maxDiscount,
      usageLimit: c.usageLimit,
      perUserLimit: c.perUserLimit,
      startsAt: c.startsAt ? c.startsAt.substring(0, 16) : undefined,
      expiresAt: c.expiresAt ? c.expiresAt.substring(0, 16) : undefined,
      description: c.description || "",
      allowedCategories: c.allowedCategories || [],
      allowedBrands: c.allowedBrands || [],
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!canWrite) {
      toast.error("You don’t have permission to modify coupons");
      return;
    }
    const payload: any = { ...form };
    payload.code = String(payload.code || "")
      .toUpperCase()
      .trim();
    if (!payload.code) return toast.error("Code required");
    if (!payload.type) payload.type = "percent";
    if (Number(payload.value) <= 0) return toast.error("Value must be > 0");

    if (typeof payload.allowedBrands === "string") {
      payload.allowedBrands = payload.allowedBrands
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    try {
      if (editing) {
        await api.patch(`/admin/coupons/${editing._id}`, payload);
        toast.success("Coupon updated");
      } else {
        await api.post("/admin/coupons", payload);
        toast.success("Coupon created");
      }
      setEditing(null);
      setEditorOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditorOpen(false);
    setForm({
      code: "",
      type: "percent",
      value: 10,
      active: true,
      minOrderValue: 0,
      maxDiscount: undefined,
      usageLimit: undefined,
      perUserLimit: undefined,
      startsAt: undefined,
      expiresAt: undefined,
      description: "",
      allowedCategories: [],
      allowedBrands: [],
    });
  };

  const toggleActive = async (c: Coupon) => {
    if (!canWrite) {
      toast.error("You don’t have permission to update coupons");
      return;
    }
    try {
      await api.patch(`/admin/coupons/${c._id}`, { active: !c.active });
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const del = async (c: Coupon) => {
    if (!canWrite) {
      toast.error("You don’t have permission to delete coupons");
      return;
    }
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await api.delete(`/admin/coupons/${c._id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  // Columns count depends on write perms (actions column)
  const colCount = useMemo(() => (canWrite ? 11 : 10), [canWrite]);

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Coupons</h1>
          <PermissionGate perm="coupons:write">
            <button
              onClick={startCreate}
              className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
            >
              + New Coupon
            </button>
          </PermissionGate>
        </div>

        {!canRead ? (
          <div className="card p-6 text-gray-700">
            You don’t have access to Coupons.
          </div>
        ) : (
          <>
            {/* Editor (write only) */}
            {editorOpen && canWrite && (
              <div className="card p-4 mb-6">
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Code
                    </label>
                    <input
                      value={form.code || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, code: e.target.value }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                      placeholder="SAVE10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={form.type || "percent"}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, type: e.target.value as any }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                    >
                      <option value="percent">Percent</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.value ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          value: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Active
                    </label>
                    <select
                      value={String(form.active ?? true)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          active: e.target.value === "true",
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Min Order Value
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.minOrderValue ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          minOrderValue: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                      placeholder="0"
                    />
                  </div>

                  {form.type === "percent" && (
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Max Discount (cap)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={form.maxDiscount ?? 0}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            maxDiscount: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                        placeholder="Optional"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Global Usage Limit
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.usageLimit ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          usageLimit: Number(e.target.value) || undefined,
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Per User Limit
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.perUserLimit ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          perUserLimit: Number(e.target.value) || undefined,
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Starts At
                    </label>
                    <input
                      type="datetime-local"
                      value={(form.startsAt as any) || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          startsAt: e.target.value || undefined,
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Expires At
                    </label>
                    <input
                      type="datetime-local"
                      value={(form.expiresAt as any) || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          expiresAt: e.target.value || undefined,
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      value={form.description || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                      placeholder="Optional, shown in admin only"
                    />
                  </div>

                  {/* Scope: categories */}
                  <div className="md:col-span-3">
                    <label className="block text-sm text-gray-700 mb-2">
                      Allowed Categories (apply to matching items)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => {
                        const checked = (form.allowedCategories || []).includes(
                          c.name
                        );
                        return (
                          <label
                            key={c._id}
                            className="inline-flex items-center gap-2 text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setForm((f) => {
                                  const arr = new Set(
                                    f.allowedCategories || []
                                  );
                                  if (e.target.checked) arr.add(c.name);
                                  else arr.delete(c.name);
                                  return {
                                    ...f,
                                    allowedCategories: Array.from(arr),
                                  };
                                });
                              }}
                            />
                            <span>{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Leave all unchecked to apply to all categories.
                    </p>
                  </div>

                  {/* Scope: brands */}
                  <div className="md:col-span-3">
                    <label className="block text-sm text-gray-700 mb-1">
                      Allowed Brands (comma-separated)
                    </label>
                    <input
                      value={
                        Array.isArray(form.allowedBrands)
                          ? form.allowedBrands.join(", ")
                          : (form.allowedBrands as any) || ""
                      }
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          allowedBrands: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2"
                      placeholder="ASUS, Samsung"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to apply to all brands.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={save}
                    className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
                  >
                    {editing ? "Update" : "Create"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="card overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Window</th>
                    <th className="px-4 py-3">Min</th>
                    <th className="px-4 py-3">MaxCap</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">PerUser</th>
                    {canWrite && (
                      <th className="px-4 py-3 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        className="px-4 py-6 text-gray-600"
                        colSpan={colCount}
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : !list.length ? (
                    <tr>
                      <td
                        className="px-4 py-6 text-gray-600"
                        colSpan={colCount}
                      >
                        No coupons
                      </td>
                    </tr>
                  ) : (
                    list.map((c) => (
                      <tr
                        key={c._id}
                        className="border-t border-gray-200 text-gray-900"
                      >
                        <td className="px-4 py-3 font-medium">{c.code}</td>
                        <td className="px-4 py-3">{c.type}</td>
                        <td className="px-4 py-3">
                          {c.type === "percent"
                            ? `${c.value}%`
                            : currency(c.value)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              c.active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {c.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.allowedCategories && c.allowedCategories.length
                            ? `Cat: ${c.allowedCategories.join(", ")} `
                            : "Cat: All "}
                          {c.allowedBrands && c.allowedBrands.length
                            ? `| Brand: ${c.allowedBrands.join(", ")}`
                            : "| Brand: All"}
                        </td>
                        <td className="px-4 py-3">
                          {c.startsAt
                            ? new Date(c.startsAt).toLocaleString()
                            : "—"}{" "}
                          →{" "}
                          {c.expiresAt
                            ? new Date(c.expiresAt).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {c.minOrderValue ? currency(c.minOrderValue) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {c.maxDiscount ? currency(c.maxDiscount) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {c.usedCount ?? 0}
                          {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                        </td>
                        <td className="px-4 py-3">{c.perUserLimit ?? "—"}</td>

                        {canWrite && (
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => startEdit(c)}
                                className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleActive(c)}
                                className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              >
                                {c.active ? "Disable" : "Enable"}
                              </button>
                              <button
                                onClick={() => del(c)}
                                className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-500"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
