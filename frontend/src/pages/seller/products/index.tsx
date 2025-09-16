import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import SellerLayout from "../../../components/layout/SellerLayout";
import PermissionGate from "../../../components/layout/PermissionGate";
import api from "../../../utils/api";
import { currency, shortDate } from "../../../utils/format";
import { getImageUrl } from "../../../utils/images";
import { downloadCSV } from "../../../utils/csv";
import { useAuth } from "../../../hooks/useAuth";
import { hasSellerPerm } from "../../../utils/permissions";
import toast from "react-hot-toast";

type MyProduct = {
  _id: string;
  title: string;
  price: number;
  stock: number;
  status: "active" | "blocked";
  createdAt: string;
  images?: Array<string | { url?: string }>;
  brand?: string;
  category?: string;
};

function StatusBadge({ status }: { status: "active" | "blocked" }) {
  const map: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blocked: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return <span className={`badge border ${map[status]}`}>{status}</span>;
}

function SellerProductsPage() {
  const { user } = useAuth();
  const canRead = hasSellerPerm(user as any, "seller:products:read");
  const canWrite = hasSellerPerm(user as any, "seller:products:write");
  const [items, setItems] = useState<MyProduct[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [sort, setSort] = useState<"newest" | "priceAsc" | "priceDesc">(
    "newest"
  );
  const [loading, setLoading] = useState(true);

  const fetchMine = async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get("/seller/products");
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = items.filter(
      (p) => !term || p.title.toLowerCase().includes(term)
    );
    if (status !== "all") list = list.filter((p) => p.status === status);

    if (sort === "newest")
      list = [...list].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
      );
    if (sort === "priceAsc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "priceDesc")
      list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [items, q, status, sort]);

  const remove = async (id: string) => {
    if (!canWrite) {
      toast.error("You don't have permission to delete products");
      return;
    }
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      await api.delete(`/products/${id}`);
      await fetchMine();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to delete product");
    }
  };

  const exportCsv = () => {
    downloadCSV(
      "my-products.csv",
      filtered.map((p) => ({
        id: p._id,
        title: p.title,
        brand: p.brand || "",
        category: p.category || "",
        price: p.price,
        stock: p.stock,
        status: p.status,
        createdAt: p.createdAt,
      })),
      {
        id: "ID",
        title: "Title",
        brand: "Brand",
        category: "Category",
        price: "Price",
        stock: "Stock",
        status: "Status",
        createdAt: "Created At",
      }
    );
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
          {/* Header + actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">
              My Products
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportCsv}
                className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
              >
                Export CSV
              </button>
              <PermissionGate scope="seller" perm="seller:products:write">
                <Link
                  href="/seller/products/new"
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500"
                >
                  + Add Product
                </Link>
              </PermissionGate>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
              <input
                placeholder="Search title..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 w-full md:w-72"
              />
              <div className="flex items-center gap-3">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50"
                >
                  <option value="newest">Newest</option>
                  <option value="priceAsc">Price: Low → High</option>
                  <option value="priceDesc">Price: High → Low</option>
                </select>
              </div>
            </div>
            <div className="text-sm text-gray-600 self-end sm:self-auto">
              {filtered.length} item{filtered.length === 1 ? "" : "s"}
            </div>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-3 mt-4">
            {loading ? (
              <div className="card p-4 text-gray-600">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="card p-4 text-gray-600">No products found.</div>
            ) : (
              filtered.map((p) => {
                const thumb = getImageUrl(p.images?.[0]);
                return (
                  <div key={p._id} className="card p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={thumb}
                        alt={p.title}
                        className="w-14 h-14 rounded-lg border border-gray-200 object-cover shrink-0"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.title}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {p.brand ? `${p.brand} · ` : ""}
                          {p.category || ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-gray-500">Price</div>
                        <div className="text-gray-900">{currency(p.price)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Stock</div>
                        <div className="text-gray-900">{p.stock}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Status</div>
                        <div className="text-gray-900">
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Created</div>
                        <div className="text-gray-900">
                          {shortDate(p.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/seller/products/${p._id}`}
                        className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                      >
                        Details
                      </Link>
                      <Link
                        href={`/seller/products/edit/${p._id}`}
                        className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => remove(p._id)}
                        className="px-3 py-1 border border-rose-300 rounded-md bg-white text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block card overflow-x-auto mt-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3">Item</th>
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
                    <td className="px-4 py-6 text-gray-500" colSpan={6}>
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-gray-500" colSpan={6}>
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const thumb = getImageUrl(p.images?.[0]);
                    return (
                      <tr
                        key={p._id}
                        className="border-t border-gray-200 text-gray-900"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={thumb}
                              alt={p.title}
                              className="w-12 h-12 rounded-lg border border-gray-200 object-cover"
                              onError={(e) =>
                                ((e.currentTarget as HTMLImageElement).src =
                                  "/fallback.png")
                              }
                            />
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {p.title}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {p.brand ? `${p.brand} · ` : ""}
                                {p.category || ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{currency(p.price)}</td>
                        <td className="px-4 py-3">{p.stock}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3">{shortDate(p.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <Link
                              href={`/seller/products/${p._id}`}
                              className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                            >
                              Details
                            </Link>
                            <Link
                              href={`/seller/products/edit/${p._id}`}
                              className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => remove(p._id)}
                              className="px-3 py-1 border border-rose-300 rounded-md bg-white text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerProductsPage), {
  ssr: false,
});
