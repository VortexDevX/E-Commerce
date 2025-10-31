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
      return "bg-purple-100 text-purple-800";
    case "seller":
      return "bg-orange-100 text-orange-800";
    case "user":
      return "bg-teal-100 text-teal-800";
    default:
      return "bg-gray-100 text-gray-700";
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Logs</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("orders")}
              className={`px-3 py-1.5 rounded-md border ${
                tab === "orders"
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Order Status
            </button>
            <button
              onClick={() => setTab("actions")}
              className={`px-3 py-1.5 rounded-md border ${
                tab === "actions"
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Admin Actions
            </button>
          </div>
        </div>

        {/* Orders tab */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Order Status Logs
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Order ID
                  </label>
                  <input
                    value={oFilters.orderId}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, orderId: e.target.value }))
                    }
                    placeholder="e.g., 65f...d2a"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Changed By (email or ID)
                  </label>
                  <input
                    value={oFilters.changedBy}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, changedBy: e.target.value }))
                    }
                    placeholder="john@doe.com"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    To Status
                  </label>
                  <select
                    value={oFilters.toStatus}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, toStatus: e.target.value }))
                    }
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
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
                  <label className="block text-xs text-gray-600 mb-1">
                    Context
                  </label>
                  <select
                    value={oFilters.context}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, context: e.target.value }))
                    }
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
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
                  <label className="block text-xs text-gray-600 mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={oFilters.from}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, from: e.target.value }))
                    }
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">To</label>
                  <input
                    type="date"
                    value={oFilters.to}
                    onChange={(e) =>
                      setOFilters((f) => ({ ...f, to: e.target.value }))
                    }
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <button
                    onClick={() => fetchOrderLogs(1)}
                    className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
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
                    className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Order</th>
                      <th className="text-left px-4 py-3">From → To</th>
                      <th className="text-left px-4 py-3">Context</th>
                      <th className="text-left px-4 py-3">Changed By</th>
                      <th className="text-left px-4 py-3">Note</th>
                      <th className="text-left px-4 py-3">IP</th>
                      <th className="text-left px-4 py-3">UA</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {oLoading && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-6 text-center text-gray-500"
                        >
                          Loading...
                        </td>
                      </tr>
                    )}
                    {!oLoading && oResp.data.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-6 text-center text-gray-500"
                        >
                          No logs found.
                        </td>
                      </tr>
                    )}
                    {!oLoading &&
                      oResp.data.map((a) => (
                        <tr key={a._id} className="border-t border-gray-100">
                          <td className="px-4 py-3 text-gray-900">
                            {new Date(a.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span title={a.order} className="font-mono">
                              {shortId(a.order)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {a.fromStatus ? (
                                <Pill
                                  text={a.fromStatus}
                                  color={statusColor(a.fromStatus)}
                                />
                              ) : (
                                <span className="text-xs text-gray-500">—</span>
                              )}
                              <span className="text-gray-400">→</span>
                              <Pill
                                text={a.toStatus}
                                color={statusColor(a.toStatus)}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Pill
                              text={a.context}
                              color={ctxColor(a.context)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {a.changedBy ? (
                              <div className="flex flex-col">
                                <span className="text-gray-900">
                                  {a.changedBy.name || a.changedBy.email}
                                </span>
                                <span className="text-gray-500 text-xs">
                                  {a.changedBy.email}
                                </span>
                                <span className="text-gray-500 text-xs capitalize">
                                  {a.changedBy.role}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-500">system</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="line-clamp-2 max-w-[220px] text-gray-800">
                              {a.note || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {a.meta?.ip || "—"}
                          </td>
                          <td
                            className="px-4 py-3 text-gray-500 truncate max-w-[220px]"
                            title={a.meta?.ua}
                          >
                            {a.meta?.ua || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setODetail(a)}
                              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  Page {oResp.page} of{" "}
                  {Math.max(1, Math.ceil(oResp.total / oResp.limit))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={oPrev}
                    disabled={oLoading || oPage <= 1}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={oNext}
                    disabled={oLoading || !oResp.hasNext}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Order log details modal */}
            {oDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Log Details
                    </h3>
                    <button
                      onClick={() => setODetail(null)}
                      className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-gray-500">Date</div>
                        <div className="text-gray-900">
                          {new Date(oDetail.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Order</div>
                        <div className="font-mono">{oDetail.order}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">From → To</div>
                        <div className="flex items-center gap-2">
                          {oDetail.fromStatus ? (
                            <Pill
                              text={oDetail.fromStatus}
                              color={statusColor(oDetail.fromStatus)}
                            />
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                          <span className="text-gray-400">→</span>
                          <Pill
                            text={oDetail.toStatus}
                            color={statusColor(oDetail.toStatus)}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Context</div>
                        <Pill
                          text={oDetail.context}
                          color={ctxColor(oDetail.context)}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-500">Changed By</div>
                      <div className="text-gray-900">
                        {oDetail.changedBy
                          ? `${
                              oDetail.changedBy.name || oDetail.changedBy.email
                            } (${oDetail.changedBy.role})`
                          : "system"}
                      </div>
                      {oDetail.changedBy?.email && (
                        <div className="text-gray-500">
                          {oDetail.changedBy.email}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-gray-500">Note</div>
                      <div className="text-gray-900 whitespace-pre-wrap">
                        {oDetail.note || "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-gray-500">IP</div>
                        <div className="text-gray-900">
                          {oDetail.meta?.ip || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">User Agent</div>
                        <div className="text-gray-900 break-all">
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
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Admin Actions
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Action
                  </label>
                  <input
                    value={aFilters.action}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, action: e.target.value }))
                    }
                    placeholder="e.g., order.status.update"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={aFilters.entityType}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, entityType: e.target.value }))
                    }
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
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
                  <label className="block text-xs text-gray-600 mb-1">
                    Entity ID
                  </label>
                  <input
                    value={aFilters.entityId}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, entityId: e.target.value }))
                    }
                    placeholder="ObjectId or Plain ID"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Changed By (email or ID)
                  </label>
                  <input
                    value={aFilters.changedBy}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, changedBy: e.target.value }))
                    }
                    placeholder="admin@domain.com"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Search Summary
                  </label>
                  <input
                    value={aFilters.q}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, q: e.target.value }))
                    }
                    placeholder='e.g., "Deleted product"'
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={aFilters.from}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, from: e.target.value }))
                    }
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">To</label>
                  <input
                    type="date"
                    value={aFilters.to}
                    onChange={(e) =>
                      setAFilters((f) => ({ ...f, to: e.target.value }))
                    }
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <button
                    onClick={() => fetchActionLogs(1)}
                    className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
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
                    className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Action</th>
                      <th className="text-left px-4 py-3">Entity</th>
                      <th className="text-left px-4 py-3">Summary</th>
                      <th className="text-left px-4 py-3">Changed By</th>
                      <th className="text-left px-4 py-3">IP</th>
                      <th className="text-left px-4 py-3">UA</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {aLoading && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-6 text-center text-gray-500"
                        >
                          Loading...
                        </td>
                      </tr>
                    )}
                    {!aLoading && aResp.data.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-6 text-center text-gray-500"
                        >
                          No logs found.
                        </td>
                      </tr>
                    )}
                    {!aLoading &&
                      aResp.data.map((log) => (
                        <tr key={log._id} className="border-t border-gray-100">
                          <td className="px-4 py-3 text-gray-900">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {log.action}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-gray-900 capitalize">
                                {log.entityType}
                              </span>
                              <span
                                className="font-mono text-xs text-gray-600"
                                title={log.entityId}
                              >
                                {shortId(log.entityId)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="line-clamp-2 max-w-[320px] text-gray-800">
                              {log.summary || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {log.changedBy ? (
                              <div className="flex flex-col">
                                <span className="text-gray-900">
                                  {log.changedBy.name || log.changedBy.email}
                                </span>
                                <span className="text-gray-500 text-xs">
                                  {log.changedBy.email}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {log.meta?.ip || "—"}
                          </td>
                          <td
                            className="px-4 py-3 text-gray-500 truncate max-w-[220px]"
                            title={log.meta?.ua}
                          >
                            {log.meta?.ua || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setADetail(log)}
                              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  Page {aResp.page} of{" "}
                  {Math.max(1, Math.ceil(aResp.total / aResp.limit))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={aPrev}
                    disabled={aLoading || aPage <= 1}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={aNext}
                    disabled={aLoading || !aResp.hasNext}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Action details modal */}
            {aDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Action Details
                    </h3>
                    <button
                      onClick={() => setADetail(null)}
                      className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-4 space-y-4 text-sm">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-500">Date</div>
                        <div className="text-gray-900">
                          {new Date(aDetail.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Action</div>
                        <div className="text-gray-900">{aDetail.action}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Entity</div>
                        <div className="text-gray-900">
                          <span className="capitalize">
                            {aDetail.entityType}
                          </span>{" "}
                          ·{" "}
                          <span className="font-mono">{aDetail.entityId}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Changed By</div>
                        <div className="text-gray-900">
                          {aDetail.changedBy
                            ? `${
                                aDetail.changedBy.name ||
                                aDetail.changedBy.email
                              } (${aDetail.changedBy.role || "admin"})`
                            : "—"}
                        </div>
                        {aDetail.changedBy?.email && (
                          <div className="text-gray-500">
                            {aDetail.changedBy.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-500">Summary</div>
                      <div className="text-gray-900">
                        {aDetail.summary || "—"}
                      </div>
                    </div>

                    {aDetail.note && (
                      <div>
                        <div className="text-gray-500">Note</div>
                        <div className="text-gray-900 whitespace-pre-wrap">
                          {aDetail.note}
                        </div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-500">Before</div>
                        <pre className="mt-1 bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-64 text-xs">
                          {JSON.stringify(aDetail.before ?? null, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-gray-500">After</div>
                        <pre className="mt-1 bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-64 text-xs">
                          {JSON.stringify(aDetail.after ?? null, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-500">IP</div>
                        <div className="text-gray-900">
                          {aDetail.meta?.ip || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">User Agent</div>
                        <div className="text-gray-900 break-all">
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
