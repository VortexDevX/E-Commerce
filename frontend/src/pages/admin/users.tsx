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
        <div className="flex items-center justify-between font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
          <h1 className="text-3xl text-foreground">Manage Users</h1>
        </div>

        {/* Filters */}
        <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-8">
          <input
            placeholder="Search by name or email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all w-full md:w-80"
          />
          <div className="flex gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminUser["role"])}
              className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
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
              className="bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-primary/5 text-foreground border-b-[3px] border-border">
                <th className="px-4 py-4 font-black uppercase tracking-widest">Name</th>
                <th className="px-4 py-4 font-black uppercase tracking-widest">Email</th>
                <th className="px-4 py-4 font-black uppercase tracking-widest">Role</th>
                <th className="px-4 py-4 font-black uppercase tracking-widest">Status</th>
                <th className="px-4 py-4 font-black uppercase tracking-widest">Seller</th>
                <th className="px-4 py-4 font-black uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-foreground font-bold uppercase tracking-widest text-sm" colSpan={6}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-foreground font-bold uppercase tracking-widest text-sm" colSpan={6}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr
                    key={u._id}
                    className="border-b-[3px] border-border/50 text-foreground font-bold hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-4">{u.name}</td>
                    <td className="px-4 py-4">{u.email}</td>
                    <td className="px-4 py-4">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          changeRole(u._id, e.target.value as AdminUser["role"])
                        }
                        className="bg-card border-[3px] border-border rounded-none px-2 py-1 text-foreground font-bold shadow-[2px_2px_0px_#111] focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] hover:shadow-none transition-all text-xs uppercase"
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
                    <td className="px-4 py-4">
                      <span
                        className={`px-3 py-1 border-[3px] border-border shadow-[2px_2px_0px_transparent] hover:shadow-[2px_2px_0px_#111] text-xs font-black uppercase tracking-widest transition-all ${
                          u.status === "active"
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-rose-400 text-rose-950"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {u.sellerRequest === "pending" ? (
                        <span className="text-amber-950 bg-amber-400 border-[3px] border-border shadow-[2px_2px_0px_#111] font-black uppercase tracking-widest px-3 py-1 text-xs">
                          Pending
                        </span>
                      ) : u.role === "seller" && u.seller?.approved ? (
                        <span className="text-emerald-950 bg-emerald-400 border-[3px] border-border shadow-[2px_2px_0px_#111] font-black uppercase tracking-widest px-3 py-1 text-xs">
                          Approved
                        </span>
                      ) : (
                        <span className="text-foreground font-black uppercase tracking-widest text-xs px-3 py-1 border-[3px] border-transparent">
                          {u.sellerRequest || "none"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <a
                          href={`/admin/users/${u._id}`}
                          className="px-4 py-2 border-[3px] border-border bg-card shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all font-black uppercase text-xs flex items-center"
                        >
                          Details
                        </a>

                        {u.status === "active" ? (
                          <button
                            onClick={() => toggleStatus(u._id, "blocked")}
                            className="px-4 py-2 border-[3px] border-rose-600 bg-rose-600 shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all text-white font-black uppercase text-xs"
                          >
                            Block
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleStatus(u._id, "active")}
                            className="px-4 py-2 border-[3px] border-emerald-600 bg-emerald-600 shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all text-white font-black uppercase text-xs"
                          >
                            Unblock
                          </button>
                        )}

                        {u.sellerRequest === "pending" && (
                          <>
                            <a
                              href={`/admin/seller-requests/${u._id}`}
                              className="px-4 py-2 border-[3px] border-border bg-card shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all font-black uppercase text-xs flex items-center"
                            >
                              Review
                            </a>
                            <button
                              onClick={() =>
                                handleSellerRequest(u._id, "approve")
                              }
                              className="px-4 py-2 border-[3px] border-primary bg-primary shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all text-primary-foreground font-black uppercase text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                handleSellerRequest(u._id, "reject")
                              }
                              className="px-4 py-2 border-[3px] border-border bg-card shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all font-black uppercase text-xs flex items-center"
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
