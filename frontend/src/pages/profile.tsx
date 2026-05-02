import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import { fetchMe } from "../store/slices/authSlice";
import { toast } from "react-hot-toast";
import api from "../utils/api";

type Address = {
  _id?: string;
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  isDefault?: boolean;
};

function ProfilePage() {
  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <ProfileInner />
    </ProtectedRoute>
  );
}

function ProfileInner() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Addresses
  const addresses = (user as any)?.addresses || [];
  const [newAddr, setNewAddr] = useState<Address>({
    label: "",
    line1: "",
    city: "",
    country: "India",
  });

  // Seller request
  const sellerStatus = (user as any)?.sellerRequest || "none";
  const canRequestSeller = useMemo(
    () => sellerStatus === "none" || sellerStatus === "rejected",
    [sellerStatus]
  );

  // Sync form fields when user changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me", { name, email });
      await dispatch(fetchMe());
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const sendResetLink = async () => {
    if (!user?.email) {
      toast.error("No email found on account");
      return;
    }
    setSendingReset(true);
    try {
      await api.post("/auth/forgot-password", { email: user.email });
      toast.success("Password reset link sent to your email");
    } catch (err: any) {
      // Backend currently returns 404 if not found — we’ll still show success-like UX to avoid enumeration
      if (err?.response?.status === 404) {
        toast.success("If an account exists, a reset link has been sent");
      } else {
        toast.error(err.response?.data?.message || "Failed to send reset link");
      }
    } finally {
      setSendingReset(false);
    }
  };

  const addAddress = async () => {
    if (!newAddr.line1) {
      toast.error("Address line is required");
      return;
    }
    try {
      await api.post("/users/addresses", newAddr);
      await dispatch(fetchMe());
      setNewAddr({ label: "", line1: "", city: "", country: "India" });
      toast.success("Address added");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add address");
    }
  };

  const updateAddress = async (id: string, patch: Partial<Address>) => {
    try {
      await api.put(`/users/addresses/${id}`, patch);
      await dispatch(fetchMe());
      toast.success("Address updated");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update address");
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await api.delete(`/users/addresses/${id}`);
      await dispatch(fetchMe());
      toast.success("Address removed");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove address");
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await api.patch(`/users/addresses/${id}/default`);
      await dispatch(fetchMe());
      toast.success("Default address set");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to set default");
    }
  };

  const requestSeller = async () => {
    router.push("/seller/apply");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div className="border-b-[3px] border-border pb-4 mb-4">
        <h1 className="text-4xl font-black uppercase tracking-widest text-foreground">Profile</h1>
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-2">
          Manage your personal info, security, and addresses.
        </p>
      </div>

      {/* Basic Info */}
      <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-foreground">
          Basic Information
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Name</label>
            <input
              className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-foreground mb-2">Email</label>
            <input
              type="email"
              className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="pt-2 border-t-[3px] border-border">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="px-8 py-3 mt-4 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {/* Security */}
      <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4">Security</h2>
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          For security, password changes happen via a reset link we email to
          you.
        </p>
        <button
          onClick={sendResetLink}
          disabled={sendingReset}
          className="px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 disabled:opacity-50"
        >
          {sendingReset ? "Sending..." : "Send password reset link"}
        </button>
      </section>

      {/* Addresses */}
      <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4">Addresses</h2>

        {/* Add new */}
        <div className="grid md:grid-cols-3 gap-3">
          <input
            placeholder="Label (e.g., Home)"
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            value={newAddr.label || ""}
            onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
          />
          <input
            placeholder="Line 1"
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            value={newAddr.line1 || ""}
            onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
          />
          <input
            placeholder="Line 2"
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            value={newAddr.line2 || ""}
            onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })}
          />
          <input
            placeholder="City"
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            value={newAddr.city || ""}
            onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
          />
          <input
            placeholder="State"
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            value={newAddr.state || ""}
            onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
          />
          <input
            placeholder="ZIP"
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            value={newAddr.zip || ""}
            onChange={(e) => setNewAddr({ ...newAddr, zip: e.target.value })}
          />
          <input
            placeholder="Country"
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            value={newAddr.country || ""}
            onChange={(e) =>
              setNewAddr({ ...newAddr, country: e.target.value })
            }
          />
          <input
            placeholder="Phone"
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            value={newAddr.phone || ""}
            onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
          />
          <label className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-foreground">
            <input
              type="checkbox"
              className="w-5 h-5 border-[3px] border-border text-primary rounded-none focus:ring-primary focus:ring-offset-0"
              checked={!!newAddr.isDefault}
              onChange={(e) =>
                setNewAddr({ ...newAddr, isDefault: e.target.checked })
              }
            />
            Make default
          </label>
        </div>
        <div className="pt-2">
          <button
            onClick={addAddress}
            className="px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1"
          >
            Add Address
          </button>
        </div>

        {/* List */}
        <div className="space-y-4 mt-8 pt-6 border-t-[3px] border-border">
          {addresses.length === 0 && (
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No addresses yet.</p>
          )}
          {addresses.map((a: Address) => (
            <div
              key={a._id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border-[3px] border-border p-4 shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              <div className="space-y-1">
                <p className="font-black uppercase tracking-widest text-foreground text-lg flex items-center gap-3">
                  {a.label || "Address"}
                  {a.isDefault && (
                    <span className="text-[10px] bg-emerald-300 border-[3px] border-emerald-950 font-black uppercase tracking-widest text-emerald-950 px-2 py-0.5 shadow-[2px_2px_0px_#111]">
                      Default
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
                  {[a.line1, a.line2, a.city, a.state, a.zip, a.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {a.phone && (
                  <p className="text-foreground font-bold uppercase tracking-widest text-xs mt-1">📞 {a.phone}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 md:mt-0">
                {!a.isDefault && (
                  <button
                    onClick={() => makeDefault(a._id!)}
                    className="px-4 py-2 border-[3px] border-border bg-card shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-bold uppercase text-xs"
                  >
                    Make Default
                  </button>
                )}
                <button
                  onClick={() =>
                    updateAddress(a._id!, {
                      label: (a.label || "") + "",
                    })
                  }
                  className="px-4 py-2 border-[3px] border-border bg-card shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-bold uppercase text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteAddress(a._id!)}
                  className="px-4 py-2 border-[3px] border-rose-600 bg-rose-600 text-white shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none font-bold uppercase tracking-widest transition-colors flex items-center justify-center text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seller */}
      <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4">Seller Account</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Status:{" "}
            <span className="inline-flex items-center px-3 py-1 border-[3px] border-border shadow-[2px_2px_0px_#111] text-xs font-black bg-foreground text-background">
              {sellerStatus}
            </span>
          </p>
          <button
            onClick={requestSeller}
            disabled={!canRequestSeller}
            className="px-6 py-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 disabled:opacity-50 text-sm w-fit"
          >
            {canRequestSeller
              ? "Request Seller Access"
              : "Request Pending/Approved"}
          </button>
        </div>
      </section>
    </div>
  );
}

// Disable SSR for this page
export default dynamic(() => Promise.resolve(ProfilePage), { ssr: false });
