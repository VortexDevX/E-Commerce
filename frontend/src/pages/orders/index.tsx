import Link from "next/link";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import { fetchMyOrders } from "../../store/slices/orderSlice";
import { currency, shortDate } from "../../utils/format";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import { getImageUrl } from "../../utils/images";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/40",
    confirmed: "bg-primary/10 text-primary border-primary",
    shipped: "bg-primary/10 text-primary border-primary/40",
    delivered: "bg-success/10 text-success border-success/40",
    cancelled: "bg-error/10 text-error border-error/40",
  };
  const cls = map[status] || "bg-card text-foreground border-border";
  return <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

export default function OrdersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { list } = useSelector((s: RootState) => s.orders);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, [dispatch]);

  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-6 text-3xl font-bold text-foreground">Your orders</h1>

        {(!list || list.length === 0) && (
          <div className="card p-8 text-center">
            <p className="text-muted-foreground">No orders yet. Start with products that are in stock and ready to ship.</p>
            <Link
              href="/products"
              className="inline-block mt-4 btn btn-primary"
            >
              Browse products
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {list.map((o: any) => {
            const images = (o.items || [])
              .slice(0, 3)
              .map((it: any) => getImageUrl(it.product?.images?.[0]));
            const more = Math.max(0, (o.items || []).length - 3);
            const method = o.shippingMethod || "standard";
            const total = o.totalAmount ?? 0;

            return (
              <div
                key={o._id}
                className="card p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {images.map((src: string, i: number) => (
                      <img
                        key={i}
                        src={src}
                        alt="Order item"
                        className="h-12 w-12 rounded-lg border border-border bg-card object-cover"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                    ))}
                    {more > 0 && (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border bg-card text-xs font-semibold text-foreground">
                        +{more}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">
                      Order #{o._id.slice(-6).toUpperCase()}
                    </p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                      {shortDate(o.createdAt)} · {method === "express" ? "Express delivery" : "Standard delivery"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.items?.length || 0} item
                      {o.items?.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    {currency(total)}
                  </p>
                  <Link
                    href={`/orders/${o._id}`}
                    className="btn-primary px-3 py-1.5 mt-2 inline-block text-[10px]"
                  >
                    View order
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ProtectedRoute>
  );
}
