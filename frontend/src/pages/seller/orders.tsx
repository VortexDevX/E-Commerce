import dynamic from "next/dynamic";
import { Fragment, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import SellerLayout from "../../components/layout/SellerLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import api from "../../utils/api";
import { currency, shortDate } from "../../utils/format";
import { toast } from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { hasSellerPerm } from "../../utils/permissions";

type SellerOrder = {
  _id: string;
  user?: { name?: string; email?: string };
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  items: {
    product: { _id: string; title: string };
    qty: number;
    price: number;
  }[];
  sellerTotal: number;
  totalAmount: number;
};

const STATUSES: SellerOrder["status"][] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

function SellerOrdersPage() {
  const { user } = useAuth();
  const canRead = hasSellerPerm(user as any, "seller:orders:read");
  const canWrite = hasSellerPerm(user as any, "seller:orders:write");
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | SellerOrder["status"]>("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchMine = async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get("/seller/orders");
      setOrders(data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const ql = q.trim().toLowerCase();
      const matchesQ =
        !ql ||
        o._id.toLowerCase().includes(ql) ||
        o.user?.email?.toLowerCase().includes(ql) ||
        o.user?.name?.toLowerCase().includes(ql);
      const matchesS = status === "all" || o.status === status;
      return matchesQ && matchesS;
    });
  }, [orders, q, status]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateStatus = async (id: string, newStatus: SellerOrder["status"]) => {
    if (!canWrite) {
      toast.error("You don’t have permission to update order status");
      return;
    }
    setUpdating(id);
    try {
      await api.patch(`/seller/orders/${id}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      await fetchMine();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:orders:read"
          fallback={
            <div className="card p-6 text-gray-700">
              You don’t have access to Orders.
            </div>
          }
        >
          <h1 className="text-2xl font-semibold text-gray-900">
            Orders for My Products
          </h1>

          {/* Filters */}
          <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <input
              placeholder="Search by order ID, email, or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 w-full md:w-96"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 w-full md:w-52"
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="card p-4 text-gray-600">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="card p-4 text-gray-600">No orders found.</div>
            ) : (
              filtered.map((o) => (
                <div key={o._id} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">
                      #{o._id.slice(-6).toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {shortDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    {o.user?.name || "—"}{" "}
                    <span className="text-gray-500">
                      · {o.user?.email || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-gray-900 font-medium">
                      {currency(o.sellerTotal)}
                    </div>
                    <select
                      aria-label="Update order status"
                      disabled={updating === o._id}
                      value={o.status}
                      onChange={(e) =>
                        updateStatus(
                          o._id,
                          e.target.value as SellerOrder["status"]
                        )
                      }
                      className="bg-white border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => toggleExpand(o._id)}
                    className="w-full text-left text-sm text-purple-700 hover:underline"
                  >
                    {expanded.has(o._id) ? "Hide details" : "Show details"}
                  </button>
                  {expanded.has(o._id) && (
                    <div className="border-t border-gray-200 pt-2 space-y-1">
                      {o.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="text-gray-700">
                            {it.product.title} × {it.qty}
                          </div>
                          <div className="text-gray-900">
                            {currency(it.price * it.qty)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Seller Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-gray-600" colSpan={6}>
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-gray-600" colSpan={6}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <Fragment key={o._id}>
                      <tr className="border-t border-gray-200">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          #{o._id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>{o.user?.name || "—"}</div>
                          <div className="text-xs text-gray-500">
                            {o.user?.email || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {shortDate(o.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {currency(o.sellerTotal)}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label="Update order status"
                            disabled={updating === o._id}
                            value={o.status}
                            onChange={(e) =>
                              updateStatus(
                                o._id,
                                e.target.value as SellerOrder["status"]
                              )
                            }
                            className="relative z-10 bg-white border border-gray-300 rounded px-2 py-1 text-gray-900"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => toggleExpand(o._id)}
                            className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            {expanded.has(o._id) ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expanded.has(o._id) && (
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="space-y-2">
                              {o.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <div className="text-gray-700">
                                    {it.product.title} × {it.qty}
                                  </div>
                                  <div className="text-gray-900">
                                    {currency(it.price * it.qty)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerOrdersPage), { ssr: false });
