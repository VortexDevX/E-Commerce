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
          <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-black uppercase tracking-widest text-center">Loading...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  const { user, sellerApplication } = app;

  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>
        <div className="flex items-center justify-between font-black uppercase tracking-widest border-b-[3px] border-border pb-4 mb-6">
          <h1 className="text-3xl text-foreground">
            Review Seller Application
          </h1>
        </div>

        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 mt-4 mb-8">
          <h3 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4 mb-6">
            Applicant
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Name</div>
              <div className="text-foreground font-bold text-lg">{user.name}</div>
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Email</div>
              <div className="text-foreground font-bold text-lg">{user.email}</div>
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Status</div>
              <div className={`text-xs font-black uppercase tracking-widest px-3 py-1 border-[3px] border-border shadow-[2px_2px_0px_#111] w-fit ${
                user.sellerRequest === 'pending' ? 'bg-amber-400 text-amber-950' :
                user.sellerRequest === 'approved' ? 'bg-emerald-400 text-emerald-950' :
                'bg-rose-400 text-rose-950'
              }`}>
                {user.sellerRequest}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 mt-4 mb-8">
          <h3 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4 mb-6">
            Application
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              "businessName",
              "legalName",
              "phone",
              "website",
              "gst",
              "address",
              "message",
            ].map((k) => (
              <div key={k} className="bg-primary/5 border-[3px] border-border p-4 shadow-[4px_4px_0px_#111]">
                <div className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2">{k}</div>
                <div className="text-foreground font-bold break-words">
                  {sellerApplication?.[k] || "-"}
                </div>
              </div>
            ))}
          </div>
          {sellerApplication?.documents?.length ? (
            <div className="mt-8 pt-6 border-t-[3px] border-border">
              <h4 className="text-xl font-black uppercase tracking-widest text-foreground mb-4">Documents</h4>
              <ul className="grid gap-3">
                {sellerApplication.documents.map((d: any, i: number) => (
                  <li key={i}>
                    <a
                      className="block p-4 border-[3px] border-border bg-card shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all text-primary font-bold break-words"
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

        <div className="flex gap-4 mt-8">
          <button
            onClick={() => decide("approve")}
            className="px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all flex-1 sm:flex-none"
          >
            Approve
          </button>
          <button
            onClick={() => decide("reject")}
            className="px-6 py-3 border-[3px] border-border bg-card text-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] hover:-translate-y-1 transition-all flex-1 sm:flex-none"
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
