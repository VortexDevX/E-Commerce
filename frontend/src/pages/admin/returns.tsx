import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";

type RRStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "refunded"
  | "cancelled";

type RRItem = {
  product: { _id: string; title?: string } | string;
  qty: number;
  price: number;
};

type ReturnRequest = {
  _id: string;
  order: { _id: string; totalAmount?: number } | string;
  user: { _id: string; name?: string; email?: string } | string;
  items: RRItem[];
  reason?: string;
  note?: string;
  attachments?: { url: string; name?: string }[];
  status: RRStatus;
  refund?: {
    method?: "manual" | "bank" | "upi";
    reference?: string;
    amount?: number;
  };
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  receivedAt?: string;
  refundedAt?: string;
  cancelledAt?: string;
};

type Paged<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
};

const statuses: RRStatus[] = [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
  "cancelled",
];
const RETURN_WINDOW_DAYS = Number(
  process.env.NEXT_PUBLIC_RETURN_WINDOW_DAYS || 7
);

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}
    >
      {text}
    </span>
  );
}

const statusColor = (s: RRStatus) => {
  switch (s) {
    case "requested":
      return "bg-blue-100 text-blue-800";
    case "approved":
      return "bg-indigo-100 text-indigo-800";
    case "rejected":
      return "bg-rose-100 text-rose-800";
    case "received":
      return "bg-yellow-100 text-yellow-800";
    case "refunded":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-gray-100 text-gray-700";
  }
};

const shortId = (id: string) =>
  id?.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;

function daysLeft(deliveredAtIso?: string) {
  if (!deliveredAtIso) return null;
  const deliveredAt = new Date(deliveredAtIso).getTime();
  const diffMs = Date.now() - deliveredAt;
  const used = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(RETURN_WINDOW_DAYS - used, 0);
}

const isImageUrl = (url?: string) =>
  !!url && /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(url);
const isVideoUrl = (url?: string) =>
  !!url && /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);

function AdminReturnsPage() {
  const [filters, setFilters] = useState({
    status: "",
    orderId: "",
    userId: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<Paged<ReturnRequest>>({
    data: [],
    page: 1,
    limit,
    total: 0,
    hasNext: false,
  });

  // deliveredAt cache per orderId (ISO)
  const [deliveredAtCache, setDeliveredAtCache] = useState<
    Record<string, string | null>
  >({});

  // Action modal state
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ReturnRequest | null>(null);
  const [nextStatus, setNextStatus] = useState<RRStatus>("approved");
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState<{
    method: "manual" | "bank" | "upi";
    reference?: string;
    amount?: number;
  }>({
    method: "manual",
  });
  const [submitting, setSubmitting] = useState(false);

  // Details modal state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<ReturnRequest | null>(
    null
  );

  const fetchList = async (pageArg = page) => {
    setLoading(true);
    try {
      const params: any = { page: pageArg, limit };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params[k] = v;
      }
      const { data } = await api.get("/admin/returns", { params });
      setResp(data);
      setPage(data.page);
    } catch (err) {
      console.error(err);
      setResp({ data: [], page: 1, limit, total: 0, hasNext: false });
      toast.error("Failed to load returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch deliveredAt for visible rows and cache it
  useEffect(() => {
    const fetchDeliveredForOrders = async () => {
      const orderIds = Array.from(
        new Set(
          resp.data
            .map((rr) =>
              typeof rr.order === "string" ? rr.order : rr.order._id
            )
            .filter(Boolean) as string[]
        )
      );

      for (const oid of orderIds) {
        if (deliveredAtCache[oid] !== undefined) continue;
        try {
          const { data } = await api.get(`/admin/orders/${oid}/audit`);
          const delivered = (Array.isArray(data) ? data : []).find(
            (a: any) => a.toStatus === "delivered"
          );
          setDeliveredAtCache((c) => ({
            ...c,
            [oid]: delivered?.createdAt || null,
          }));
        } catch {
          setDeliveredAtCache((c) => ({ ...c, [oid]: null }));
        }
      }
    };
    if (resp.data.length > 0) fetchDeliveredForOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resp.data]);

  const openAction = (rr: ReturnRequest, status: RRStatus) => {
    setTarget(rr);
    setNextStatus(status);
    setNote("");
    setRefund({ method: "manual" });
    setOpen(true);
  };

  const openDetails = (rr: ReturnRequest) => {
    setDetailsTarget(rr);
    setDetailsOpen(true);
  };

  const canTransition = (rr: ReturnRequest, status: RRStatus) => {
    const prev = rr.status;
    if (status === prev) return false;
    if (prev === "rejected" || prev === "cancelled") return false;
    if (status === "approved" && prev === "requested") return true;
    if (status === "rejected" && prev === "requested") return true;
    if (status === "received" && prev === "approved") return true;
    if (status === "refunded" && (prev === "approved" || prev === "received"))
      return true;
    if (status === "cancelled" && prev === "requested") return true;
    return false;
  };

  const submitAction = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const payload: any = {
        status: nextStatus,
        note: note?.trim() || undefined,
      };
      if (nextStatus === "refunded") {
        payload.refund = {
          method: refund.method || "manual",
          reference: refund.reference || "",
          amount: refund.amount != null ? Number(refund.amount) : undefined,
        };
      }
      await api.patch(`/admin/returns/${target._id}/status`, payload);
      toast.success(`Marked ${nextStatus}`);
      setOpen(false);
      setTarget(null);
      await fetchList(page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const prevPage = () => {
    if (loading || page <= 1) return;
    fetchList(page - 1);
  };
  const nextPage = () => {
    if (loading || !resp.hasNext) return;
    fetchList(page + 1);
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">Returns</h1>
          <Link
            href="/admin/logs?tab=actions"
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            View Logs
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Order ID
              </label>
              <input
                value={filters.orderId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, orderId: e.target.value }))
                }
                placeholder="e.g., 65f..d2a"
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                User ID
              </label>
              <input
                value={filters.userId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, userId: e.target.value }))
                }
                placeholder="User ObjectId"
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from: e.target.value }))
                }
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to: e.target.value }))
                }
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <button
                onClick={() => fetchList(1)}
                className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setFilters({
                    status: "",
                    orderId: "",
                    userId: "",
                    from: "",
                    to: "",
                  });
                  fetchList(1);
                }}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">Requested</th>
                  <th className="text-left px-4 py-3">Order</th>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Items</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Attachment</th>
                  <th className="text-left px-4 py-3">Return window</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && resp.data.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No return requests
                    </td>
                  </tr>
                )}
                {!loading &&
                  resp.data.map((rr) => {
                    const attachment = rr.attachments?.[0];
                    const orderId =
                      typeof rr.order === "string" ? rr.order : rr.order._id;
                    const dAt = deliveredAtCache[orderId]; // may be undefined until fetched
                    const left = dAt ? daysLeft(dAt) : null;
                    const leftText =
                      left == null
                        ? "—"
                        : left > 0
                        ? `${left} day${left === 1 ? "" : "s"} left`
                        : "Expired";
                    return (
                      <tr key={rr._id} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-gray-900">
                          {new Date(rr.requestedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-mono">
                              {shortId(orderId)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {typeof rr.order !== "string" &&
                              rr.order.totalAmount != null
                                ? `₹${rr.order.totalAmount}`
                                : ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-gray-900">
                              {typeof rr.user === "string"
                                ? shortId(rr.user)
                                : rr.user.name || rr.user.email}
                            </span>
                            <span className="text-xs text-gray-500">
                              {typeof rr.user !== "string" ? rr.user.email : ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {rr.items.map((it, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-gray-700">
                                  {(typeof it.product === "string"
                                    ? it.product
                                    : it.product?.title) || "Item"}{" "}
                                  × {it.qty}
                                </span>
                                <span className="text-gray-900">
                                  ₹{(it.qty * it.price).toLocaleString("en-IN")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Pill
                            text={rr.status}
                            color={statusColor(rr.status)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {attachment ? (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-700 hover:underline"
                            >
                              {attachment.name || "attachment"}
                            </a>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm ${
                              left === 0 ? "text-rose-600" : "text-gray-800"
                            }`}
                            title={dAt || ""}
                          >
                            {leftText}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              onClick={() => openDetails(rr)}
                              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            >
                              Details
                            </button>
                            {canTransition(rr, "approved") && (
                              <button
                                onClick={() => openAction(rr, "approved")}
                                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              >
                                Approve
                              </button>
                            )}
                            {canTransition(rr, "rejected") && (
                              <button
                                onClick={() => openAction(rr, "rejected")}
                                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              >
                                Reject
                              </button>
                            )}
                            {canTransition(rr, "received") && (
                              <button
                                onClick={() => openAction(rr, "received")}
                                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              >
                                Mark received
                              </button>
                            )}
                            {canTransition(rr, "refunded") && (
                              <button
                                onClick={() => openAction(rr, "refunded")}
                                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              >
                                Refund
                              </button>
                            )}
                            {canTransition(rr, "cancelled") && (
                              <button
                                onClick={() => openAction(rr, "cancelled")}
                                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              Page {resp.page} of{" "}
              {Math.max(1, Math.ceil(resp.total / resp.limit))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={prevPage}
                disabled={loading || page <= 1}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={nextPage}
                disabled={loading || !resp.hasNext}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Action Modal */}
        {open && target && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  Update Return Status
                </h3>
                <button
                  onClick={() => {
                    setOpen(false);
                    setTarget(null);
                    setNote("");
                    setRefund({ method: "manual" });
                  }}
                  className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              <div className="p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-gray-500">Request</div>
                    <div className="font-mono">{shortId(target._id)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Order</div>
                    <div className="font-mono">
                      {typeof target.order === "string"
                        ? target.order
                        : target.order._id}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Next status
                  </label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as RRStatus)}
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  >
                    {statuses.map((s) => (
                      <option
                        key={s}
                        value={s}
                        disabled={
                          ![
                            "approved",
                            "rejected",
                            "received",
                            "refunded",
                            "cancelled",
                          ].includes(s)
                        }
                      >
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {nextStatus === "refunded" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-gray-700 mb-1">Method</label>
                      <select
                        value={refund.method}
                        onChange={(e) =>
                          setRefund((r) => ({
                            ...r,
                            method: e.target.value as any,
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="manual">manual</option>
                        <option value="bank">bank</option>
                        <option value="upi">upi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1">
                        Reference
                      </label>
                      <input
                        value={refund.reference || ""}
                        onChange={(e) =>
                          setRefund((r) => ({
                            ...r,
                            reference: e.target.value,
                          }))
                        }
                        placeholder="txn/ref id"
                        className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={refund.amount ?? ""}
                        onChange={(e) =>
                          setRefund((r) => ({
                            ...r,
                            amount: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-gray-700 mb-1">
                    Note (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note/reason…"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => {
                    setOpen(false);
                    setTarget(null);
                    setNote("");
                    setRefund({ method: "manual" });
                  }}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAction}
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Update"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {detailsOpen && detailsTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
                <h3 className="text-lg font-semibold text-gray-900">
                  Return details
                </h3>
                <button
                  onClick={() => {
                    setDetailsOpen(false);
                    setDetailsTarget(null);
                  }}
                  className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              <div className="p-4 space-y-4 text-sm">
                {/* Top meta */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-500">Request ID</div>
                    <div className="font-mono">{detailsTarget._id}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Requested</div>
                    <div className="text-gray-900">
                      {new Date(detailsTarget.requestedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Order</div>
                    <div className="text-gray-900">
                      {typeof detailsTarget.order === "string"
                        ? detailsTarget.order
                        : detailsTarget.order._id}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">User</div>
                    <div className="text-gray-900">
                      {typeof detailsTarget.user === "string"
                        ? detailsTarget.user
                        : `${
                            detailsTarget.user.name || detailsTarget.user.email
                          } (${detailsTarget.user.email || "—"})`}
                    </div>
                  </div>
                </div>

                {/* Status & return window */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-500">Status</div>
                    <Pill
                      text={detailsTarget.status}
                      color={statusColor(detailsTarget.status)}
                    />
                  </div>
                  <div>
                    <div className="text-gray-500">Return window</div>
                    <div className="text-gray-900">
                      {(() => {
                        const orderId =
                          typeof detailsTarget.order === "string"
                            ? detailsTarget.order
                            : detailsTarget.order._id;
                        const dAt = deliveredAtCache[orderId];
                        if (!dAt) return "—";
                        const left = daysLeft(dAt);
                        return left != null
                          ? left > 0
                            ? `${left} day${left === 1 ? "" : "s"} left`
                            : "Expired"
                          : "—";
                      })()}
                    </div>
                  </div>
                </div>

                {/* Reason & note */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-500">Reason</div>
                    <div className="text-gray-900 whitespace-pre-wrap">
                      {detailsTarget.reason || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Note</div>
                    <div className="text-gray-900 whitespace-pre-wrap">
                      {detailsTarget.note || "—"}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="text-gray-500 mb-1">Items</div>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="text-left px-3 py-2">Product</th>
                            <th className="text-left px-3 py-2">Qty</th>
                            <th className="text-left px-3 py-2">Price</th>
                            <th className="text-left px-3 py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsTarget.items.map((it, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-3 py-2">
                                {(typeof it.product === "string"
                                  ? it.product
                                  : it.product?.title) || "Item"}
                              </td>
                              <td className="px-3 py-2">{it.qty}</td>
                              <td className="px-3 py-2">
                                ₹{it.price.toLocaleString("en-IN")}
                              </td>
                              <td className="px-3 py-2">
                                ₹{(it.qty * it.price).toLocaleString("en-IN")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Attachment preview */}
                <div>
                  <div className="text-gray-500 mb-1">Attachment</div>
                  {detailsTarget.attachments?.[0] ? (
                    <div className="space-y-2">
                      {isImageUrl(detailsTarget.attachments[0].url) ? (
                        <img
                          src={detailsTarget.attachments[0].url}
                          alt={
                            detailsTarget.attachments[0].name || "attachment"
                          }
                          className="max-h-64 rounded border border-gray-200 object-contain"
                          onError={(e) =>
                            ((e.currentTarget as HTMLImageElement).src =
                              "/fallback.png")
                          }
                        />
                      ) : isVideoUrl(detailsTarget.attachments[0].url) ? (
                        <video
                          src={detailsTarget.attachments[0].url}
                          controls
                          className="w-full rounded border border-gray-200"
                        />
                      ) : (
                        <a
                          href={detailsTarget.attachments[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-700 hover:underline"
                        >
                          {detailsTarget.attachments[0].name || "Download"}
                        </a>
                      )}
                      <div className="text-xs text-gray-500">
                        <a
                          href={detailsTarget.attachments[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-700 hover:underline"
                        >
                          Open in new tab
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-700">—</div>
                  )}
                </div>

                {/* Timeline */}
                <div>
                  <div className="text-gray-500 mb-1">Timeline</div>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Requested: </span>
                      <span className="text-gray-900">
                        {detailsTarget.requestedAt
                          ? new Date(detailsTarget.requestedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Approved: </span>
                      <span className="text-gray-900">
                        {detailsTarget.approvedAt
                          ? new Date(detailsTarget.approvedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Rejected: </span>
                      <span className="text-gray-900">
                        {detailsTarget.rejectedAt
                          ? new Date(detailsTarget.rejectedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Received: </span>
                      <span className="text-gray-900">
                        {detailsTarget.receivedAt
                          ? new Date(detailsTarget.receivedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Refunded: </span>
                      <span className="text-gray-900">
                        {detailsTarget.refundedAt
                          ? new Date(detailsTarget.refundedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Cancelled: </span>
                      <span className="text-gray-900">
                        {detailsTarget.cancelledAt
                          ? new Date(detailsTarget.cancelledAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Refund info */}
                {detailsTarget.status === "refunded" &&
                  detailsTarget.refund && (
                    <div>
                      <div className="text-gray-500 mb-1">Refund</div>
                      <div className="grid md:grid-cols-3 gap-3">
                        <div>
                          <div className="text-gray-500">Method</div>
                          <div className="text-gray-900">
                            {detailsTarget.refund.method || "manual"}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Reference</div>
                          <div className="text-gray-900">
                            {detailsTarget.refund.reference || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Amount</div>
                          <div className="text-gray-900">
                            {detailsTarget.refund.amount != null
                              ? `₹${detailsTarget.refund.amount.toLocaleString(
                                  "en-IN"
                                )}`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminReturnsPage), { ssr: false });
