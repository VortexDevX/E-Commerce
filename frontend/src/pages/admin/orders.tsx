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
      className={`inline-flex items-center px-2 py-0.5 border-[3px] border-border shadow-[2px_2px_0px_#111] text-xs font-black uppercase tracking-widest ${color}`}
    >
      {text}
    </span>
  );
}

const statusColor = (s: AdminOrder["status"]) => {
  switch (s) {
    case "pending":
      return "bg-amber-400 text-amber-950";
    case "confirmed":
      return "bg-blue-400 text-blue-950";
    case "shipped":
      return "bg-indigo-400 text-indigo-950";
    case "delivered":
      return "bg-emerald-400 text-emerald-950";
    case "cancelled":
      return "bg-rose-400 text-rose-950";
    default:
      return "bg-gray-200 text-gray-900";
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
        <div className="flex items-center justify-between font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
          <h1 className="text-3xl text-foreground">Orders</h1>
          <Link
            href="/admin/logs"
            className="hidden md:inline-flex items-center px-4 py-2 border-[3px] border-border bg-card text-foreground shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none text-xs"
          >
            View Logs
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-8">
          <input
            placeholder="Search by order ID, email, or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all w-full md:w-96"
          />
          <div className="flex gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
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
                  <div className="text-foreground font-black tracking-widest text-lg">
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

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => toggleExpand(o._id)}
                    className="flex-1 text-left text-sm font-bold uppercase tracking-widest text-primary hover:underline transition-all"
                  >
                    {expanded.has(o._id) ? "Hide details" : "Show details"}
                  </button>
                  <Link
                    href={`/admin/logs?orderId=${o._id}`}
                    className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                  >
                    Logs
                  </Link>
                </div>

                {expanded.has(o._id) && (
                  <div className="border-t-[3px] border-border pt-3 mt-3 space-y-2">
                    {o.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="text-foreground font-bold uppercase tracking-widest text-xs truncate pr-4">
                          {(typeof it.product === "string"
                            ? it.product
                            : it.product?.title) || "Product"}{" "}
                          <span className="text-muted-foreground ml-1">× {it.qty}</span>
                        </div>
                        <div className="text-emerald-600 font-black tracking-widest text-xs whitespace-nowrap">
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
        <div className="hidden md:block bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted border-b-[3px] border-border">
              <tr className="text-left font-black uppercase tracking-widest text-foreground">
                <th className="px-5 py-4 border-r-[3px] border-border">Order</th>
                <th className="px-5 py-4 border-r-[3px] border-border">Customer</th>
                <th className="px-5 py-4 border-r-[3px] border-border text-center">Date</th>
                <th className="px-5 py-4 border-r-[3px] border-border text-right">Total</th>
                <th className="px-5 py-4 border-r-[3px] border-border text-center">Status</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-[3px] divide-border font-bold uppercase tracking-widest text-xs text-foreground bg-card">
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
                    <tr className="hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-4 border-r-[3px] border-border font-black">
                        #{o._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-5 py-4 border-r-[3px] border-border max-w-[200px] truncate" title={o.user?.email || "—"}>
                        <div>{o.user?.name || "—"}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {o.user?.email || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4 border-r-[3px] border-border text-center whitespace-nowrap">
                        {shortDate(o.createdAt)}
                      </td>
                      <td className="px-5 py-4 border-r-[3px] border-border text-right text-emerald-600 font-black whitespace-nowrap">
                        {currency(o.totalAmount)}
                      </td>
                      <td className="px-5 py-4 border-r-[3px] border-border">
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
                            className="bg-card border-[3px] border-border rounded-none px-2 py-1 text-foreground font-bold uppercase tracking-widest shadow-[2px_2px_0px_#111] focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none transition-all text-[10px] cursor-pointer"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Link
                            href={`/admin/logs?orderId=${o._id}`}
                            className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground shadow-[2px_2px_0px_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none text-[10px]"
                          >
                            Logs
                          </Link>
                          <button
                            onClick={() => toggleExpand(o._id)}
                            className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground shadow-[2px_2px_0px_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none text-[10px]"
                          >
                            {expanded.has(o._id) ? "Hide" : "Details"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded.has(o._id) && (
                      <tr className="bg-muted/30 border-t-[3px] border-dashed border-border">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="space-y-3 max-w-3xl">
                            {o.items.map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs font-bold uppercase tracking-widest bg-card border-[3px] border-border p-3 shadow-[2px_2px_0px_#111]"
                              >
                                <div className="text-foreground truncate pr-4">
                                  {(typeof it.product === "string"
                                    ? it.product
                                    : it.product?.title) || "Product"}{" "}
                                  <span className="text-muted-foreground ml-2">× {it.qty}</span>
                                </div>
                                <div className="text-emerald-600 font-black whitespace-nowrap">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-none bg-card border-[3px] border-border shadow-[12px_12px_0px_#111]">
              <div className="flex items-center justify-between px-6 py-4 border-b-[3px] border-border bg-primary/10">
                <h3 className="text-xl font-black uppercase tracking-widest text-foreground">
                  Update Order Status
                </h3>
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setTargetOrder(null);
                    setNote("");
                  }}
                  className="px-3 py-1.5 font-bold uppercase tracking-widest text-xs border-[3px] border-border bg-card text-foreground shadow-[2px_2px_0px_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                >
                  Close
                </button>
              </div>

              <div className="p-6 space-y-6 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-3 border-[3px] border-border border-dashed">
                    <div className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mb-1">Order ID</div>
                    <div className="text-foreground font-black tracking-widest">
                      #{targetOrder._id.slice(-6).toUpperCase()}
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 border-[3px] border-border border-dashed">
                    <div className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mb-1">Customer</div>
                    <div className="text-foreground font-bold truncate">
                      {targetOrder.user?.name || "—"}
                      <div className="text-[10px] text-muted-foreground">
                        {targetOrder.user?.email || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 bg-muted p-4 border-[3px] border-border flex flex-col items-center justify-center gap-3">
                    <div className="text-foreground font-bold uppercase tracking-widest text-[10px]">Status Change</div>
                    <div className="flex items-center gap-4">
                      <Pill
                        text={targetOrder.status}
                        color={statusColor(targetOrder.status)}
                      />
                      <span className="text-foreground font-black">→</span>
                      <Pill text={nextStatus} color={statusColor(nextStatus)} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-foreground font-bold uppercase tracking-widest text-xs mb-2">
                    Optional note / reason
                  </label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g., Payment verified, handed to courier..."
                    className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 px-6 py-4 border-t-[3px] border-border bg-muted">
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setTargetOrder(null);
                    setNote("");
                  }}
                  className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={updatingId === targetOrder._id}
                  className="px-4 py-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingId === targetOrder._id ? "Updating..." : "Confirm Update"}
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
