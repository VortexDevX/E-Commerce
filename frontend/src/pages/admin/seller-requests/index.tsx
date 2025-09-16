import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import AdminLayout from "../../../components/layout/AdminLayout";
import api from "../../../utils/api";
import { shortDate } from "../../../utils/format";

type Applicant = {
  _id: string;
  name: string;
  email: string;
  sellerRequest: "pending" | "approved" | "rejected";
  sellerApplication?: { businessName?: string; submittedAt?: string };
};

function AdminSellerRequestsPage() {
  const [list, setList] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/seller-requests");
      setList(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <h1 className="text-2xl font-semibold text-gray-900">
          Seller Applications
        </h1>
        <div className="card overflow-x-auto mt-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-600" colSpan={4}>
                    Loading...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-600" colSpan={4}>
                    No pending applications.
                  </td>
                </tr>
              ) : (
                list.map((u) => (
                  <tr
                    key={u._id}
                    className="border-t border-gray-200 text-gray-900"
                  >
                    <td className="px-4 py-3">
                      <div>{u.name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {u.sellerApplication?.businessName || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {u.sellerApplication?.submittedAt
                        ? shortDate(u.sellerApplication.submittedAt)
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/seller-requests/${u._id}`}
                        className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      >
                        Review
                      </Link>
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
export default dynamic(() => Promise.resolve(AdminSellerRequestsPage), {
  ssr: false,
});
