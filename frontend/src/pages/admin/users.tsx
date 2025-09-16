import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import AdminLayout from "../../components/layout/AdminLayout";

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: "user" | "seller" | "admin" | "subadmin" | "seller_assistant";
  status: "active" | "blocked";
  sellerRequest?: "none" | "pending" | "approved" | "rejected";
  seller?: { approved?: boolean };
  createdAt?: string;
};

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | AdminUser["role"]>("all");
  const [status, setStatus] = useState<"all" | AdminUser["status"]>("all");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const ql = q.toLowerCase();
      const matchesQ =
        !q ||
        u.name.toLowerCase().includes(ql) ||
        u.email.toLowerCase().includes(ql);
      const matchesRole = role === "all" || u.role === role;
      const matchesStatus = status === "all" || u.status === status;
      return matchesQ && matchesRole && matchesStatus;
    });
  }, [users, q, role, status]);

  const changeRole = async (id: string, newRole: AdminUser["role"]) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role: newRole });
      toast.success("Role updated");
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update role");
    }
  };

  const toggleStatus = async (id: string, newStatus: AdminUser["status"]) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { status: newStatus });
      toast.success(`User ${newStatus}`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    }
  };

  const handleSellerRequest = async (
    id: string,
    action: "approve" | "reject"
  ) => {
    try {
      await api.patch(`/admin/seller-requests/${id}`, { action });
      toast.success(`Seller request ${action}d`);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action}`);
    }
  };

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <h1 className="text-2xl font-semibold text-gray-900">Manage Users</h1>

        {/* Filters */}
        <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            placeholder="Search by name or email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 w-full md:w-80"
          />
          <div className="flex gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminUser["role"])}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900"
            >
              <option value="all">All roles</option>
              <option value="user">User</option>
              <option value="seller">Seller</option>
              <option value="admin">Admin</option>
              <option value="subadmin">Sub-admin</option>
              <option value="seller_assistant">Seller Assistant</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900"
            >
              <option value="all">All status</option>
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-600" colSpan={6}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-600" colSpan={6}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr
                    key={u._id}
                    className="border-t border-gray-200 text-gray-900"
                  >
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          changeRole(u._id, e.target.value as AdminUser["role"])
                        }
                        className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900"
                      >
                        <option value="user">User</option>
                        <option value="seller">Seller</option>
                        <option value="admin">Admin</option>
                        <option value="subadmin">Sub-admin</option>
                        <option value="seller_assistant">
                          Seller Assistant
                        </option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs capitalize ${
                          u.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.sellerRequest === "pending" ? (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs">
                          Pending
                        </span>
                      ) : u.role === "seller" && u.seller?.approved ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">
                          Approved
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">
                          {u.sellerRequest || "none"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <a
                          href={`/admin/users/${u._id}`}
                          className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        >
                          Details
                        </a>

                        {u.status === "active" ? (
                          <button
                            onClick={() => toggleStatus(u._id, "blocked")}
                            className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-500"
                          >
                            Block
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleStatus(u._id, "active")}
                            className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                          >
                            Unblock
                          </button>
                        )}

                        {u.sellerRequest === "pending" && (
                          <>
                            <a
                              href={`/admin/seller-requests/${u._id}`}
                              className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            >
                              Review Application
                            </a>
                            <button
                              onClick={() =>
                                handleSellerRequest(u._id, "approve")
                              }
                              className="px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-500"
                            >
                              Approve Seller
                            </button>
                            <button
                              onClick={() =>
                                handleSellerRequest(u._id, "reject")
                              }
                              className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
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

export default dynamic(() => Promise.resolve(AdminUsersPage), { ssr: false });
