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
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-sm text-center">
              You don&apos;t have permission to add products.
            </div>
          }
        >
          <div className="space-y-2 mb-8 border-b-[3px] border-border pb-4">
            <h1 className="text-3xl font-black uppercase tracking-widest text-foreground">
              Add Product
            </h1>
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Create a new product listing for your store.
            </p>
          </div>
          <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6">
            <ProductForm onSuccess={() => router.push("/seller/products")} />
          </div>
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(NewProductPage), { ssr: false });
