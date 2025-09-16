import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import AdminLayout from "../../../components/layout/AdminLayout";
import api from "../../../utils/api";
import { toast } from "react-hot-toast";

function AdminSellerRequestDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [app, setApp] = useState<any>(null);

  const fetchOne = async () => {
    const { data } = await api.get(`/admin/seller-requests/${id}/details`);
    setApp(data);
  };

  useEffect(() => {
    if (id) fetchOne();
  }, [id]);

  const decide = async (action: "approve" | "reject") => {
    try {
      await api.patch(`/admin/seller-requests/${id}`, { action });
      toast.success(`Request ${action}d`);
      router.push("/admin/seller-requests");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed");
    }
  };

  if (!app) {
    return (
      <ProtectedRoute roles={["admin"]}>
        <AdminLayout>
          <div className="card p-6 text-gray-600">Loading...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  const { user, sellerApplication } = app;

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <h1 className="text-2xl font-semibold text-gray-900">
          Review Seller Application
        </h1>

        <section className="card p-4 mt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Applicant
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Name</div>
              <div className="text-gray-900">{user.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Email</div>
              <div className="text-gray-900">{user.email}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div className="text-gray-900 capitalize">
                {user.sellerRequest}
              </div>
            </div>
          </div>
        </section>

        <section className="card p-4 mt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Application
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              "businessName",
              "legalName",
              "phone",
              "website",
              "gst",
              "address",
              "message",
            ].map((k) => (
              <div key={k}>
                <div className="text-sm text-gray-600">{k}</div>
                <div className="text-gray-900 break-words">
                  {sellerApplication?.[k] || "-"}
                </div>
              </div>
            ))}
          </div>
          {sellerApplication?.documents?.length ? (
            <div className="mt-4">
              <h4 className="font-semibold text-gray-900">Documents</h4>
              <ul className="list-disc ml-5 text-sm text-gray-700">
                {sellerApplication.documents.map((d: any, i: number) => (
                  <li key={i}>
                    <a
                      className="text-purple-700 hover:underline"
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {d.name || d.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => decide("approve")}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
          >
            Approve
          </button>
          <button
            onClick={() => decide("reject")}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Reject
          </button>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
export default dynamic(() => Promise.resolve(AdminSellerRequestDetailPage), {
  ssr: false,
});
