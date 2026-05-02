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
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-sm text-center">
              You don&apos;t have access to Orders.
            </div>
          }
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
            <div>
              <h1 className="text-3xl text-foreground">
                Orders for My Products
              </h1>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-8">
            <input
              placeholder="Search by order ID, email, or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all w-full md:w-96"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all w-full md:w-52 uppercase"
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
          <div className="md:hidden space-y-4">
            {loading ? (
              <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-bold uppercase tracking-widest text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-bold uppercase tracking-widest text-sm text-center">No orders found.</div>
            ) : (
              filtered.map((o) => (
                <div key={o._id} className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b-[3px] border-border pb-2">
                    <div className="font-black text-foreground uppercase tracking-widest text-sm">
                      #{o._id.slice(-6).toUpperCase()}
                    </div>
                    <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                      {shortDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {o.user?.name || "—"}{" "}
                    <span className="text-muted-foreground">
                      · {o.user?.email || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-primary font-black text-sm">
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
                      className={`bg-card border-[3px] border-border rounded-none px-2 py-1 text-foreground font-bold shadow-[2px_2px_0px_#111] focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] hover:shadow-none transition-all text-[10px] uppercase ${
                        o.status === "delivered" ? "!bg-emerald-400 !text-emerald-950" :
                        o.status === "cancelled" ? "!bg-rose-400 !text-rose-950" :
                        o.status === "shipped" ? "!bg-blue-400 !text-blue-950" :
                        "!bg-amber-400 !text-amber-950"
                      }`}
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
                    className="w-full text-center border-[3px] border-border bg-card shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all font-bold uppercase text-[10px] py-2 mt-2"
                  >
                    {expanded.has(o._id) ? "Hide details" : "Show details"}
                  </button>
                  {expanded.has(o._id) && (
                    <div className="border-t-[3px] border-border pt-3 mt-1 space-y-2">
                      {o.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="font-bold text-foreground tracking-widest uppercase">
                            {it.product.title} × {it.qty}
                          </div>
                          <div className="font-black text-foreground">
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
                <tr className="text-left font-black uppercase tracking-widest text-[10px] text-foreground">
                  <th className="px-6 py-4 border-r-[3px] border-border">Order</th>
                  <th className="px-6 py-4 border-r-[3px] border-border">Customer</th>
                  <th className="px-6 py-4 border-r-[3px] border-border">Date</th>
                  <th className="px-6 py-4 border-r-[3px] border-border text-center">Status</th>
                  <th className="px-6 py-4 border-r-[3px] border-border text-center">Seller Total</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-[3px] divide-border">
                {loading ? (
                  <tr>
                    <td className="px-6 py-8 text-foreground font-bold uppercase tracking-widest text-[10px] text-center bg-muted/30" colSpan={6}>
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-foreground font-bold uppercase tracking-widest text-[10px] text-center bg-muted/30" colSpan={6}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <Fragment key={o._id}>
                      <tr className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 border-r-[3px] border-border font-black text-xs text-foreground uppercase tracking-widest">
                          #{o._id.slice(-6)}
                        </td>
                        <td className="px-6 py-4 border-r-[3px] border-border">
                          <div className="font-bold text-xs text-foreground uppercase tracking-widest truncate max-w-[200px]" title={o.user?.name}>{o.user?.name || "—"}</div>
                          <div className="font-bold text-[10px] text-muted-foreground tracking-widest truncate max-w-[200px]" title={o.user?.email}>
                            {o.user?.email || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 border-r-[3px] border-border font-bold text-[10px] tracking-widest text-foreground">
                          {shortDate(o.createdAt)}
                        </td>
                        <td className="px-6 py-4 border-r-[3px] border-border text-center">
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
                              className={`bg-card border-[3px] border-border rounded-none px-2 py-1 text-foreground font-bold shadow-[2px_2px_0px_#111] focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] hover:shadow-none transition-all text-[10px] uppercase w-[120px] text-center ${
                                o.status === "delivered" ? "!bg-emerald-400 !text-emerald-950" :
                                o.status === "cancelled" ? "!bg-rose-400 !text-rose-950" :
                                o.status === "shipped" ? "!bg-blue-400 !text-blue-950" :
                                "!bg-amber-400 !text-amber-950"
                              }`}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                        <td className="px-6 py-4 border-r-[3px] border-border font-black text-sm text-primary text-center">
                          {currency(o.sellerTotal)}
                        </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleExpand(o._id)}
                              className={`px-4 py-2 border-[3px] border-border uppercase tracking-widest font-black text-[10px] transition-all hover:translate-x-[2px] hover:translate-y-[2px] ${expanded.has(o._id) ? "bg-primary text-primary-foreground shadow-none translate-x-[2px] translate-y-[2px]" : "bg-card text-foreground shadow-[2px_2px_0px_#111] hover:shadow-none"}`}
                            >
                              {expanded.has(o._id) ? "Hide" : "Details"}
                            </button>
                        </td>
                      </tr>
                      {expanded.has(o._id) && (
                        <tr className="bg-muted/30 border-t-[3px] border-border">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="space-y-3">
                              {o.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs font-bold p-3 border-[3px] border-border bg-card shadow-[4px_4px_0px_#111]"
                                >
                                  <div className="text-foreground tracking-widest uppercase truncate max-w-[70%]">
                                    {it.product.title} × {it.qty}
                                  </div>
                                  <div className="text-foreground font-black">
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
