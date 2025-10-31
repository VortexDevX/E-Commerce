import { useEffect, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import toast from "react-hot-toast";

type Placement = {
  _id: string;
  product:
    | string
    | {
        _id: string;
        title: string;
        brand?: string;
        price?: number;
        stock?: number;
      };
  seller?: string;
  status: "pending" | "approved" | "rejected" | "paused";
  startAt?: string | null;
  endAt?: string | null;
  priority: number;
  notes?: string;
  targetCategorySlug?: string;
  impressions?: number;
  clicks?: number;
  createdAt: string;
  updatedAt: string;
};

export default function SponsoredAdminPage() {
  const [list, setList] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<
    "" | "approved" | "pending" | "paused" | "rejected"
  >("");

  // Create form fields
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState<Placement["status"]>("approved");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [priority, setPriority] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [targetCategorySlug, setTargetCategorySlug] = useState("");

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/sponsored", {
        params: filterStatus ? { status: filterStatus } : {},
      });
      setList(data || []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Failed to load sponsored placements"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const create = async () => {
    if (!productId.trim()) {
      toast.error("Product ID is required");
      return;
    }
    try {
      await api.post("/admin/sponsored", {
        productId: productId.trim(),
        status,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        priority: Number(priority) || 0,
        notes: notes || undefined,
        targetCategorySlug: targetCategorySlug
          ? targetCategorySlug.trim().toLowerCase()
          : undefined,
      });
      toast.success("Placement created");
      setProductId("");
      setStatus("approved");
      setStartAt("");
      setEndAt("");
      setPriority(0);
      setNotes("");
      setTargetCategorySlug("");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Create failed");
    }
  };

  const update = async (id: string, patch: Partial<Placement>) => {
    try {
      await api.patch(`/admin/sponsored/${id}`, patch);
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this placement?")) return;
    try {
      await api.delete(`/admin/sponsored/${id}`);
      toast.success("Deleted");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const toLocal = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "-";

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Sponsored Listings
          </h1>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as typeof filterStatus)
              }
              className="border border-gray-300 rounded-md px-3 py-2 text-gray-700"
            >
              <option value="">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="paused">Paused</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              onClick={fetchList}
              className="px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Create form */}
        <div className="card p-4 mt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Product ID
              </label>
              <input
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="Mongo _id of product"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="paused">Paused</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Target Category Slug (optional)
              </label>
              <input
                value={targetCategorySlug}
                onChange={(e) => setTargetCategorySlug(e.target.value)}
                placeholder="e.g., electronics"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Start At
              </label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">End At</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Priority
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value || 0))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-700 mb-1">
                Notes (optional)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal note"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <button
                onClick={create}
                className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
              >
                Create Placement
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="card p-4 mt-4 overflow-x-auto">
          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : list.length === 0 ? (
            <div className="text-gray-600">No placements found.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Schedule / Target</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Stats</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((pl) => {
                  const prod =
                    typeof pl.product === "string"
                      ? undefined
                      : (pl.product as any);
                  return (
                    <tr key={pl._id} className="border-t border-gray-200">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">
                          {prod?.title || pl.product}
                        </div>
                        {prod?.brand && (
                          <div className="text-xs text-gray-500">
                            {prod.brand}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 capitalize">{pl.status}</td>
                      <td className="px-3 py-2">
                        <div className="text-xs text-gray-700">
                          {toLocal(pl.startAt)} → {toLocal(pl.endAt)}
                        </div>
                        {pl.targetCategorySlug && (
                          <div className="text-xs text-gray-500">
                            Target: {pl.targetCategorySlug}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">{pl.priority}</td>
                      <td className="px-3 py-2">
                        <div className="text-xs text-gray-700">
                          {pl.impressions || 0} views
                          {typeof pl.clicks === "number"
                            ? ` · ${pl.clicks} clicks`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() =>
                              update(pl._id, { status: "approved" })
                            }
                            className="px-3 py-1 border border-emerald-300 rounded-md bg-white text-emerald-700 hover:bg-emerald-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => update(pl._id, { status: "paused" })}
                            className="px-3 py-1 border border-amber-300 rounded-md bg-white text-amber-700 hover:bg-amber-50"
                          >
                            Pause
                          </button>
                          <button
                            onClick={() =>
                              update(pl._id, { status: "rejected" })
                            }
                            className="px-3 py-1 border border-rose-300 rounded-md bg-white text-rose-700 hover:bg-rose-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => remove(pl._id)}
                            className="px-3 py-1 border border-rose-300 rounded-md bg-white text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
