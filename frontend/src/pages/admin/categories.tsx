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
        <div className="flex items-center justify-between font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
          <h1 className="text-3xl text-foreground">Categories</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-4">
            <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Create</h3>
            <div className="flex gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
                placeholder="Category name"
              />
              <button
                onClick={create}
                className="px-6 py-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1"
              >
                Add
              </button>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Example: Electronics, Fashion, Home, Beauty
            </p>
          </section>

          <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-4">
            <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Bulk Import (JSON)</h3>
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

        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] mt-8 overflow-hidden">
          <div className="p-4 border-b-[3px] border-border bg-card">
            <h3 className="text-xl font-black uppercase tracking-widest text-foreground">All Categories</h3>
          </div>
          <div className="overflow-x-auto p-4">
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
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 border-[3px] border-border shadow-[2px_2px_0px_#111] text-xs font-black uppercase tracking-widest ${
                          c.active
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {c.active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => toggleActive(c)}
                        className="px-3 py-1.5 border-[3px] border-border bg-card shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-bold uppercase text-xs"
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
