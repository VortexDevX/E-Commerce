import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import ProductForm from "../../../components/products/ProductForm";
import SellerLayout from "../../../components/layout/SellerLayout";
import PermissionGate from "../../../components/layout/PermissionGate";

function NewProductPage() {
  const router = useRouter();

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:products:write"
          fallback={
            <div className="card p-6 text-gray-700">
              You don’t have permission to add products.
            </div>
          }
        >
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">
              Add Product
            </h1>
            <p className="text-sm text-gray-600">
              Create a new product listing for your store.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 form-light">
            <ProductForm onSuccess={() => router.push("/seller/products")} />
          </div>
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(NewProductPage), { ssr: false });
