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

  // Bulk upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    summary: { rows: number; created: number; updated: number; errors: number };
    errors: Array<{ row: number; sku?: string; title?: string; error: string }>;
  } | null>(null);

  // Help/guide
  const [showGuide, setShowGuide] = useState(false);

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

  // Bulk upload helpers
  const downloadTemplate = async () => {
    try {
      const res = await api.get("/seller/bulk-products/template", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "luxora_seller_products_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to download template");
    }
  };

  const downloadCategoriesCsv = async () => {
    try {
      const { data } = await api.get("/categories");
      const rows = (data || []).map((c: any) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        active: c.active ? "yes" : "no",
      }));
      downloadCSV("categories.csv", rows, {
        id: "ID",
        name: "Name",
        slug: "Slug",
        active: "Active",
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to fetch categories");
    }
  };

  const handleImport = async () => {
    if (!csvFile) {
      toast.error("Please select a CSV file.");
      return;
    }
    if (zipFile && zipFile.size > 50 * 1024 * 1024) {
      toast.error("ZIP must be 50MB or less.");
      return;
    }

    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("csv", csvFile);
      if (zipFile) fd.append("media", zipFile);

      const { data } = await api.post("/seller/bulk-products/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      toast.success("Import finished.");
      fetchMine();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorsCsv = () => {
    if (!result?.errors?.length) return;
    downloadCSV("bulk-errors.csv", result.errors, {
      row: "Row",
      sku: "SKU",
      title: "Title",
      error: "Error",
    });
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

          {/* Bulk Upload */}
          <PermissionGate scope="seller" perm="seller:products:write">
            <div className="card p-4 mt-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Bulk Upload (CSV + ZIP)
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={downloadTemplate}
                    className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Download Template
                  </button>
                  <button
                    onClick={downloadCategoriesCsv}
                    className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                    title="Use this to find category IDs or slugs"
                  >
                    Download Categories
                  </button>
                  <button
                    onClick={() => setShowGuide((s) => !s)}
                    className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                  >
                    {showGuide ? "Hide Guide" : "How to format CSV"}
                  </button>
                </div>
              </div>

              {showGuide && (
                <div className="border border-gray-200 rounded-md bg-gray-50 p-3 text-sm text-gray-700 space-y-2">
                  <div className="font-medium text-gray-900">
                    CSV/Excel formatting guide
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      Required columns: <strong>title</strong>,{" "}
                      <strong>price</strong>, <strong>stock</strong>, and either{" "}
                      <strong>category_id</strong> or{" "}
                      <strong>category_slug</strong> (ID takes precedence).
                    </li>
                    <li>
                      Optional columns: description, sku, brand, discountPrice,
                      tags (comma separated), attributes (JSON or
                      key=value|key2=value2), seoTitle, seoDescription,
                      shipWeight, shipLength, shipWidth, shipHeight, images
                      (pipe-delimited), video (single).
                    </li>
                    <li>
                      Categories: download <em>categories.csv</em> to find IDs
                      and slugs. Unknown category → row error (no auto-create).
                    </li>
                    <li>
                      Media: up to <strong>5 images</strong> (pipe-delimited)
                      plus <strong>1 video</strong> per product.
                      <br />
                      Each item can be an absolute URL or a filename that exists
                      in your uploaded ZIP.
                    </li>
                    <li>
                      ZIP: max size <strong>50MB</strong>. Allowed image types:
                      jpg/jpeg/png/webp/gif; video: mp4/webm/mov/mkv.
                    </li>
                    <li>
                      Updates: if <strong>sku</strong> matches an existing item,
                      that product is updated. New images are{" "}
                      <strong>appended</strong>; video is replaced only if you
                      provide one in the CSV/ZIP.
                    </li>
                  </ul>
                  <div className="mt-2">
                    <div className="font-medium text-gray-900">
                      Example (header + one row)
                    </div>
                    <pre className="overflow-auto bg-white border border-gray-200 rounded p-2 text-xs">
                      {`title,price,stock,category_id,category_slug,description,sku,brand,discountPrice,tags,attributes,seoTitle,seoDescription,shipWeight,shipLength,shipWidth,shipHeight,images,video
"Wireless Noise-Cancelling Headphones","4999","25","","accessories","Immersive sound with ANC","WH-1000XM-sku","Luxora","4499","featured, limited","{\\"color\\":\\"Black\\",\\"battery\\":\\"30h\\"}","Premium ANC Headphones","Best-in-class noise cancellation","0.45","20","18","5","image1.jpg|https://cdn.example.com/hero.png","demo.mp4"`}
                    </pre>
                  </div>
                  <div className="mt-1">
                    <div className="font-medium text-gray-900">
                      Tips for Excel/Numbers/Sheets
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        Format <strong>SKU</strong> column as{" "}
                        <strong>Text</strong> to preserve leading zeros.
                      </li>
                      <li>
                        Save as <strong>CSV (UTF‑8)</strong>. Avoid XLS/XLSX
                        when uploading.
                      </li>
                      <li>
                        Don’t include currency symbols in price; use plain
                        numbers (e.g., 4999).
                      </li>
                      <li>Avoid extra commas or line breaks inside cells.</li>
                    </ul>
                  </div>
                  <div className="mt-1">
                    <div className="font-medium text-gray-900">
                      Common errors & fixes
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        Unknown category → use valid category_id or
                        category_slug from categories.csv.
                      </li>
                      <li>
                        Images exceed limit → only first 5 used; extras ignored.
                      </li>
                      <li>
                        Referenced filename missing in ZIP → ensure the exact
                        filename is included.
                      </li>
                      <li>
                        Invalid price/stock → use non‑negative numbers only.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    CSV ZIP
                  </label>
                  <input
                    type="file"
                    id="csv-upload"
                    accept=".csv,text/csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                      <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                    </svg>
                    Choose file
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Required: title, price, stock, and category_id or
                    category_slug.
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Media ZIP (optional)
                  </label>
                  <input
                    type="file"
                    id="zip-upload"
                    accept=".zip,application/zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="zip-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                      <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                    </svg>
                    Choose file
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Up to 5 images and 1 video per product. Max 50MB.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={importing || !csvFile}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50"
                >
                  {importing ? "Importing..." : "Import"}
                </button>
                {result?.errors?.length ? (
                  <button
                    onClick={downloadErrorsCsv}
                    className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Download errors CSV
                  </button>
                ) : null}
              </div>

              {result && (
                <div className="text-sm text-gray-700">
                  <div>
                    Processed: {result.summary.rows} · Created:{" "}
                    {result.summary.created} · Updated: {result.summary.updated}{" "}
                    · Errors: {result.summary.errors}
                  </div>
                  {result.errors?.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 space-y-1">
                      {result.errors.slice(0, 5).map((e, idx) => (
                        <li key={idx}>
                          Row {e.row}: {e.error}
                          {e.sku ? ` (SKU: ${e.sku})` : ""}
                          {e.title ? ` — ${e.title}` : ""}
                        </li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...and {result.errors.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </PermissionGate>

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
