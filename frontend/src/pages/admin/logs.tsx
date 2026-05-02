import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";

type OrderAudit = {
  _id: string;
  order: string;
  fromStatus:
    | "pending"
    | "confirmed"
    | "shipped"
    | "delivered"
    | "cancelled"
    | null;
  toStatus: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  changedBy?: { _id: string; name?: string; email?: string; role?: string };
  changedByRole?: "user" | "seller" | "admin" | "system";
  context: "user" | "seller" | "admin" | "system";
  note?: string;
  meta?: { ip?: string; ua?: string };
  createdAt: string;
};

type AdminAction = {
  _id: string;
  action: string;
  entityType:
    | "user"
    | "product"
    | "order"
    | "coupon"
    | "media"
    | "emailTemplate"
    | "sellerRequest"
    | "banner"
    | "sponsored";
  entityId: string;
  summary?: string;
  before?: any;
  after?: any;
  note?: string;
  changedBy?: { _id: string; name?: string; email?: string; role?: string };
  meta?: { ip?: string; ua?: string };
  createdAt: string;
};

type Paged<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
};

const orderStatuses = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;
const contexts = ["user", "seller", "admin", "system"] as const;
const entityTypes = [
  "user",
  "product",
  "order",
  "coupon",
  "media",
  "emailTemplate",
  "sellerRequest",
  "banner",
  "sponsored",
] as const;

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}
    >
      {text}
    </span>
  );
}

const statusColor = (s?: string | null) => {
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

const ctxColor = (c?: string) => {
  switch (c) {
    case "admin":
      return "bg-purple-100 text-purple-950 border-purple-500";
    case "seller":
      return "bg-orange-100 text-orange-950 border-orange-500";
    case "user":
      return "bg-teal-100 text-teal-950 border-teal-500";
    default:
      return "bg-gray-100 text-gray-900 border-gray-400";
  }
};

const shortId = (id: string) =>
  id?.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;

export default function AdminLogsPage() {
  const router = useRouter();
  const bootstrappedRef = useRef(false);

  const [tab, setTab] = useState<"orders" | "actions">("orders");

  // Orders tab state
  const [oFilters, setOFilters] = useState({
    orderId: "",
    changedBy: "",
    toStatus: "",
    context: "",
    from: "",
    to: "",
  });
  const [oPage, setOPage] = useState(1);
  const [oLimit] = useState(20);
  const [oLoading, setOLoading] = useState(false);
  const [oResp, setOResp] = useState<Paged<OrderAudit>>({
    data: [],
    page: 1,
    limit: oLimit,
    total: 0,
    hasNext: false,
  });
  const [oDetail, setODetail] = useState<OrderAudit | null>(null);

  // Actions tab state
  const [aFilters, setAFilters] = useState({
    action: "",
    entityType: "",
    entityId: "",
    changedBy: "",
    q: "",
    from: "",
    to: "",
  });
  const [aPage, setAPage] = useState(1);
  const [aLimit] = useState(20);
  const [aLoading, setALoading] = useState(false);
  const [aResp, setAResp] = useState<Paged<AdminAction>>({
    data: [],
    page: 1,
    limit: aLimit,
    total: 0,
    hasNext: false,
  });
  const [aDetail, setADetail] = useState<AdminAction | null>(null);

  // Fetchers
  const fetchOrderLogs = async (pageArg = oPage) => {
    setOLoading(true);
    try {
      const params: any = { page: pageArg, limit: oLimit };
      for (const [k, v] of Object.entries(oFilters)) {
        if (v) params[k] = v;
      }
      const { data } = await api.get("/admin/logs/orders", { params });
      setOResp(data);
      setOPage(data.page);
    } catch (err) {
      console.error("Order logs error:", err);
      setOResp({ data: [], page: 1, limit: oLimit, total: 0, hasNext: false });
    } finally {
      setOLoading(false);
    }
  };

  const fetchActionLogs = async (pageArg = aPage) => {
    setALoading(true);
    try {
      const params: any = { page: pageArg, limit: aLimit };
      for (const [k, v] of Object.entries(aFilters)) {
        if (v) params[k] = v;
      }
      const { data } = await api.get("/admin/logs/actions", { params });
      setAResp(data);
      setAPage(data.page);
    } catch (err) {
      console.error("Action logs error:", err);
      setAResp({ data: [], page: 1, limit: aLimit, total: 0, hasNext: false });
    } finally {
      setALoading(false);
    }
  };

  // Auto-apply orderId from query once
  useEffect(() => {
    if (!router.isReady || bootstrappedRef.current) return;

    const orderIdFromQuery =
      typeof router.query.orderId === "string" ? router.query.orderId : "";

    if (orderIdFromQuery) {
      setOFilters((f) =>
        f.orderId === orderIdFromQuery ? f : { ...f, orderId: orderIdFromQuery }
      );
      setTab("orders");
      fetchOrderLogs(1);
    } else {
      // initial load default tab
      fetchOrderLogs(1);
    }
    bootstrappedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.orderId]);

  // If user switches tab to Actions for first time, load it
  useEffect(() => {
    if (tab === "actions" && aResp.total === 0 && !aLoading) {
      fetchActionLogs(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Pagination handlers
  const oPrev = () => {
    if (oLoading || oPage <= 1) return;
    fetchOrderLogs(oPage - 1);
  };
  const oNext = () => {
    if (oLoading || !oResp.hasNext) return;
    fetchOrderLogs(oPage + 1);
  };
  const aPrev = () => {
    if (aLoading || aPage <= 1) return;
    fetchActionLogs(aPage - 1);
  };
  const aNext = () => {
    if (aLoading || !aResp.hasNext) return;
    fetchActionLogs(aPage + 1);
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6 flex-wrap gap-4">
          <h1 className="text-3xl text-foreground">Logs</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTab("orders")}
              className={`px-4 py-2 border-[3px] shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none text-xs font-bold uppercase tracking-widest ${
                tab === "orders"
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-card border-border text-foreground"
              }`}
            >
              Order Status
            </button>
            <button
              onClick={() => setTab("actions")}
              className={`px-4 py-2 border-[3px] shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none text-xs font-bold uppercase tracking-widest ${
                tab === "actions"
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-card border-border text-foreground"
              }`}
            >
              Admin Actions
            </button>
          </div>
        </div>

        {/* Orders tab */}
        {tab === "orders" && (
          <div className="space-y-8">
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6">
              <h2 className="text-xl font-black uppercase tracking-widest text-foreground mb-6">
                Order Status Logs
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Order ID
                  </label>
                  <input
                    value={oFilters.orderId}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, orderId: e.target.value }))
                    }
                    placeholder="e.g., 65f...d2a"
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Changed By
                  </label>
                  <input
                    value={oFilters.changedBy}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, changedBy: e.target.value }))
                    }
                    placeholder="Email or ID"
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    To Status
                  </label>
                  <select
                    value={oFilters.toStatus}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, toStatus: e.target.value }))
                    }
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                  >
                    <option value="">All</option>
                    {orderStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Context
                  </label>
                  <select
                    value={oFilters.context}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, context: e.target.value }))
                    }
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                  >
                    <option value="">All</option>
                    {contexts.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    From
                  </label>
                  <input
                    type="date"
                    value={oFilters.from}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, from: e.target.value }))
                    }
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">To</label>
                  <input
                    type="date"
                    value={oFilters.to}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, to: e.target.value }))
                    }
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                  />
                </div>
                <div className="flex gap-4 items-end lg:col-span-2">
                  <button
                    onClick={() => fetchOrderLogs(1)}
                    className="flex-1 px-4 py-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => {
                      setOFilters({
                        orderId: "",
                        changedBy: "",
                        toStatus: "",
                        context: "",
                        from: "",
                        to: "",
                      });
                      fetchOrderLogs(1);
                    }}
                    className="flex-1 px-4 py-2 border-[3px] border-border bg-card text-foreground font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted border-b-[3px] border-border">
                  <tr className="text-left font-black uppercase tracking-widest text-foreground text-[10px]">
                    <th className="px-5 py-4 border-r-[3px] border-border">Date</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">Order</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">From → To</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">Context</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">Changed By</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">Note</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">IP</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">UA</th>
                    <th className="px-5 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-[3px] divide-border bg-card">
                  {oLoading && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-5 py-8 text-center text-muted-foreground font-bold tracking-widest uppercase"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!oLoading && oResp.data.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-5 py-8 text-center text-muted-foreground font-bold tracking-widest uppercase"
                      >
                        No logs found.
                      </td>
                    </tr>
                  )}
                  {!oLoading &&
                    oResp.data.map((a) => (
                      <tr key={a._id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-5 py-4 border-r-[3px] border-border text-foreground font-bold text-[10px] whitespace-nowrap">
                          {new Date(a.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border font-black text-foreground">
                          <span title={a.order}>
                            {shortId(a.order)}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border">
                          <div className="flex items-center gap-3">
                            {a.fromStatus ? (
                              <Pill
                                text={a.fromStatus}
                                color={statusColor(a.fromStatus)}
                              />
                            ) : (
                              <span className="text-muted-foreground font-black">—</span>
                            )}
                            <span className="text-foreground font-black">→</span>
                            <Pill
                              text={a.toStatus}
                              color={statusColor(a.toStatus)}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border">
                          <Pill
                            text={a.context}
                            color={ctxColor(a.context)}
                          />
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border">
                          {a.changedBy ? (
                            <div className="flex flex-col">
                              <span className="text-foreground font-black text-xs truncate max-w-[150px]">
                                {a.changedBy.name || a.changedBy.email}
                              </span>
                              <span className="text-muted-foreground text-[10px] font-bold tracking-widest mt-1 truncate max-w-[150px]">
                                {a.changedBy.email}
                              </span>
                              <span className="bg-primary/10 text-primary border-[2px] border-primary px-1 font-bold uppercase tracking-widest text-[8px] w-fit mt-2">
                                {a.changedBy.role}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground font-bold tracking-widest uppercase text-[10px]">system</span>
                          )}
                        </td>
                          <td className="px-5 py-4 border-r-[3px] border-border text-foreground font-bold text-xs">
                            <span className="line-clamp-2 max-w-[200px]" title={a.note}>
                              {a.note || "—"}
                            </span>
                          </td>
                          <td className="px-5 py-4 border-r-[3px] border-border text-foreground font-black text-[10px] tracking-widest whitespace-nowrap">
                            {a.meta?.ip || "—"}
                          </td>
                          <td
                            className="px-5 py-4 border-r-[3px] border-border text-muted-foreground font-bold text-[10px] truncate max-w-[150px]"
                            title={a.meta?.ua}
                          >
                            {a.meta?.ua || "—"}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => setODetail(a)}
                              className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all whitespace-nowrap"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t-[3px] border-border bg-muted">
                <div className="text-[10px] font-black uppercase tracking-widest text-foreground">
                  Page {oResp.page} of{" "}
                  {Math.max(1, Math.ceil(oResp.total / oResp.limit))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={oPrev}
                    disabled={oLoading || oPage <= 1}
                    className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_#111]"
                  >
                    Prev
                  </button>
                  <button
                    onClick={oNext}
                    disabled={oLoading || !oResp.hasNext}
                    className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_#111]"
                  >
                    Next
                  </button>
                </div>
              </div>
            {/* Order log details modal */}
            {oDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-none bg-card border-[3px] border-border shadow-[12px_12px_0px_#111] max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b-[3px] border-border bg-primary/10 shrink-0">
                    <h3 className="text-xl font-black uppercase tracking-widest text-foreground">
                      Log Details
                    </h3>
                    <button
                      onClick={() => setODetail(null)}
                      className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-xs shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Date</div>
                        <div className="text-foreground font-black tracking-widest text-xs">
                          {new Date(oDetail.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Order</div>
                        <div className="text-foreground font-black tracking-widest text-xs">{oDetail.order}</div>
                      </div>
                      <div className="col-span-2 bg-muted p-4 border-[3px] border-border flex flex-col items-center justify-center gap-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">From → To</div>
                        <div className="flex items-center gap-4">
                          {oDetail.fromStatus ? (
                            <Pill
                              text={oDetail.fromStatus}
                              color={statusColor(oDetail.fromStatus)}
                            />
                          ) : (
                            <span className="text-muted-foreground font-black tracking-widest">—</span>
                          )}
                          <span className="text-foreground font-black tracking-widest">→</span>
                          <Pill
                            text={oDetail.toStatus}
                            color={statusColor(oDetail.toStatus)}
                          />
                        </div>
                      </div>
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Context</div>
                        <Pill
                          text={oDetail.context}
                          color={ctxColor(oDetail.context)}
                        />
                      </div>
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Changed By</div>
                        <div className="text-foreground font-black tracking-widest text-xs truncate">
                          {oDetail.changedBy
                            ? `${
                                oDetail.changedBy.name || oDetail.changedBy.email
                              } (${oDetail.changedBy.role})`
                            : "system"}
                        </div>
                        {oDetail.changedBy?.email && (
                          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mt-1 truncate">
                            {oDetail.changedBy.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted p-4 border-[3px] border-border">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Note</div>
                      <div className="text-foreground font-bold tracking-widest text-xs whitespace-pre-wrap">
                        {oDetail.note || "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">IP Address</div>
                        <div className="text-foreground font-black tracking-widest text-[10px]">
                          {oDetail.meta?.ip || "—"}
                        </div>
                      </div>
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">User Agent</div>
                        <div className="text-foreground font-bold tracking-widest text-[10px] break-all">
                          {oDetail.meta?.ua || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin Actions tab */}
        {tab === "actions" && (
          <div className="space-y-8">
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6">
              <h2 className="text-xl font-black uppercase tracking-widest text-foreground mb-6">
                Admin Actions
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Action
                  </label>
                  <input
                    value={aFilters.action}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, action: e.target.value }))
                    }
                    placeholder="e.g., order.status.update"
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Entity Type
                  </label>
                  <select
                    value={aFilters.entityType}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, entityType: e.target.value }))
                    }
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                  >
                    <option value="">All</option>
                    {entityTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Entity ID
                  </label>
                  <input
                    value={aFilters.entityId}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, entityId: e.target.value }))
                    }
                    placeholder="ObjectId or Plain ID"
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Changed By
                  </label>
                  <input
                    value={aFilters.changedBy}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, changedBy: e.target.value }))
                    }
                    placeholder="Email or ID"
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Search Summary
                  </label>
                  <input
                    value={aFilters.q}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, q: e.target.value }))
                    }
                    placeholder='e.g., "Deleted product"'
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    From
                  </label>
                  <input
                    type="date"
                    value={aFilters.from}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, from: e.target.value }))
                    }
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">To</label>
                  <input
                    type="date"
                    value={aFilters.to}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, to: e.target.value }))
                    }
                    className="w-full bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                  />
                </div>
                <div className="flex gap-4 items-end">
                  <button
                    onClick={() => fetchActionLogs(1)}
                    className="flex-1 px-4 py-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => {
                      setAFilters({
                        action: "",
                        entityType: "",
                        entityId: "",
                        changedBy: "",
                        q: "",
                        from: "",
                        to: "",
                      });
                      fetchActionLogs(1);
                    }}
                    className="flex-1 px-4 py-2 border-[3px] border-border bg-card text-foreground font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted border-b-[3px] border-border">
                  <tr className="text-left font-black uppercase tracking-widest text-foreground text-[10px]">
                    <th className="px-5 py-4 border-r-[3px] border-border">Date</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">Action</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">Entity</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">Summary</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">Changed By</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">IP</th>
                    <th className="px-5 py-4 border-r-[3px] border-border">UA</th>
                    <th className="px-5 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-[3px] divide-border bg-card">
                  {aLoading && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-8 text-center text-muted-foreground font-bold tracking-widest uppercase"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!aLoading && aResp.data.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-8 text-center text-muted-foreground font-bold tracking-widest uppercase"
                      >
                        No logs found.
                      </td>
                    </tr>
                  )}
                  {!aLoading &&
                    aResp.data.map((log) => (
                      <tr key={log._id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-5 py-4 border-r-[3px] border-border text-foreground font-bold text-[10px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border">
                          <span className="bg-primary/10 text-primary border-[2px] border-primary px-2 py-0.5 font-bold uppercase tracking-widest text-[10px] whitespace-nowrap">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border">
                          <div className="flex flex-col">
                            <span className="text-foreground font-black text-xs uppercase tracking-widest">
                              {log.entityType}
                            </span>
                            <span
                              className="font-bold text-[10px] text-muted-foreground tracking-widest mt-1"
                              title={log.entityId}
                            >
                              {shortId(log.entityId)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border">
                          <span className="line-clamp-2 max-w-[250px] text-foreground font-bold text-xs">
                            {log.summary || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border">
                          {log.changedBy ? (
                            <div className="flex flex-col">
                              <span className="text-foreground font-black text-xs truncate max-w-[150px]">
                                {log.changedBy.name || log.changedBy.email}
                              </span>
                              <span className="text-muted-foreground text-[10px] font-bold tracking-widest mt-1 truncate max-w-[150px]">
                                {log.changedBy.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground font-bold tracking-widest uppercase text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 border-r-[3px] border-border text-foreground font-black text-[10px] tracking-widest whitespace-nowrap">
                          {log.meta?.ip || "—"}
                        </td>
                        <td
                          className="px-5 py-4 border-r-[3px] border-border text-muted-foreground font-bold text-[10px] truncate max-w-[150px]"
                          title={log.meta?.ua}
                        >
                          {log.meta?.ua || "—"}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => setADetail(log)}
                            className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all whitespace-nowrap"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t-[3px] border-border bg-muted">
              <div className="text-[10px] font-black uppercase tracking-widest text-foreground">
                Page {aResp.page} of{" "}
                {Math.max(1, Math.ceil(aResp.total / aResp.limit))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={aPrev}
                  disabled={aLoading || aPage <= 1}
                  className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_#111]"
                >
                  Prev
                </button>
                <button
                  onClick={aNext}
                  disabled={aLoading || !aResp.hasNext}
                  className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-[10px] shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_#111]"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Admin Action details modal */}
            {aDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-4xl rounded-none bg-card border-[3px] border-border shadow-[12px_12px_0px_#111] max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b-[3px] border-border bg-primary/10 shrink-0">
                    <h3 className="text-xl font-black uppercase tracking-widest text-foreground">
                      Action Details
                    </h3>
                    <button
                      onClick={() => setADetail(null)}
                      className="px-3 py-1.5 border-[3px] border-border bg-card text-foreground font-bold uppercase tracking-widest text-xs shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6 text-sm">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Date</div>
                        <div className="text-foreground font-black tracking-widest text-xs">
                          {new Date(aDetail.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Action</div>
                        <div className="text-foreground font-black tracking-widest text-xs bg-primary/10 text-primary border-[2px] border-primary px-2 py-0.5 inline-block uppercase w-fit">{aDetail.action}</div>
                      </div>
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Entity</div>
                        <div className="text-foreground font-black tracking-widest text-xs uppercase">
                          <span className="text-primary">{aDetail.entityType}</span>
                          <span className="text-muted-foreground mx-2">·</span>
                          <span>{aDetail.entityId}</span>
                        </div>
                      </div>
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Changed By</div>
                        <div className="text-foreground font-black tracking-widest text-xs truncate">
                          {aDetail.changedBy
                            ? `${
                                aDetail.changedBy.name ||
                                aDetail.changedBy.email
                              } (${aDetail.changedBy.role || "admin"})`
                            : "—"}
                        </div>
                        {aDetail.changedBy?.email && (
                          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mt-1 truncate">
                            {aDetail.changedBy.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted p-4 border-[3px] border-border">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Summary</div>
                      <div className="text-foreground font-bold tracking-widest text-xs">
                        {aDetail.summary || "—"}
                      </div>
                    </div>

                    {aDetail.note && (
                      <div className="bg-muted p-4 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Note</div>
                        <div className="text-foreground font-bold tracking-widest text-xs whitespace-pre-wrap">
                          {aDetail.note}
                        </div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="border-[3px] border-border flex flex-col">
                        <div className="bg-muted border-b-[3px] border-border p-2">
                           <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Before</div>
                        </div>
                        <pre className="bg-card p-4 overflow-auto max-h-64 text-xs font-bold text-foreground scrollbar-thin scrollbar-thumb-border scrollbar-track-muted flex-1">
                          {JSON.stringify(aDetail.before ?? null, null, 2)}
                        </pre>
                      </div>
                      <div className="border-[3px] border-border flex flex-col">
                        <div className="bg-muted border-b-[3px] border-border p-2">
                           <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">After</div>
                        </div>
                        <pre className="bg-card p-4 overflow-auto max-h-64 text-xs font-bold text-foreground scrollbar-thin scrollbar-thumb-border scrollbar-track-muted flex-1">
                          {JSON.stringify(aDetail.after ?? null, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">IP Address</div>
                        <div className="text-foreground font-black tracking-widest text-[10px]">
                          {aDetail.meta?.ip || "—"}
                        </div>
                      </div>
                      <div className="bg-muted p-3 border-[3px] border-border">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">User Agent</div>
                        <div className="text-foreground font-bold tracking-widest text-[10px] break-all">
                          {aDetail.meta?.ua || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
