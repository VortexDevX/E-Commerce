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
  return <span className="px-2 py-0.5 border-[3px] border-border shadow-[2px_2px_0px_#111] bg-card text-foreground font-black uppercase tracking-widest text-xs">{children}</span>;
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
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-sm text-center">
              You don&apos;t have access to Products.
            </div>
          }
        >
          {loading || !data ? (
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-sm text-center">Loading...</div>
          ) : (
            <>
              <div className="flex items-center justify-between font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
                <h1 className="text-3xl text-foreground">
                  Product Details
                </h1>
                <div className="flex items-center gap-3">
                  <PermissionGate scope="seller" perm="seller:products:write">
                    <Link
                      href={`/seller/products/edit/${data.product._id}`}
                      className="px-6 py-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 block"
                    >
                      Edit Product
                    </Link>
                  </PermissionGate>
                  <PermissionGate scope="seller" perm="seller:products:write">
                    <button
                      onClick={remove}
                      className="px-6 py-2 border-[3px] border-rose-600 bg-rose-600 shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all text-white font-black uppercase tracking-widest hover:-translate-y-1"
                    >
                      Delete
                    </button>
                  </PermissionGate>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Left: product info */}
                <div className="md:col-span-2 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <img
                      src={getImageUrl(data.product.images?.[0])}
                      className="w-48 h-48 object-cover border-[3px] border-border shadow-[4px_4px_0px_#111]"
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).src =
                          "/fallback.png")
                      }
                      alt={data.product.title}
                    />
                    <div className="space-y-2">
                      <div className="text-2xl font-black uppercase tracking-widest text-foreground">
                        {data.product.title}
                      </div>
                      <div className="text-primary font-black text-xl">
                        {currency(data.product.price)}
                      </div>
                      <div className="text-sm font-bold uppercase tracking-widest text-foreground">
                        Category: <span className="text-muted-foreground">{data.product.category || "-"}</span>
                      </div>
                      <div className="text-sm font-bold uppercase tracking-widest text-foreground">
                        Stock: <span className="text-muted-foreground">{data.product.stock}</span>
                      </div>
                      {data.product.sku && (
                        <div className="text-sm font-bold uppercase tracking-widest text-foreground">
                          SKU: <span className="text-muted-foreground">{data.product.sku}</span>
                        </div>
                      )}
                      {data.product.brand && (
                        <div className="text-sm font-bold uppercase tracking-widest text-foreground">
                          Brand: <span className="text-muted-foreground">{data.product.brand}</span>
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
                    <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t-[3px] border-border">
                      {(data.product.images || [])
                        .slice(1, 4)
                        .map((img: any, i: number) => {
                          const src = getImageUrl(img);
                          return (
                            <div key={i} className="w-24 h-24 border-[3px] border-border bg-muted overflow-hidden shrink-0 shadow-[4px_4px_0px_#111]">
                              <img
                                src={src}
                                alt={`thumb-${i}`}
                                className="w-full h-full object-cover"
                                onError={(e) =>
                                  ((e.currentTarget as HTMLImageElement).src =
                                    "/fallback.png")
                                }
                              />
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {data.product.attributes?.length ? (
                    <div className="mt-8 pt-8 border-t-[3px] border-border">
                      <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-4">
                        Attributes
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {data.product.attributes.map((a: any, i: number) => (
                          <div key={i} className="flex flex-col gap-1 p-3 border-[3px] border-border bg-muted/30">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{a.key}</span>
                            <span className="text-sm font-black uppercase tracking-widest text-foreground">{a.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(data.product.seo?.title ||
                    data.product.seo?.description) && (
                    <div className="mt-8 pt-8 border-t-[3px] border-border">
                      <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-4">SEO</h3>
                      <div className="space-y-4">
                        {data.product.seo?.title && (
                          <div className="p-4 border-[3px] border-border bg-muted/30">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Title</div>
                            <div className="text-sm font-black uppercase tracking-widest text-foreground">{data.product.seo.title}</div>
                          </div>
                        )}
                        {data.product.seo?.description && (
                          <div className="p-4 border-[3px] border-border bg-muted/30">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Description</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-foreground">{data.product.seo.description}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: analytics */}
                <div className="space-y-6">
                  <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Orders</div>
                    <div className="text-4xl font-black text-foreground">
                      {data.analytics.ordersCount}
                    </div>
                  </div>
                  <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Units Sold</div>
                    <div className="text-4xl font-black text-foreground">
                      {data.analytics.sold}
                    </div>
                  </div>
                  <div className="bg-card border-[3px] border-primary shadow-[8px_8px_0px_#111] p-6 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Revenue</div>
                    <div className="text-4xl font-black text-primary truncate" title={currency(data.analytics.revenue)}>
                      {currency(data.analytics.revenue)}
                    </div>
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
