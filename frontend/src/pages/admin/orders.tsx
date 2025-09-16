import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { currency, shortDate } from "../../utils/format";

type OrderItem = {
  product: { _id: string; title?: string } | string;
  qty: number;
  price: number;
};

type AdminOrder = {
  _id: string;
  user?: { _id: string; name: string; email: string };
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
};

const STATUSES: AdminOrder["status"][] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}
    >
      {text}
    </span>
  );
}

const statusColor = (s: AdminOrder["status"]) => {
  switch (s) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "confirmed":
      return "bg-blue-100 text-blue-800";
    case "shipped":
      return "bg-indigo-100 text-indigo-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | AdminOrder["status"]>("all");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modal state for confirming status change with note
  const [modalOpen, setModalOpen] = useState(false);
  const [targetOrder, setTargetOrder] = useState<AdminOrder | null>(null);
  const [nextStatus, setNextStatus] = useState<AdminOrder["status"]>("pending");
  const [note, setNote] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/orders");
      setOrders(data);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchesQ =
        !q ||
        o._id.toLowerCase().includes(q.toLowerCase()) ||
        o.user?.email?.toLowerCase().includes(q.toLowerCase()) ||
        o.user?.name?.toLowerCase().includes(q.toLowerCase());
      const matchesStatus = status === "all" || o.status === status;
      return matchesQ && matchesStatus;
    });
  }, [orders, q, status]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open modal to confirm status change and capture optional note
  const requestStatusChange = (
    order: AdminOrder,
    newStatus: AdminOrder["status"]
  ) => {
    if (order.status === newStatus) return;
    setTargetOrder(order);
    setNextStatus(newStatus);
    setNote("");
    setModalOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!targetOrder) return;
    setUpdatingId(targetOrder._id);
    try {
      await api.patch(`/admin/orders/${targetOrder._id}/status`, {
        status: nextStatus,
        note: note?.trim() || undefined,
      });
      toast.success(`Status updated to ${nextStatus}`);
      setModalOpen(false);
      setTargetOrder(null);
      setNote("");
      await fetchOrders();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
          <Link
            href="/admin/logs"
            className="hidden md:inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            View Logs
          </Link>
        </div>

        {/* Filters */}
        <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            placeholder="Search by order ID, email, or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 w-full md:w-96"
          />
          <div className="flex gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900"
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile list */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="card p-4 text-gray-600">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="card p-4 text-gray-600">No orders found.</div>
          ) : (
            filtered.map((o) => (
              <div key={o._id} className="card p-4 space-y-3">
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
                    {currency(o.totalAmount)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden xs:block">
                      <Pill text={o.status} color={statusColor(o.status)} />
                    </div>
                    <select
                      disabled={updatingId === o._id}
                      value={o.status}
                      onChange={(e) =>
                        requestStatusChange(
                          o,
                          e.target.value as AdminOrder["status"]
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
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpand(o._id)}
                    className="flex-1 text-left text-sm text-purple-700 hover:underline"
                  >
                    {expanded.has(o._id) ? "Hide details" : "Show details"}
                  </button>
                  <Link
                    href={`/admin/logs?orderId=${o._id}`}
                    className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 text-sm hover:bg-gray-50"
                  >
                    View Logs
                  </Link>
                </div>

                {expanded.has(o._id) && (
                  <div className="border-t border-gray-200 pt-2 space-y-1">
                    {o.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="text-gray-700">
                          {(typeof it.product === "string"
                            ? it.product
                            : it.product?.title) || "Product"}{" "}
                          × {it.qty}
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
                <th className="px-4 py-3">Total</th>
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
                        {currency(o.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Pill text={o.status} color={statusColor(o.status)} />
                          <select
                            disabled={updatingId === o._id}
                            value={o.status}
                            onChange={(e) =>
                              requestStatusChange(
                                o,
                                e.target.value as AdminOrder["status"]
                              )
                            }
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/logs?orderId=${o._id}`}
                            className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            View Logs
                          </Link>
                          <button
                            onClick={() => toggleExpand(o._id)}
                            className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            {expanded.has(o._id) ? "Hide" : "Details"}
                          </button>
                        </div>
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
                                  {(typeof it.product === "string"
                                    ? it.product
                                    : it.product?.title) || "Product"}{" "}
                                  × {it.qty}
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

        {/* Modal: confirm status change with optional note */}
        {modalOpen && targetOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  Update Order Status
                </h3>
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setTargetOrder(null);
                    setNote("");
                  }}
                  className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              <div className="p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-gray-500">Order</div>
                    <div className="text-gray-900 font-mono">
                      #{targetOrder._id.slice(-6).toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Customer</div>
                    <div className="text-gray-900">
                      {targetOrder.user?.name || "—"}
                      <div className="text-xs text-gray-500">
                        {targetOrder.user?.email || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500 mb-1">From → To</div>
                    <div className="flex items-center gap-2">
                      <Pill
                        text={targetOrder.status}
                        color={statusColor(targetOrder.status)}
                      />
                      <span className="text-gray-400">→</span>
                      <Pill text={nextStatus} color={statusColor(nextStatus)} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Optional note / reason
                  </label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g., Payment verified, handed to courier, customer requested cancel…"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setTargetOrder(null);
                    setNote("");
                  }}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={updatingId === targetOrder._id}
                  className="px-4 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-60"
                >
                  {updatingId === targetOrder._id ? "Updating..." : "Update"}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminOrdersPage), { ssr: false });
