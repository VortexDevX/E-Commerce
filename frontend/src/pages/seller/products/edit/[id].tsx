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
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-700">
              You don’t have permission to edit products.
            </div>
          }
        >
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">
              Edit Product
            </h1>
            <p className="text-sm text-gray-600">
              Update product information and media.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
              Loading...
            </div>
          ) : !initial ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-rose-600">
              Product not found
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4 form-light">
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
