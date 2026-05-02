import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import AdminLayout from "../../../components/layout/AdminLayout";
import api from "../../../utils/api";
import { currency, shortDate } from "../../../utils/format";
import { toast } from "react-hot-toast";

type Role = "user" | "seller" | "admin" | "subadmin" | "seller_assistant";

function AdminUserDetailsPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Permissions state
  const [permCatalog, setPermCatalog] = useState<string[]>([]); // sub-admin catalog
  const [sellerPermCatalog, setSellerPermCatalog] = useState<string[]>([]); // seller assistant catalog
  const [permInfo, setPermInfo] = useState<{
    role: Role;
    permissions: string[];
    assistantFor?: string | null;
    sellerApproved?: boolean;
  }>({
    role: "user",
    permissions: [],
    assistantFor: null,
    sellerApproved: false,
  });
  const [savingPerms, setSavingPerms] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [sellerList, setSellerList] = useState<
    { _id: string; name: string; email: string }[]
  >([]);
  const [linking, setLinking] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<string>("");

  const fetchAll = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [details, pcat, pinfo, users] = await Promise.all([
        api.get(`/admin/users/${id}/details`),
        api.get(`/admin/permissions/catalog`),
        api.get(`/admin/users/${id}/permissions`),
        api.get(`/admin/users`), // used to build seller list
      ]);
      setData(details.data);

      // Get both catalogs from API
      setPermCatalog(pcat.data?.permissions || []);
      setSellerPermCatalog(pcat.data?.sellerAssistant || []);

      setPermInfo(pinfo.data);
      setSelectedPerms(pinfo.data?.permissions || []);

      const sellers = (users.data || []).filter(
        (u: any) => u.role === "seller" && u?.seller?.approved
      );
      setSellerList(sellers);
      setSelectedSeller(pinfo.data.assistantFor || "");
    } catch (e) {
      toast.error("Failed to load user details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { user, orders, summary } = data || {
    user: {},
    orders: [],
    summary: {},
  };

  const changeRole = async (newRole: Role) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role: newRole });
      toast.success("Role updated");
      fetchAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update role");
    }
  };

  const savePermissions = async () => {
    try {
      setSavingPerms(true);
      await api.patch(`/admin/users/${id}/permissions`, {
        permissions: selectedPerms,
      });
      toast.success("Permissions updated");
      fetchAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update permissions");
    } finally {
      setSavingPerms(false);
    }
  };

  const updateAssistantLink = async () => {
    try {
      setLinking(true);
      await api.patch(`/admin/users/${id}/assistant`, {
        sellerId: selectedSeller || null,
      });
      toast.success(selectedSeller ? "Assistant linked" : "Assistant unlinked");
      fetchAll();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Failed to update assistant link"
      );
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute roles={["admin"]}>
        <AdminLayout>
          <div className="text-gray-600">Loading...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between flex-wrap gap-4 border-b-[3px] border-border pb-4 mb-8">
          <h1 className="text-3xl font-black uppercase tracking-widest text-foreground">User Details</h1>
          <a
            href="/admin/users"
            className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all"
          >
            Back to Users
          </a>
        </div>

        {/* Profile card */}
        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 mb-8">
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Name</div>
              <div className="text-foreground font-bold text-lg break-words">{user.name}</div>
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Email</div>
              <div className="text-foreground font-bold text-lg break-words">{user.email}</div>
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Role</div>
              <select
                value={permInfo.role}
                onChange={(e) => changeRole(e.target.value as Role)}
                className="mt-1 bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all uppercase"
              >
                <option value="user">User</option>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
                <option value="subadmin">Sub-admin</option>
                <option value="seller_assistant">Seller Assistant</option>
              </select>
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Status</div>
              <div className="text-foreground font-bold text-lg capitalize">{user.status}</div>
            </div>
          </div>
        </section>

        {/* Access management */}
        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 mb-8">
          <h3 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4 mb-6">
            Access Control
          </h3>

          {/* Sub-admin permissions */}
          {permInfo.role === "subadmin" && (
            <div className="space-y-6">
              <div className="text-sm font-bold uppercase tracking-widest bg-amber-400 text-amber-950 p-4 border-[3px] border-border shadow-[4px_4px_0px_#111] leading-relaxed">
                Assign permissions for this sub-admin. Admins always bypass
                permissions.
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {permCatalog.map((p) => {
                  const checked = selectedPerms.includes(p);
                  return (
                    <label
                      key={p}
                      className="flex items-center gap-3 text-sm text-foreground cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        className="w-6 h-6 border-[3px] border-border rounded-none text-primary focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPerms((arr) =>
                              Array.from(new Set([...arr, p]))
                            );
                          } else {
                            setSelectedPerms((arr) =>
                              arr.filter((x) => x !== p)
                            );
                          }
                        }}
                      />
                      <span className="font-bold uppercase tracking-widest text-xs group-hover:text-primary transition-colors">{p}</span>
                    </label>
                  );
                })}
              </div>
              <button
                onClick={savePermissions}
                disabled={savingPerms}
                className="px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPerms ? "Saving..." : "Save permissions"}
              </button>
            </div>
          )}

          {/* Seller assistant link + permissions */}
          {permInfo.role === "seller_assistant" && (
            <div className="space-y-8 pt-4 border-t-[3px] border-border">
              {/* Link assistant to an approved seller */}
              <div className="space-y-4">
                <div className="text-sm font-bold uppercase tracking-widest bg-amber-400 text-amber-950 p-4 border-[3px] border-border shadow-[4px_4px_0px_#111] leading-relaxed">
                  Link this assistant to an approved seller to grant access to
                  that seller’s data.
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-black uppercase tracking-widest text-foreground mb-2">
                      Linked seller
                    </label>
                    <select
                      value={selectedSeller}
                      onChange={(e) => setSelectedSeller(e.target.value)}
                      className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 text-foreground font-bold shadow-[4px_4px_0px_transparent] focus:outline-none focus:shadow-[4px_4px_0px_#111] transition-all"
                    >
                      <option value="">— None —</option>
                      {sellerList.map((s) => (
                        <option key={s._id} value={s._id} className="font-bold">
                          {s.name} · {s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={updateAssistantLink}
                      disabled={linking}
                      className="w-full sm:w-auto px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {linking ? "Saving..." : "Save link"}
                    </button>
                  </div>
                </div>
                {permInfo.assistantFor && (
                  <div className="text-sm font-bold uppercase tracking-widest text-foreground bg-primary/10 border-[3px] border-primary p-4 shadow-[4px_4px_0px_#111]">
                    Currently linked to seller:{" "}
                    <span className="font-black text-primary">{permInfo.assistantFor}</span>
                  </div>
                )}
              </div>

              {/* Seller assistant granular permissions */}
              <div className="space-y-6 pt-6 border-t-[3px] border-border">
                <div className="text-sm font-bold uppercase tracking-widest text-foreground">
                  Assign granular permissions for this seller assistant.
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sellerPermCatalog.map((p) => {
                    const checked = selectedPerms.includes(p);
                    return (
                      <label
                        key={p}
                        className="flex items-center gap-3 text-sm text-foreground cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          className="w-6 h-6 border-[3px] border-border rounded-none text-primary focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPerms((arr) =>
                                Array.from(new Set([...arr, p]))
                              );
                            } else {
                              setSelectedPerms((arr) =>
                                arr.filter((x) => x !== p)
                              );
                            }
                          }}
                        />
                        <span className="font-bold uppercase tracking-widest text-xs group-hover:text-primary transition-colors">{p}</span>
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPerms ? "Saving..." : "Save permissions"}
                </button>
              </div>
            </div>
          )}

          {/* Seller-only notice */}
          {permInfo.role === "seller" && (
            <div className="text-sm font-bold uppercase tracking-widest bg-emerald-400 text-emerald-950 p-4 border-[3px] border-border shadow-[4px_4px_0px_#111] leading-relaxed mt-4">
              Seller accounts get access to their own data once approved.
            </div>
          )}
        </section>

        {/* Summary */}
        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 mb-8">
          <h3 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4 mb-6">Summary</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-primary/5 border-[3px] border-border p-4 shadow-[4px_4px_0px_#111]">
              <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Total Orders</div>
              <div className="text-3xl font-black text-foreground">{summary?.ordersCount ?? 0}</div>
            </div>
            <div className="bg-emerald-400/10 border-[3px] border-emerald-950 p-4 shadow-[4px_4px_0px_#111]">
              <div className="text-sm font-black uppercase tracking-widest text-emerald-950 mb-1">Total Spent</div>
              <div className="text-3xl font-black text-emerald-950">
                {currency(summary?.totalSpent ?? 0)}
              </div>
            </div>
            <div className="bg-rose-400/10 border-[3px] border-rose-950 p-4 shadow-[4px_4px_0px_#111]">
              <div className="text-sm font-black uppercase tracking-widest text-rose-950 mb-1">Last Order</div>
              <div className="text-xl font-bold uppercase tracking-widest text-rose-950 mt-2">
                {summary?.lastOrderAt ? shortDate(summary.lastOrderAt) : "-"}
              </div>
            </div>
          </div>
        </section>

        {/* Orders */}
        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6">
          <h3 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4 mb-6">Orders</h3>
          <div className="overflow-x-auto border-[3px] border-border shadow-[4px_4px_0px_#111]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left bg-primary/5 text-foreground border-b-[3px] border-border">
                  <th className="px-4 py-4 font-black uppercase tracking-widest">Order</th>
                  <th className="px-4 py-4 font-black uppercase tracking-widest">Date</th>
                  <th className="px-4 py-4 font-black uppercase tracking-widest">Status</th>
                  <th className="px-4 py-4 font-black uppercase tracking-widest">Total</th>
                </tr>
              </thead>
              <tbody>
                {(orders || []).map((o: any) => (
                  <tr
                    key={o._id}
                    className="border-b-[3px] border-border/50 text-foreground font-bold hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-4 text-primary font-black uppercase tracking-widest cursor-pointer hover:underline decoration-[3px] underline-offset-4">
                      #{o._id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-4 font-bold uppercase tracking-widest">{shortDate(o.createdAt)}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 border-[3px] border-border shadow-[2px_2px_0px_#111] font-black uppercase tracking-widest text-xs ${
                        o.status === "delivered" ? "bg-emerald-400 text-emerald-950" : 
                        o.status === "cancelled" ? "bg-rose-400 text-rose-950" : 
                        "bg-primary/20 text-foreground"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-black">{currency(o.totalAmount)}</td>
                  </tr>
                ))}
                {(!orders || orders.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center font-bold uppercase tracking-widest text-muted-foreground">
                      No orders found for this user
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminUserDetailsPage), {
  ssr: false,
});
