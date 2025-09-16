import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import api from "../../utils/api";
import { toast } from "react-hot-toast";

type Category = { _id: string; name: string; slug: string; active: boolean };

function AdminCategoriesPage() {
  const [list, setList] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [importText, setImportText] = useState("");

  const fetchCats = async () => {
    const { data } = await api.get("/categories");
    setList(data || []);
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const create = async () => {
    try {
      await api.post("/categories", { name });
      setName("");
      fetchCats();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to create");
    }
  };

  const toggleActive = async (c: Category) => {
    await api.patch(`/categories/${c._id}`, { active: !c.active });
    fetchCats();
  };

  const bulkImport = async () => {
    try {
      const items = JSON.parse(importText);
      if (!Array.isArray(items)) throw new Error("Invalid JSON: must be array");
      await api.post("/categories/import", { items });
      setImportText("");
      fetchCats();
      toast.success("Imported");
    } catch (e: any) {
      toast.error(e?.message || "Invalid JSON");
    }
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <h1 className="text-2xl font-semibold text-gray-900">Categories</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="card p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Create</h3>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                placeholder="Category name"
              />
              <button
                onClick={create}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Example: Electronics, Fashion, Home, Beauty
            </p>
          </section>

          <section className="card p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Bulk Import (JSON)</h3>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              placeholder='[{"name":"Electronics"},{"name":"Home"}]'
            />
            <button
              onClick={bulkImport}
              className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Import
            </button>
          </section>
        </div>

        <section className="card p-4 mt-6">
          <h3 className="font-semibold text-gray-900 mb-2">All Categories</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 px-2">Name</th>
                  <th className="py-2 px-2">Slug</th>
                  <th className="py-2 px-2">Active</th>
                  <th className="py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr
                    key={c._id}
                    className="border-t border-gray-200 text-gray-900"
                  >
                    <td className="py-2 px-2">{c.name}</td>
                    <td className="py-2 px-2">{c.slug}</td>
                    <td className="py-2 px-2">{c.active ? "Yes" : "No"}</td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => toggleActive(c)}
                        className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      >
                        {c.active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminCategoriesPage), {
  ssr: false,
});
