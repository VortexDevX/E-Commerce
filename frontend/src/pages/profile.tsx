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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-1">
          Manage your personal info, security, and addresses.
        </p>
      </div>

      {/* Basic Info */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Basic Information
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Name</label>
            <input
              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={saveProfile}
          disabled={saving}
          className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </section>

      {/* Security */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Security</h2>
        <p className="text-gray-700">
          For security, password changes happen via a reset link we email to
          you.
        </p>
        <button
          onClick={sendResetLink}
          disabled={sendingReset}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50"
        >
          {sendingReset ? "Sending..." : "Send password reset link"}
        </button>
      </section>

      {/* Addresses */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Addresses</h2>

        {/* Add new */}
        <div className="grid md:grid-cols-3 gap-3">
          <input
            placeholder="Label (e.g., Home)"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            value={newAddr.label || ""}
            onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
          />
          <input
            placeholder="Line 1"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            value={newAddr.line1 || ""}
            onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
          />
          <input
            placeholder="Line 2"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            value={newAddr.line2 || ""}
            onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })}
          />
          <input
            placeholder="City"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            value={newAddr.city || ""}
            onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
          />
          <input
            placeholder="State"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            value={newAddr.state || ""}
            onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
          />
          <input
            placeholder="ZIP"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            value={newAddr.zip || ""}
            onChange={(e) => setNewAddr({ ...newAddr, zip: e.target.value })}
          />
          <input
            placeholder="Country"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            value={newAddr.country || ""}
            onChange={(e) =>
              setNewAddr({ ...newAddr, country: e.target.value })
            }
          />
          <input
            placeholder="Phone"
            className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            value={newAddr.phone || ""}
            onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!newAddr.isDefault}
              onChange={(e) =>
                setNewAddr({ ...newAddr, isDefault: e.target.checked })
              }
            />
            Make default
          </label>
        </div>
        <button
          onClick={addAddress}
          className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
        >
          Add Address
        </button>

        {/* List */}
        <div className="space-y-3 mt-4">
          {addresses.length === 0 && (
            <p className="text-gray-600">No addresses yet.</p>
          )}
          {addresses.map((a: Address) => (
            <div
              key={a._id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {a.label || "Address"}{" "}
                  {a.isDefault && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </p>
                <p className="text-gray-600 text-sm">
                  {[a.line1, a.line2, a.city, a.state, a.zip, a.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {a.phone && (
                  <p className="text-gray-500 text-sm">📞 {a.phone}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!a.isDefault && (
                  <button
                    onClick={() => makeDefault(a._id!)}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
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
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteAddress(a._id!)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seller */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Seller Account</h2>
        <p className="text-gray-700">
          Status:{" "}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-gray-100 text-gray-800 capitalize">
            {sellerStatus}
          </span>
        </p>
        <button
          onClick={requestSeller}
          disabled={!canRequestSeller}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
        >
          {canRequestSeller
            ? "Request Seller Access"
            : "Request Pending/Approved"}
        </button>
      </section>
    </div>
  );
}

// Disable SSR for this page
export default dynamic(() => Promise.resolve(ProfilePage), { ssr: false });
