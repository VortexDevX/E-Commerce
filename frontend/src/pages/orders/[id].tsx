import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { fetchOrder } from "../../store/slices/orderSlice";
import type { AppDispatch, RootState } from "../../store";
import { currency, shortDate } from "../../utils/format";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import { getImageUrl } from "../../utils/images";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${color}`}>
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
    shipped: "bg-blue-50 text-blue-700 border-blue-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const cls = map[status] || "bg-gray-50 text-gray-700 border-gray-200";
  return <span className={`badge ${cls} border capitalize`}>{status}</span>;
}

const STEPS = ["pending", "confirmed", "shipped", "delivered"] as const;
type Step = (typeof STEPS)[number];

function StepTimeline({ displayStatus }: { displayStatus: Step }) {
  const idx = STEPS.indexOf(displayStatus);
  return (
    <div className="card p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Status</h3>

      {/* Mobile: vertical timeline */}
      <ol className="md:hidden relative border-l border-gray-200 pl-4 space-y-4">
        {STEPS.map((s, i) => {
          const active = i <= idx;
          return (
            <li key={`m-${s}`} className="relative pl-4">
              <span
                className={`absolute -left-2.5 top-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                  active
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-500 border-gray-300"
                }`}
              >
                {i + 1}
              </span>
              <div
                className={`capitalize text-sm ${
                  active ? "text-gray-900 font-medium" : "text-gray-500"
                }`}
              >
                {s}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Desktop: horizontal timeline */}
      <div className="hidden md:block">
        <ol className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const active = i <= idx;
            return (
              <li key={`d-${s}`} className="flex-1 flex items-center">
                <div className="flex flex-col items-center text-center w-24">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                      active
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-500 border-gray-300"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div
                    className={`mt-2 text-xs capitalize ${
                      active ? "text-gray-900 font-medium" : "text-gray-500"
                    }`}
                  >
                    {s}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 rounded ${
                      i < idx ? "bg-purple-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function openInvoiceTab(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const win = window.open(url, "_blank");
  if (!win) {
    window.location.href = url;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Types for returns
type RRStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "refunded"
  | "cancelled";
type ReturnItem = {
  product: { _id: string; title?: string } | string;
  qty: number;
  price: number;
};
type ReturnRequest = {
  _id: string;
  order: string;
  user: string;
  items: ReturnItem[];
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

export default function OrderDetailsPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { id } = router.query as { id: string };
  const { current: o } = useSelector((s: RootState) => s.orders);

  // Returns state
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  // Return modal state
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [userNote, setUserNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // qtyByProduct: productId -> qty to return
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;
    dispatch(fetchOrder(id));
    const interval = setInterval(() => {
      if (document.hidden) return;
      dispatch(fetchOrder(id));
    }, 5000);
    return () => clearInterval(interval);
  }, [id, dispatch]);

  // Fetch returns for this order
  const fetchReturns = async () => {
    if (!id) return;
    setLoadingReturns(true);
    try {
      const { data } = await api.get(`/orders/${id}/returns`);
      setReturns(Array.isArray(data) ? data : []);
    } catch {
      setReturns([]);
    } finally {
      setLoadingReturns(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchReturns();
  }, [id]);

  // Derived: compute available quantities per product = purchased - sum(active returns)
  const activeReturnStatuses: RRStatus[] = [
    "requested",
    "approved",
    "received",
    "refunded",
  ];
  const availableByProduct = useMemo(() => {
    if (!o) return {} as Record<string, number>;
    const purchased = new Map<string, number>();
    for (const it of o.items || []) {
      const pid = typeof it.product === "string" ? it.product : it.product?._id;
      if (!pid) continue;
      purchased.set(pid, (purchased.get(pid) || 0) + Number(it.qty));
    }
    const used = new Map<string, number>();
    for (const rr of returns || []) {
      if (!activeReturnStatuses.includes(rr.status)) continue;
      for (const it of rr.items || []) {
        const pid =
          typeof it.product === "string" ? it.product : it.product?._id;
        if (!pid) continue;
        used.set(pid, (used.get(pid) || 0) + Number(it.qty));
      }
    }
    const available: Record<string, number> = {};
    Array.from(purchased.entries()).forEach(([pid, qty]) => {
      const u = used.get(pid) || 0;
      available[pid] = Math.max(0, qty - u);
    });
    return available;
  }, [o, returns]);

  // Initialize qty inputs on modal open
  const openReturn = () => {
    if (!o) return;
    const init: Record<string, number> = {};
    for (const it of o.items || []) {
      const pid = typeof it.product === "string" ? it.product : it.product?._id;
      if (!pid) continue;
      // prefill 0; user chooses quantities explicitly
      init[pid] = 0;
    }
    setQtyByProduct(init);
    setReason("");
    setUserNote("");
    setFile(null);
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!o) return;
    try {
      // Build items payload
      const items: { product: string; qty: number }[] = [];
      for (const it of o.items || []) {
        const pid =
          typeof it.product === "string" ? it.product : it.product?._id;
        if (!pid) continue;
        const maxAvail = availableByProduct[pid] || 0;
        const q = Math.max(
          0,
          Math.min(Number(qtyByProduct[pid] || 0), maxAvail)
        );
        if (q > 0) items.push({ product: pid, qty: q });
      }
      if (items.length === 0) {
        toast.error("Select at least one item to return");
        return;
      }

      const fd = new FormData();
      fd.append("items", JSON.stringify(items));
      if (reason) fd.append("reason", reason);
      if (userNote) fd.append("note", userNote);
      if (file) fd.append("file", file);

      await api.post(`/orders/${o._id}/returns`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Return request submitted");
      setReturnOpen(false);
      fetchReturns();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Failed to submit return request"
      );
    }
  };

  // Demo timeline (client-only visual progression)
  const [demoIdx, setDemoIdx] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startDemo = () => {
    if (!o) return;
    const currentIdx = Math.max(
      0,
      STEPS.indexOf((o.status || "pending") as Step)
    );
    setDemoIdx(currentIdx);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDemoIdx((prev) => {
        if (prev == null) return currentIdx;
        if (prev >= STEPS.length - 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return STEPS.length - 1;
        }
        return prev + 1;
      });
    }, 4000);
  };
  const stopDemo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDemoIdx(null);
  };

  if (!o) {
    return (
      <ProtectedRoute roles={["user", "seller", "admin"]}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="card p-6 text-gray-600">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  const subtotal =
    typeof o.subtotal === "number"
      ? o.subtotal
      : (o.items || []).reduce(
          (s: number, it: any) => s + Number(it.price) * Number(it.qty),
          0
        );
  const tax = typeof o.tax === "number" ? o.tax : 0;
  const shippingCost = typeof o.shippingCost === "number" ? o.shippingCost : 0;
  const shippingMethod = (o.shippingMethod || "standard") as
    | "standard"
    | "express";
  const totalAmount =
    typeof o.totalAmount === "number"
      ? o.totalAmount
      : subtotal + tax + shippingCost;

  const backendIdx = Math.max(
    0,
    STEPS.indexOf((o.status || "pending") as Step)
  );
  const displayIdx = Math.max(backendIdx, demoIdx ?? -1);
  const displayStatus = STEPS[displayIdx] as Step;

  const printInvoice = () => {
    const itemsRows = o.items
      .map(
        (it: any, idx: number) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${idx + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;word-break:break-word;">
          ${it.product?.title || "Product"}
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${it.qty}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">₹${it.price.toLocaleString(
          "en-IN"
        )}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">₹${(
          it.price * it.qty
        ).toLocaleString("en-IN")}</td>
      </tr>`
      )
      .join("");

    const subtotal =
      typeof o.subtotal === "number"
        ? o.subtotal
        : (o.items || []).reduce(
            (s: number, it: any) => s + Number(it.price) * Number(it.qty),
            0
          );
    const tax = typeof o.tax === "number" ? o.tax : 0;
    const shippingCost =
      typeof o.shippingCost === "number" ? o.shippingCost : 0;
    const shippingMethod = (o.shippingMethod || "standard") as
      | "standard"
      | "express";
    const totalAmount =
      typeof o.totalAmount === "number"
        ? o.totalAmount
        : subtotal + tax + shippingCost;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice #${o._id.slice(-6).toUpperCase()}</title>
  <style>
    :root { --brand:#4f46e5; --text:#111827; --muted:#6b7280; --border:#e5e7eb; }
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Arial, sans-serif; color: var(--text); background: #fff; }
    .container { max-width: 780px; margin: 0 auto; padding: 24px; }
    .header { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; padding-bottom: 8px; }
    .brand { font-weight:800; font-size:22px; color: var(--brand); }
    .meta { text-align:right; font-size:12px; color: var(--muted); }
    .section { margin-top: 16px; }
    h3 { margin: 0 0 6px; font-size:16px; }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; }
    th { padding:8px; border-bottom:1px solid #ccc; font-weight:600; font-size:13px; }
    td { font-size:13px; padding:8px; border-bottom:1px solid #eee; }
    .totals td { padding:6px 8px; }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid var(--border); }
    .address { white-space:pre-wrap; font-size:14px; color:#374151; }
    .footnote { font-size:12px; color:#6b7280; margin-top: 12px; }
    .right { text-align:right; }
    .row { display:flex; justify-content:flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Luxora</div>
      <div class="meta">
        <div><strong>Invoice</strong> #${o._id.slice(-6).toUpperCase()}</div>
        <div>Date: ${shortDate(o.createdAt)}</div>
        <div>Status: <span class="badge">${o.status}</span></div>
      </div>
    </div>

    <div class="section">
      <h3>Bill To</h3>
      <div class="address">${o.address || ""}</div>
    </div>

    <div class="section">
      <h3>Items</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Product</th>
            <th style="width:60px;">Qty</th>
            <th style="width:100px;">Price</th>
            <th style="width:120px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>

    <div class="section row">
      <table class="totals" style="width:360px;">
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td class="right">₹${subtotal.toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td>Tax</td>
            <td class="right">₹${tax.toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td>Shipping (${shippingMethod})</td>
            <td class="right">${
              shippingCost > 0
                ? "₹" + shippingCost.toLocaleString("en-IN")
                : "Free"
            }</td>
          </tr>
          <tr>
            <td style="border-top:1px solid #ccc; font-weight:700;">Total</td>
            <td style="border-top:1px solid #ccc;" class="right"><strong>₹${totalAmount.toLocaleString(
              "en-IN"
            )}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section footnote">
      <div>Payment Method: ${o.paymentMethod || "COD"}</div>
      <div>Thank you for shopping with Luxora.</div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){ window.focus(); window.print(); }, 150);
    });
  </script>
</body>
</html>`;
    openInvoiceTab(html);
  };

  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              Order #{o._id.slice(-6).toUpperCase()}
            </h1>
            <p className="text-gray-600 flex items-center gap-2">
              {shortDate(o.createdAt)} · <StatusBadge status={o.status} />
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={printInvoice}
              className="btn w-full sm:w-auto"
              title="Print / Save as PDF"
            >
              Print / Save Invoice
            </button>
            {STEPS.indexOf((o.status || "pending") as Step) <
            STEPS.length - 1 ? (
              <button onClick={startDemo} className="btn w-full sm:w-auto">
                Start Demo Timeline
              </button>
            ) : (
              <button onClick={stopDemo} className="btn w-full sm:w-auto">
                Stop Demo
              </button>
            )}
            {/* Request return/refund visible for delivered only (server still enforces window) */}
            {o.status === "delivered" && (
              <button onClick={openReturn} className="btn w-full sm:w-auto">
                Request return/refund
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <StepTimeline
          displayStatus={
            STEPS[
              Math.max(
                STEPS.indexOf((o.status || "pending") as Step),
                demoIdx ?? -1
              )
            ] as Step
          }
        />

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Items */}
          <div className="lg:col-span-8 card p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Items</h2>
            <div className="divide-y divide-gray-200">
              {o.items.map((it: any, idx: number) => {
                const p = it.product || {};
                const img = getImageUrl(p.images?.[0]);
                return (
                  <div key={idx} className="py-3">
                    <div className="grid grid-cols-[64px,1fr] sm:grid-cols-[64px,1fr,auto] gap-3 sm:gap-4 items-start">
                      <img
                        src={img}
                        alt={p.title || "Product"}
                        className="w-16 h-16 rounded-lg border border-gray-200 object-cover"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {p.title || "Product"}
                        </div>
                        <div className="text-xs text-gray-500">
                          Qty: {it.qty}
                          {p.brand ? ` · Brand: ${p.brand}` : ""}
                          {p.sku ? ` · SKU: ${p.sku}` : ""}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 sm:text-right mt-1 sm:mt-0">
                        {currency(it.price * it.qty)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary + Address */}
          <div className="lg:col-span-4 space-y-6">
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Price Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Tax</span>
                  <span>{currency(tax)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Shipping ({shippingMethod})</span>
                  <span>
                    {shippingCost > 0 ? currency(shippingCost) : "Free"}
                  </span>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between text-gray-900 font-semibold">
                  <span>Total</span>
                  <span>{currency(totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Delivery
              </h3>
              <div className="text-sm text-gray-700 whitespace-pre-line break-words">
                {o.address}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                Payment:{" "}
                <span className="font-medium">{o.paymentMethod || "COD"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Returns history */}
        <div className="card p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Returns</h3>
            <div className="text-sm text-gray-600">
              {loadingReturns ? "Loading..." : `${returns.length} request(s)`}
            </div>
          </div>
          {returns.length === 0 ? (
            <div className="text-gray-600 text-sm">
              No return requests for this order.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {returns.map((rr) => {
                const attachment = rr.attachments?.[0];
                const total = rr.items.reduce(
                  (s, it) => s + it.qty * it.price,
                  0
                );
                return (
                  <div key={rr._id} className="py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {rr._id.slice(-6).toUpperCase()}
                        </span>
                        <Pill
                          text={rr.status}
                          color={
                            rr.status === "requested"
                              ? "bg-blue-100 text-blue-800"
                              : rr.status === "approved"
                              ? "bg-indigo-100 text-indigo-800"
                              : rr.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : rr.status === "received"
                              ? "bg-yellow-100 text-yellow-800"
                              : rr.status === "refunded"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-700"
                          }
                        />
                        <span className="text-xs text-gray-500">
                          {shortDate(rr.requestedAt)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900">
                        Total: {currency(total)}
                      </div>
                    </div>

                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1 text-sm">
                        {rr.items.map((it, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between"
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
                      <div className="text-sm space-y-1">
                        {rr.reason && (
                          <div>
                            <span className="text-gray-500">Reason: </span>
                            <span className="text-gray-800">{rr.reason}</span>
                          </div>
                        )}
                        {rr.note && (
                          <div>
                            <span className="text-gray-500">Note: </span>
                            <span className="text-gray-800">{rr.note}</span>
                          </div>
                        )}
                        {attachment ? (
                          <div>
                            <span className="text-gray-500">Attachment: </span>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-700 hover:underline"
                            >
                              {attachment.name || "View"}
                            </a>
                          </div>
                        ) : null}
                        {rr.status === "refunded" && rr.refund && (
                          <div className="text-sm text-gray-700">
                            <div>
                              <span className="text-gray-500">Refund: </span>
                              <span className="text-gray-800">
                                {rr.refund.amount != null
                                  ? `₹${rr.refund.amount.toLocaleString(
                                      "en-IN"
                                    )}`
                                  : "—"}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {rr.refund.method || "manual"}
                              {rr.refund.reference
                                ? ` · ${rr.refund.reference}`
                                : ""}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Return modal */}
        {returnOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  Request return/refund
                </h3>
                <button
                  onClick={() => setReturnOpen(false)}
                  className="px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              <div className="p-4 space-y-4 text-sm">
                <div>
                  <div className="text-gray-700 mb-2">
                    Select items to return (max available shown)
                  </div>
                  <div className="space-y-2">
                    {o.items.map((it: any, idx: number) => {
                      const pid =
                        typeof it.product === "string"
                          ? it.product
                          : it.product?._id;
                      const title =
                        typeof it.product === "string"
                          ? it.product
                          : it.product?.title || "Item";
                      const maxAvail = availableByProduct[pid] || 0;
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr,120px] gap-3 items-center"
                        >
                          <div className="min-w-0">
                            <div className="text-gray-900">{title}</div>
                            <div className="text-xs text-gray-500">
                              Purchased: {it.qty} · Max return: {maxAvail}
                            </div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={maxAvail}
                            value={qtyByProduct[pid] ?? 0}
                            onChange={(e) => {
                              const val = Math.max(
                                0,
                                Math.min(Number(e.target.value || 0), maxAvail)
                              );
                              setQtyByProduct((q) => ({ ...q, [pid]: val }));
                            }}
                            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Reason</label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe the issue (size, defect, wrong item, etc.)"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Additional note (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Any extra information that helps"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Attachment (single)
                  </label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border file:border-gray-300 file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Add a photo/video to support your request (optional).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => setReturnOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReturn}
                  className="px-4 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-500"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
