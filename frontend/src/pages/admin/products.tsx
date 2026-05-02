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
        <div className="flex items-center justify-between font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
          <h1 className="text-3xl text-foreground">Products</h1>
        </div>

        {/* Filters */}
        <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-8">
          <input
            placeholder="Search by title or owner email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all w-full md:w-96"
          />
          <div className="flex gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] overflow-x-auto mt-8">
          <table className="min-w-full text-sm">
            <thead className="bg-muted border-b-[3px] border-border">
              <tr className="text-left font-black uppercase tracking-widest text-foreground">
                <th className="px-5 py-4 border-r-[3px] border-border">Title</th>
                <th className="px-5 py-4 border-r-[3px] border-border">Owner</th>
                <th className="px-5 py-4 border-r-[3px] border-border text-center">Price</th>
                <th className="px-5 py-4 border-r-[3px] border-border text-center">Stock</th>
                <th className="px-5 py-4 border-r-[3px] border-border text-center">Status</th>
                <th className="px-5 py-4 border-r-[3px] border-border text-center">Created</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-[3px] divide-border bg-card">
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
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-5 py-4 border-r-[3px] border-border font-bold">
                      <Link
                        href={`/products/${p._id}`}
                        className="text-primary hover:underline hover:text-foreground transition-colors max-w-[200px] truncate block"
                        title={p.title}
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-5 py-4 border-r-[3px] border-border max-w-[200px] truncate" title={p.owner?.email || "—"}>
                      <div className="font-bold uppercase tracking-widest text-[11px] text-foreground">{p.owner?.name || "—"}</div>
                      <div className="text-[10px] text-muted-foreground font-bold tracking-widest mt-1">
                        {p.owner?.email || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-4 border-r-[3px] border-border text-center text-emerald-600 font-black tracking-widest text-[11px] whitespace-nowrap">{currency(p.price)}</td>
                    <td className="px-5 py-4 border-r-[3px] border-border text-center">
                      <span className="bg-primary/10 text-primary border-[2px] border-primary px-2 py-0.5 font-bold uppercase text-[11px] tracking-widest">{p.stock}</span>
                    </td>
                    <td className="px-5 py-4 border-r-[3px] border-border text-center">
                      <span
                        className={`inline-block w-full max-w-[100px] px-2 py-0.5 border-[3px] border-border shadow-[2px_2px_0px_#111] text-[10px] font-black uppercase tracking-widest truncate ${
                          p.status === "active"
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-rose-400 text-rose-950"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 border-r-[3px] border-border text-center text-foreground font-bold uppercase tracking-widest text-[11px] whitespace-nowrap">{shortDate(p.createdAt)}</td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex gap-3 justify-center items-center flex-wrap">
                        <button
                          onClick={() => toggleStatus(p._id, p.status)}
                          className="px-3 py-1.5 border-[3px] border-border bg-card shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-bold uppercase text-[10px] tracking-widest text-foreground min-w-[80px]"
                        >
                          {p.status === "active" ? "Block" : "Unblock"}
                        </button>
                        <button
                          onClick={() => deleteProduct(p._id)}
                          className="px-3 py-1.5 border-[3px] border-rose-600 bg-rose-600 shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-white font-bold uppercase text-[10px] tracking-widest"
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
