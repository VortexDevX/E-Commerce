import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../../components/layout/ProtectedRoute";
import ProductForm from "../../../../components/products/ProductForm";
import api from "../../../../utils/api";
import SellerLayout from "../../../../components/layout/SellerLayout";
import PermissionGate from "../../../../components/layout/PermissionGate";
import { useAuth } from "../../../../hooks/useAuth";
import { hasSellerPerm } from "../../../../utils/permissions";

function EditProductPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { user } = useAuth();
  const canWrite = hasSellerPerm(user as any, "seller:products:write");

  const [initial, setInitial] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !canWrite) return;
    (async () => {
      try {
        // Using public product detail to feed ProductForm's initial shape
        const { data } = await api.get(`/products/${id}`);
        setInitial(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, canWrite]);

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:products:write"
          fallback={
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-sm text-center">
              You don&apos;t have permission to edit products.
            </div>
          }
        >
          <div className="space-y-2 mb-8 border-b-[3px] border-border pb-4">
            <h1 className="text-3xl font-black uppercase tracking-widest text-foreground">
              Edit Product
            </h1>
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Update product information and media.
            </p>
          </div>

          {loading ? (
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-sm text-center">
              Loading...
            </div>
          ) : !initial ? (
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-rose-600 font-black uppercase tracking-widest text-sm text-center">
              Product not found
            </div>
          ) : (
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6">
              <ProductForm
                initial={initial}
                onSuccess={() => router.push("/seller/products")}
              />
            </div>
          )}
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(EditProductPage), { ssr: false });
