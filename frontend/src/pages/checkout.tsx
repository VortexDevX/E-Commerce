import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import type { RootState, AppDispatch } from "../store";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import api from "../utils/api";
import { currency } from "../utils/format";
import { clearCart } from "../store/slices/cartSlice";
import { toast } from "react-hot-toast";
import { getImageUrl } from "../utils/images";
import { trackCheckout } from "../utils/analytics";

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

function CheckoutPage() {
  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <CheckoutInner />
    </ProtectedRoute>
  );
}

function CheckoutInner() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const items = useSelector((s: RootState) => s.cart.items ?? []);
  const user = useSelector((s: RootState) => s.auth.user);
  const addresses = (user?.addresses as Address[] | undefined) || [];

  // Track checkout view once when page has items
  const trackedRef = useRef(false);
  useEffect(() => {
    if (!trackedRef.current && items.length > 0) {
      trackCheckout();
      trackedRef.current = true;
    }
  }, [items.length]);

  // Address mode: pick existing or create new
  const [mode, setMode] = useState<"existing" | "new">(
    addresses.length > 0 ? "existing" : "new"
  );

  // Existing address selection
  const defaultAddrId =
    addresses.find((a) => a.isDefault)?._id || addresses[0]?._id;
  const [selectedAddressId, setSelectedAddressId] = useState<
    string | undefined
  >(defaultAddrId);

  useEffect(() => {
    // Keep selection in sync if addresses change
    if (!addresses.length) {
      setMode("new");
      setSelectedAddressId(undefined);
    } else if (!selectedAddressId) {
      setMode("existing");
      setSelectedAddressId(
        addresses.find((a) => a.isDefault)?._id || addresses[0]?._id
      );
    }
  }, [addresses, selectedAddressId]);

  // New address fields
  const [newAddr, setNewAddr] = useState<Address>({
    label: "Home",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "India",
    phone: "",
    isDefault: true,
  });
  const [saveToProfile, setSaveToProfile] = useState(true);

  // Shipping method
  const [shipping, setShipping] = useState<"standard" | "express">("standard");

  const {
    subtotal: cartSubtotal,
    discount: cartDiscount,
    discountedSubtotal: cartDiscountedSubtotal,
    appliedCoupon,
  } = useSelector((s: RootState) => s.cart);
  const rawSubtotal = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + (i.priceAtAdd ?? i.product.price) * i.qty,
        0
      ),
    [items]
  );
  // prefer store's discountedSubtotal if present
  const effectiveSubtotal = cartDiscountedSubtotal || rawSubtotal;
  const shippingCost = shipping === "express" ? 99 : 0;
  const tax = Math.round(effectiveSubtotal * 0.05);
  const grandTotal = effectiveSubtotal + shippingCost + tax;

  const [placing, setPlacing] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const formatAddress = (a: Address) =>
    [a.label, a.line1, a.line2, a.city, a.state, a.zip, a.country, a.phone]
      .filter(Boolean)
      .join(", ");

  const addressToSend =
    mode === "existing"
      ? formatAddress(addresses.find((a) => a._id === selectedAddressId) || {})
      : formatAddress(newAddr);

  const canPlaceOrder =
    items.length > 0 &&
    ((mode === "existing" && !!selectedAddressId) ||
      (mode === "new" && !!newAddr.line1 && !!newAddr.city));

  const placeOrder = async () => {
    if (!canPlaceOrder) {
      toast.error("Please select or enter a valid address.");
      return;
    }
    if (!acceptedPolicies) {
      toast.error("Please accept the Terms and Privacy Policy to continue.");
      return;
    }

    setPlacing(true);
    const t = toast.loading("Placing your order...");

    try {
      if (mode === "new" && saveToProfile) {
        try {
          await api.post("/users/addresses", newAddr);
        } catch {}
      }

      await api.post("/orders", {
        address: addressToSend,
        shippingMethod: shipping, // <-- send the chosen method
      });

      dispatch(clearCart());

      toast.success("Order placed successfully!", { id: t });
      router.push("/orders");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to place order.", {
        id: t,
      });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8">
      {/* Left: Address + Shipping */}
      <div className="md:col-span-2 space-y-8">
        {/* Address selection */}
        <section className="p-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Shipping Address
          </h2>

          {/* Mode toggle */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setMode("existing")}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                mode === "existing"
                  ? "bg-purple-600 text-white border-purple-600 shadow"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              disabled={addresses.length === 0}
              title={
                addresses.length === 0
                  ? "No saved addresses — add a new one below"
                  : ""
              }
            >
              Use Saved Address
            </button>
            <button
              onClick={() => setMode("new")}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                mode === "new"
                  ? "bg-purple-600 text-white border-purple-600 shadow"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Enter New Address
            </button>
          </div>

          {/* Existing addresses */}
          {mode === "existing" && addresses.length > 0 && (
            <div className="space-y-3">
              {addresses.map((a) => (
                <label
                  key={a._id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selectedAddressId === a._id
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="addr"
                    className="mt-1"
                    checked={selectedAddressId === a._id}
                    onChange={() => setSelectedAddressId(a._id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {a.label || "Address"}
                      </p>
                      {a.isDefault && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm">
                      {[a.line1, a.line2, a.city, a.state, a.zip, a.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {a.phone && (
                      <p className="text-gray-500 text-sm">📞 {a.phone}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* New address form */}
          {mode === "new" && (
            <div className="grid md:grid-cols-2 gap-3 mt-2">
              <input
                placeholder="Label (e.g., Home)"
                className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                value={newAddr.label || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, label: e.target.value })
                }
              />
              <input
                placeholder="Phone"
                className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                value={newAddr.phone || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, phone: e.target.value })
                }
              />
              <input
                placeholder="Address line 1"
                className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                value={newAddr.line1 || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, line1: e.target.value })
                }
              />
              <input
                placeholder="Address line 2"
                className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                value={newAddr.line2 || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, line2: e.target.value })
                }
              />
              <input
                placeholder="City"
                className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                value={newAddr.city || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, city: e.target.value })
                }
              />
              <input
                placeholder="State"
                className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                value={newAddr.state || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, state: e.target.value })
                }
              />
              <input
                placeholder="ZIP"
                className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                value={newAddr.zip || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, zip: e.target.value })
                }
              />
              <input
                placeholder="Country"
                className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                value={newAddr.country || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, country: e.target.value })
                }
              />
              <label className="inline-flex items-center gap-2 text-sm md:col-span-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={saveToProfile}
                  onChange={(e) => setSaveToProfile(e.target.checked)}
                />
                Save to my profile as{" "}
                <span className="font-medium text-gray-900">
                  {newAddr.label || "Home"}
                </span>
              </label>
            </div>
          )}
        </section>

        {/* Shipping method */}
        <section className="p-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Shipping Method
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => setShipping("standard")}
              className={`p-4 rounded-lg border text-left transition ${
                shipping === "standard"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="font-medium text-gray-900">Standard</p>
              <p className="text-gray-600 text-sm">4-7 days · ₹0</p>
            </button>
            <button
              onClick={() => setShipping("express")}
              className={`p-4 rounded-lg border text-left transition ${
                shipping === "express"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="font-medium text-gray-900">Express</p>
              <p className="text-gray-600 text-sm">1-2 days · ₹99</p>
            </button>
          </div>
        </section>
      </div>

      {/* Right: Order Summary */}
      <aside className="p-6 rounded-xl border border-gray-200 bg-white shadow-sm h-fit md:sticky md:top-24 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>

        {items.length === 0 ? (
          <div className="text-gray-600">
            Your cart is empty.{" "}
            <Link href="/products" className="text-purple-600 underline">
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="max-h-60 overflow-auto divide-y divide-gray-200">
              {items.map((i) => (
                <div key={i._id} className="flex items-center gap-3 py-3">
                  <img
                    src={getImageUrl(i.product.images?.[0])}
                    alt={i.product.title}
                    className="w-14 h-14 object-cover rounded border border-gray-200"
                    onError={(e) =>
                      ((e.currentTarget as HTMLImageElement).src =
                        "/fallback.png")
                    }
                  />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{i.product.title}</p>
                    <p className="text-xs text-gray-500">Qty: {i.qty}</p>
                  </div>
                  <div className="text-sm text-gray-900">
                    {currency((i.priceAtAdd ?? i.product.price) * i.qty)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-gray-700">
              <p className="flex justify-between">
                <span>Subtotal</span>
                <span>{currency(rawSubtotal)}</span>
              </p>
              <p className="flex justify-between">
                <span>Shipping</span>
                <span>
                  {shippingCost === 0 ? "Free" : currency(shippingCost)}
                </span>
              </p>
              {appliedCoupon && cartDiscount > 0 && (
                <p className="flex justify-between">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span>-{currency(cartDiscount)}</span>
                </p>
              )}
              <p className="flex justify-between">
                <span>Tax (5%)</span>
                <span>{currency(tax)}</span>
              </p>
              <hr className="border-gray-200" />
              <p className="flex justify-between font-semibold text-lg text-gray-900">
                <span>Total</span>
                <span>{currency(grandTotal)}</span>
              </p>
            </div>

            {/* Explicit legal acceptance */}
            <div className="flex items-start gap-2">
              <input
                id="accept-policies"
                type="checkbox"
                className="mt-0.5"
                checked={acceptedPolicies}
                onChange={(e) => setAcceptedPolicies(e.target.checked)}
              />
              <label
                htmlFor="accept-policies"
                className="text-xs text-gray-600"
              >
                I agree to the{" "}
                <Link
                  href="/policies/terms"
                  className="underline text-gray-700 hover:text-gray-900"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/policies/privacy"
                  className="underline text-gray-700 hover:text-gray-900"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <button
              onClick={placeOrder}
              disabled={placing || !canPlaceOrder || !acceptedPolicies}
              className="w-full bg-purple-600 text-white py-3 rounded-md shadow hover:bg-purple-500 disabled:opacity-50"
            >
              {placing ? "Placing Order..." : "Place Order (COD)"}
            </button>
            {!canPlaceOrder && (
              <p className="text-xs text-red-600">
                Select a saved address or enter a valid new address.
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

// Disable SSR for this page to avoid hydration issues around auth gating
export default dynamic(() => Promise.resolve(CheckoutPage), { ssr: false });
