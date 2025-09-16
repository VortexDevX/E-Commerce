import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { currency, shortDate } from "../../utils/format";

type AdminProduct = {
  _id: string;
  title: string;
  price: number;
  stock: number;
  status: "active" | "blocked";
  category?: string;
  owner?: { name: string; email: string };
  createdAt: string;
};

function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | AdminProduct["status"]>("all");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/products");
      setProducts(data);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const ql = q.toLowerCase();
      const matchesQ =
        !q ||
        p.title.toLowerCase().includes(ql) ||
        p.owner?.email?.toLowerCase().includes(ql);
      const matchesStatus = status === "all" || p.status === status;
      return matchesQ && matchesStatus;
    });
  }, [products, q, status]);

  const toggleStatus = async (id: string, current: AdminProduct["status"]) => {
    try {
      const next = current === "active" ? "blocked" : "active";
      await api.patch(`/admin/products/${id}/status`, { status: next });
      toast.success(`Product ${next}`);
      fetchProducts();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product? This action cannot be undone.")) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to delete product");
    }
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        </div>

        {/* Filters */}
        <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            placeholder="Search by title or owner email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 w-full md:w-96"
          />
          <div className="flex gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-600" colSpan={7}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-600" colSpan={7}>
                    No products found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p._id}
                    className="border-t border-gray-200 text-gray-900"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${p._id}`}
                        className="text-purple-700 hover:underline"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>{p.owner?.name || "—"}</div>
                      <div className="text-xs text-gray-500">
                        {p.owner?.email || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{currency(p.price)}</td>
                    <td className="px-4 py-3">{p.stock}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs capitalize ${
                          p.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{shortDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => toggleStatus(p._id, p.status)}
                          className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        >
                          {p.status === "active" ? "Block" : "Unblock"}
                        </button>
                        <button
                          onClick={() => deleteProduct(p._id)}
                          className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-500"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminProductsPage), {
  ssr: false,
});
