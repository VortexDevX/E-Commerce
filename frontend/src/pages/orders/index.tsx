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
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
    shipped: "bg-blue-50 text-blue-700 border-blue-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const cls = map[status] || "bg-gray-50 text-gray-700 border-gray-200";
  return <span className={`badge ${cls} border`}>{status}</span>;
}

export default function OrdersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { list } = useSelector((s: RootState) => s.orders);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, [dispatch]);

  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

        {(!list || list.length === 0) && (
          <div className="card p-8 text-center">
            <p className="text-gray-600">You haven’t placed any orders yet.</p>
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
                        alt="item"
                        className="w-12 h-12 rounded-lg border border-gray-200 object-cover"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                    ))}
                    {more > 0 && (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-600">
                        +{more}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        Order #{o._id.slice(-6).toUpperCase()}
                      </p>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-sm text-gray-600">
                      {shortDate(o.createdAt)} · {method}
                    </p>
                    <p className="text-xs text-gray-500">
                      {o.items?.length || 0} item
                      {o.items?.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {currency(total)}
                  </p>
                  <Link
                    href={`/orders/${o._id}`}
                    className="text-purple-700 text-sm hover:text-purple-600"
                  >
                    View details →
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
