import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { hasPerm } from "../../utils/permissions";

type MediaFile = { filename: string; size: number; mtime: string; url: string };

function AdminMediaPage() {
  const { user } = useAuth();
  const canRead = hasPerm(user as any, "media:read");
  const canWrite = hasPerm(user as any, "media:write");

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const fetchFiles = async () => {
    const { data } = await api.get("/admin/media");
    setFiles(data || []);
  };

  useEffect(() => {
    if (!canRead) return;
    fetchFiles();
  }, [canRead]);

  const upload = async () => {
    if (!canWrite) {
      toast.error("You don’t have permission to upload media");
      return;
    }
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/admin/media", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Uploaded");
      setFile(null);
      fetchFiles();
    } catch {
      toast.error("Upload failed");
    }
  };

  const del = async (filename: string) => {
    if (!canWrite) {
      toast.error("You don’t have permission to delete media");
      return;
    }
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      const encoded = encodeURIComponent(filename);
      await api.delete(`/admin/media/${encoded}`);
      toast.success("Deleted");
      fetchFiles();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Delete failed";
      toast.error(msg);
    }
  };

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <h1 className="text-2xl font-semibold text-gray-900">Media</h1>

        {!canRead ? (
          <div className="card p-6 text-gray-700">
            You don’t have access to Media.
          </div>
        ) : (
          <>
            <PermissionGate perm="media:write">
              <div className="card p-4 mb-6">
                <div className="flex items-center gap-3">
                  <input
                    id="media-upload"
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="media-upload"
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
                  {file && (
                    <span className="text-sm text-gray-600 truncate max-w-[200px]">
                      {file.name}
                    </span>
                  )}
                  <button
                    onClick={upload}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
                  >
                    Upload
                  </button>
                </div>
              </div>
            </PermissionGate>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((f) => (
                <div
                  key={f.filename}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <img
                    src={f.url}
                    alt={f.filename}
                    className="w-full h-40 object-cover"
                    onError={(e) =>
                      ((e.currentTarget as HTMLImageElement).src =
                        "/fallback.png")
                    }
                  />
                  <div className="p-3 text-sm text-gray-700">
                    <div className="truncate text-gray-900">{f.filename}</div>
                    <div className="text-xs text-gray-500">
                      {(f.size / 1024).toFixed(1)} KB
                    </div>
                    <PermissionGate perm="media:write">
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => del(f.filename)}
                          className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-500"
                        >
                          Delete
                        </button>
                      </div>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
export default dynamic(() => Promise.resolve(AdminMediaPage), { ssr: false });
