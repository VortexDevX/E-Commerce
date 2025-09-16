import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import SellerLayout from "../../../components/layout/SellerLayout";
import PermissionGate from "../../../components/layout/PermissionGate";
import api from "../../../utils/api";
import { currency } from "../../../utils/format";
import { getImageUrl } from "../../../utils/images";
import Link from "next/link";
import { useAuth } from "../../../hooks/useAuth";
import { hasSellerPerm } from "../../../utils/permissions";

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="badge badge-muted border">{children}</span>;
}

function SellerProductDetailsPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { user } = useAuth();

  const canRead = hasSellerPerm(user as any, "seller:products:read");
  const canWrite = hasSellerPerm(user as any, "seller:products:write");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOne = async () => {
    if (!id || !canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/seller/products/${id}`);
      setData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canRead]);

  const remove = async () => {
    if (!id) return;
    if (!canWrite) return alert("You don’t have permission to delete products");
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      await api.delete(`/products/${id}`);
      router.replace("/seller/products");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to delete product");
    }
  };

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:products:read"
          fallback={
            <div className="card p-6 text-gray-700">
              You don’t have access to Products.
            </div>
          }
        >
          {loading || !data ? (
            <div className="card p-6 text-gray-600">Loading...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold text-gray-900">
                  Product Details
                </h1>
                <div className="flex items-center gap-2">
                  <PermissionGate scope="seller" perm="seller:products:write">
                    <Link
                      href={`/seller/products/edit/${data.product._id}`}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500"
                    >
                      Edit Product
                    </Link>
                  </PermissionGate>
                  <PermissionGate scope="seller" perm="seller:products:write">
                    <button
                      onClick={remove}
                      className="px-4 py-2 border border-rose-300 rounded-md bg-white text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </PermissionGate>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Left: product info */}
                <div className="md:col-span-2 card p-4">
                  <div className="flex gap-4">
                    <img
                      src={getImageUrl(data.product.images?.[0])}
                      className="w-40 h-40 object-cover rounded-lg border border-gray-200"
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).src =
                          "/fallback.png")
                      }
                      alt={data.product.title}
                    />
                    <div className="space-y-1">
                      <div className="text-xl font-semibold text-gray-900">
                        {data.product.title}
                      </div>
                      <div className="text-purple-700 font-bold">
                        {currency(data.product.price)}
                      </div>
                      <div className="text-sm text-gray-700">
                        Category: {data.product.category || "-"}
                      </div>
                      <div className="text-sm text-gray-700">
                        Stock: {data.product.stock}
                      </div>
                      {data.product.sku && (
                        <div className="text-sm text-gray-700">
                          SKU: {data.product.sku}
                        </div>
                      )}
                      {data.product.brand && (
                        <div className="text-sm text-gray-700">
                          Brand: {data.product.brand}
                        </div>
                      )}
                      {data.product.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {data.product.tags
                            .slice(0, 6)
                            .map((t: string, i: number) => (
                              <Chip key={`${t}-${i}`}>{t}</Chip>
                            ))}
                          {data.product.tags.length > 6 && (
                            <Chip>+{data.product.tags.length - 6}</Chip>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {(data.product.images || []).slice(1).length > 0 && (
                    <div className="flex gap-2 mt-4">
                      {(data.product.images || [])
                        .slice(1, 4)
                        .map((img: any, i: number) => {
                          const src = getImageUrl(img);
                          return (
                            <img
                              key={i}
                              src={src}
                              alt={`thumb-${i}`}
                              className="w-16 h-16 rounded-md border border-gray-200 object-cover"
                              onError={(e) =>
                                ((e.currentTarget as HTMLImageElement).src =
                                  "/fallback.png")
                              }
                            />
                          );
                        })}
                    </div>
                  )}

                  {data.product.attributes?.length ? (
                    <div className="mt-4">
                      <h3 className="font-semibold text-gray-900">
                        Attributes
                      </h3>
                      <ul className="list-disc ml-6 text-sm text-gray-700">
                        {data.product.attributes.map((a: any, i: number) => (
                          <li key={i}>
                            {a.key}: {a.value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {(data.product.seo?.title ||
                    data.product.seo?.description) && (
                    <div className="mt-4">
                      <h3 className="font-semibold text-gray-900">SEO</h3>
                      <div className="text-sm text-gray-700">
                        {data.product.seo?.title && (
                          <div>Title: {data.product.seo.title}</div>
                        )}
                        {data.product.seo?.description && (
                          <div>Description: {data.product.seo.description}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: analytics */}
                <div className="card p-4 space-y-2">
                  <div className="text-sm text-gray-500">Orders</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {data.analytics.ordersCount}
                  </div>
                  <div className="text-sm text-gray-500">Units Sold</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {data.analytics.sold}
                  </div>
                  <div className="text-sm text-gray-500">Revenue</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {currency(data.analytics.revenue)}
                  </div>
                </div>
              </div>
            </>
          )}
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerProductDetailsPage), {
  ssr: false,
});
