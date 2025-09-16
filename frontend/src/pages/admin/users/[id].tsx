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
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">User Details</h1>
          <a
            href="/admin/users"
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Back to Users
          </a>
        </div>

        {/* Profile card */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Name</div>
              <div className="text-gray-900 break-words">{user.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="text-gray-900 break-words">{user.email}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Role</div>
              <select
                value={permInfo.role}
                onChange={(e) => changeRole(e.target.value as Role)}
                className="mt-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900"
              >
                <option value="user">User</option>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
                <option value="subadmin">Sub-admin</option>
                <option value="seller_assistant">Seller Assistant</option>
              </select>
            </div>
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <div className="text-gray-900 capitalize">{user.status}</div>
            </div>
          </div>
        </section>

        {/* Access management */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Access Control
          </h3>

          {/* Sub-admin permissions */}
          {permInfo.role === "subadmin" && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                Assign permissions for this sub-admin. Admins always bypass
                permissions.
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {permCatalog.map((p) => {
                  const checked = selectedPerms.includes(p);
                  return (
                    <label
                      key={p}
                      className="flex items-center gap-2 text-sm text-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
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
                      <span className="font-mono">{p}</span>
                    </label>
                  );
                })}
              </div>
              <button
                onClick={savePermissions}
                disabled={savingPerms}
                className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-60"
              >
                {savingPerms ? "Saving..." : "Save permissions"}
              </button>
            </div>
          )}

          {/* Seller assistant link + permissions */}
          {permInfo.role === "seller_assistant" && (
            <div className="space-y-6">
              {/* Link assistant to an approved seller */}
              <div className="space-y-3">
                <div className="text-sm text-gray-700">
                  Link this assistant to an approved seller to grant access to
                  that seller’s data.
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Linked seller
                    </label>
                    <select
                      value={selectedSeller}
                      onChange={(e) => setSelectedSeller(e.target.value)}
                      className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 w-full"
                    >
                      <option value="">— None —</option>
                      {sellerList.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} · {s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={updateAssistantLink}
                      disabled={linking}
                      className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-60"
                    >
                      {linking ? "Saving..." : "Save link"}
                    </button>
                  </div>
                </div>
                {permInfo.assistantFor && (
                  <div className="text-xs text-gray-600">
                    Currently linked to seller:{" "}
                    <span className="font-mono">{permInfo.assistantFor}</span>
                  </div>
                )}
              </div>

              {/* Seller assistant granular permissions */}
              <div className="space-y-3">
                <div className="text-sm text-gray-700">
                  Assign granular permissions for this seller assistant.
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sellerPermCatalog.map((p) => {
                    const checked = selectedPerms.includes(p);
                    return (
                      <label
                        key={p}
                        className="flex items-center gap-2 text-sm text-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
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
                        <span className="font-mono">{p}</span>
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-60"
                >
                  {savingPerms ? "Saving..." : "Save permissions"}
                </button>
              </div>
            </div>
          )}

          {/* Seller-only notice */}
          {permInfo.role === "seller" && (
            <div className="text-sm text-gray-700">
              Seller accounts get access to their own data once approved.
            </div>
          )}
        </section>

        {/* Summary */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Orders</div>
              <div className="text-gray-900">{summary?.ordersCount ?? 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Spent</div>
              <div className="text-gray-900">
                {currency(summary?.totalSpent ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Last Order</div>
              <div className="text-gray-900">
                {summary?.lastOrderAt ? shortDate(summary.lastOrderAt) : "-"}
              </div>
            </div>
          </div>
        </section>

        {/* Orders */}
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Orders</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2">Order</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {(orders || []).map((o: any) => (
                  <tr
                    key={o._id}
                    className="border-t border-gray-200 text-gray-900"
                  >
                    <td className="py-2">#{o._id.slice(-6).toUpperCase()}</td>
                    <td className="py-2">{shortDate(o.createdAt)}</td>
                    <td className="py-2 capitalize">{o.status}</td>
                    <td className="py-2">{currency(o.totalAmount)}</td>
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

export default dynamic(() => Promise.resolve(AdminUserDetailsPage), {
  ssr: false,
});
