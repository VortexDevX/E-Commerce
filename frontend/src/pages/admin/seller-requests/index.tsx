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
        <div className="flex items-center justify-between font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
          <h1 className="text-3xl text-foreground">Seller Applications</h1>
        </div>
        <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] overflow-x-auto mt-4 mb-8">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-primary/5 text-foreground border-b-[3px] border-border">
                <th className="px-4 py-4 font-black uppercase tracking-widest">Applicant</th>
                <th className="px-4 py-4 font-black uppercase tracking-widest">Business</th>
                <th className="px-4 py-4 font-black uppercase tracking-widest">Submitted</th>
                <th className="px-4 py-4 font-black uppercase tracking-widest">Action</th>
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
                  <td className="px-4 py-6 text-foreground font-bold uppercase" colSpan={4}>
                    No pending applications.
                  </td>
                </tr>
              ) : (
                list.map((u) => (
                  <tr
                    key={u._id}
                    className="border-b-[3px] border-border/50 text-foreground font-bold hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="font-black uppercase tracking-widest">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-4 font-bold uppercase tracking-widest">
                      {u.sellerApplication?.businessName || "-"}
                    </td>
                    <td className="px-4 py-4 font-bold uppercase tracking-widest">
                      {u.sellerApplication?.submittedAt
                        ? shortDate(u.sellerApplication.submittedAt)
                        : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/seller-requests/${u._id}`}
                        className="px-4 py-2 border-[3px] border-border bg-card shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all font-black uppercase text-xs flex items-center w-fit text-foreground"
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
