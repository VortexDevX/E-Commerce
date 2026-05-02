import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
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
  const addresses = useMemo(
    () => ((user?.addresses as Address[] | undefined) || []),
    [user?.addresses]
  );

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
  const [addressError, setAddressError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");

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
    setAddressError("");
    if (!canPlaceOrder) {
      setAddressError("Select a saved address or add a complete shipping address.");
      toast.error("Select a saved address or add a complete shipping address.");
      return;
    }
    if (!acceptedPolicies) {
      setLiveMessage("Accept the terms and privacy policy to place your order.");
      toast.error("Accept the terms and privacy policy to place your order.");
      return;
    }

    setPlacing(true);
    const t = toast.loading("Sending your order...");

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
      setLiveMessage("Your order was placed.");

      toast.success("Order placed", { id: t });
      router.push("/orders");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "We could not place your order.";
      setLiveMessage("We could not place your order.");
      toast.error(message, {
        id: t,
      });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8">
      <div className="md:col-span-3 mb-2">
        <ol className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {["Address", "Delivery", "Review", "Pay"].map((step, idx) => (
            <li
              key={step}
              className={`px-3 py-2 rounded-md border text-center font-semibold ${
                idx <= 1
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground"
              }`}
            >
              {idx + 1}. {step}
            </li>
          ))}
        </ol>
      </div>
      {/* Left: Address + Shipping */}
      <div className="md:col-span-2 space-y-8">
        {/* Address selection */}
        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-6">
          <h2 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4">
            Shipping Address
          </h2>

          {/* Mode toggle */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setMode("existing")}
              className={`px-6 py-3 border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all text-xs flex-1 ${
                mode === "existing"
                  ? "bg-foreground text-background"
                  : "bg-card text-foreground"
              }`}
              disabled={addresses.length === 0}
              title={
                addresses.length === 0
                  ? "No saved addresses. Add one below."
                  : ""
              }
            >
              Use saved address
            </button>
            <button
              onClick={() => setMode("new")}
              className={`px-6 py-3 border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all text-xs flex-1 ${
                mode === "new"
                  ? "bg-foreground text-background"
                  : "bg-card text-foreground"
              }`}
            >
              Add new address
            </button>
          </div>

          {/* Existing addresses */}
          {mode === "existing" && addresses.length > 0 && (
            <div className="space-y-4">
              {addresses.map((a) => (
                <label
                  key={a._id}
                  className={`flex flex-col sm:flex-row items-start gap-3 p-4 border-[3px] border-border cursor-pointer transition-all hover:-translate-y-1 shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] ${
                    selectedAddressId === a._id
                      ? "bg-primary/10 shadow-[4px_4px_0px_#111]"
                      : "bg-card"
                  }`}
                >
                  <input
                    type="radio"
                    name="addr"
                    className="mt-1 w-5 h-5 border-[3px] border-border text-primary focus:ring-primary focus:ring-offset-0 shrink-0"
                    checked={selectedAddressId === a._id}
                    onChange={() => setSelectedAddressId(a._id)}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black uppercase tracking-widest text-foreground text-lg">
                        {a.label || "Saved address"}
                      </p>
                      {a.isDefault && (
                        <span className="text-[10px] bg-emerald-300 border-[3px] border-emerald-950 font-black uppercase tracking-widest text-emerald-950 px-2 py-0.5 shadow-[2px_2px_0px_#111]">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
                      {[a.line1, a.line2, a.city, a.state, a.zip, a.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {a.phone && (
                      <p className="text-foreground font-bold uppercase tracking-widest text-xs mt-1">📞 {a.phone}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* New address form */}
          {mode === "new" && (
            <div className="grid md:grid-cols-2 gap-4 mt-2">
              <input
                placeholder="Address label"
                className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
                value={newAddr.label || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, label: e.target.value })
                }
              />
              <input
                placeholder="Phone number"
                className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
                value={newAddr.phone || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, phone: e.target.value })
                }
              />
              <input
                placeholder="Street address"
                className="md:col-span-2 w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
                value={newAddr.line1 || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, line1: e.target.value })
                }
              />
              <input
                placeholder="Apartment, suite, or landmark"
                className="md:col-span-2 w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
                value={newAddr.line2 || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, line2: e.target.value })
                }
              />
              <input
                placeholder="City"
                className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
                value={newAddr.city || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, city: e.target.value })
                }
              />
              <input
                placeholder="State"
                className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
                value={newAddr.state || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, state: e.target.value })
                }
              />
              <input
                placeholder="Postal code"
                className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
                value={newAddr.zip || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, zip: e.target.value })
                }
              />
              <input
                placeholder="Country"
                className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
                value={newAddr.country || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, country: e.target.value })
                }
              />
              <label className="inline-flex items-center gap-2 text-sm md:col-span-2 font-bold uppercase tracking-widest text-foreground mt-2">
                <input
                  type="checkbox"
                  className="w-5 h-5 border-[3px] border-border text-primary rounded-none focus:ring-primary focus:ring-offset-0 shrink-0"
                  checked={saveToProfile}
                  onChange={(e) => setSaveToProfile(e.target.checked)}
                />
                Save this address as{" "}
                <span className="font-black text-primary bg-primary/10 px-2 py-0.5 border-[3px] border-primary">
                  {newAddr.label || "Home"}
                </span>
              </label>
            </div>
          )}
          {addressError && (
            <p className="text-sm text-rose-600 font-semibold">{addressError}</p>
          )}
        </section>

        {/* Shipping method */}
        <section className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 space-y-6">
          <h2 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4">
            Shipping Method
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => setShipping("standard")}
              className={`p-4 border-[3px] border-border text-left transition-all hover:-translate-y-1 shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] ${
                shipping === "standard"
                  ? "bg-primary/10 shadow-[4px_4px_0px_#111]"
                  : "bg-card"
              }`}
            >
              <p className="font-black uppercase tracking-widest text-foreground text-lg mb-1">Standard delivery</p>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">Arrives in 4 to 7 days · Free</p>
            </button>
            <button
              onClick={() => setShipping("express")}
              className={`p-4 border-[3px] border-border text-left transition-all hover:-translate-y-1 shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] ${
                shipping === "express"
                  ? "bg-primary/10 shadow-[4px_4px_0px_#111]"
                  : "bg-card"
              }`}
            >
              <p className="font-black uppercase tracking-widest text-foreground text-lg mb-1">Express delivery</p>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">Arrives in 1 to 2 days · ₹99</p>
            </button>
          </div>
        </section>
      </div>

      {/* Right: Order Summary */}
      <aside className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 h-fit md:sticky md:top-24 space-y-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4">Order Summary</h2>

        {items.length === 0 ? (
          <div className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
            Your cart is empty.{" "}
            <Link href="/products" className="text-primary hover:underline decoration-2 underline-offset-4">
              Shop products
            </Link>
          </div>
        ) : (
          <>
            <div className="max-h-60 overflow-auto pr-2 space-y-4">
              {items.map((i) => (
                <div key={i._id} className="flex items-center gap-4">
                  <div className="relative w-16 h-16 shrink-0 border-[3px] border-border shadow-[2px_2px_0px_#111] overflow-hidden">
                    <Image
                      src={getImageUrl(i.product.images?.[0])}
                      alt={i.product.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black uppercase text-foreground truncate">{i.product.title}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Qty: {i.qty}</p>
                  </div>
                  <div className="text-sm font-black text-foreground">
                    {currency((i.priceAtAdd ?? i.product.price) * i.qty)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-6 border-t-[3px] border-border font-bold uppercase tracking-widest text-sm">
               <p className="flex justify-between text-muted-foreground">
                 <span>Subtotal</span>
                 <span>{currency(rawSubtotal)}</span>
               </p>
               <p className="flex justify-between text-muted-foreground">
                 <span>Delivery</span>
                 <span>
                   {shippingCost === 0 ? "Free" : currency(shippingCost)}
                 </span>
               </p>
               {appliedCoupon && cartDiscount > 0 && (
                 <p className="flex justify-between text-emerald-600">
                   <span>Discount ({appliedCoupon.code})</span>
                   <span>-{currency(cartDiscount)}</span>
                 </p>
               )}
               <p className="flex justify-between text-muted-foreground">
                 <span>Tax (5%)</span>
                 <span>{currency(tax)}</span>
               </p>
             </div>
             
             <p className="flex justify-between font-black uppercase tracking-widest text-2xl text-foreground pt-4 border-t-[3px] border-border">
               <span>Total</span>
               <span>{currency(grandTotal)}</span>
             </p>

            {/* Explicit legal acceptance */}
            <div className="flex items-start gap-3 bg-muted p-4 border-[3px] border-border mt-6">
              <input
                id="accept-policies"
                type="checkbox"
                className="mt-0.5 w-5 h-5 border-[3px] border-border text-primary focus:ring-primary focus:ring-offset-0 shrink-0"
                checked={acceptedPolicies}
                onChange={(e) => setAcceptedPolicies(e.target.checked)}
              />
              <label
                htmlFor="accept-policies"
                className="text-xs font-bold uppercase tracking-widest text-foreground leading-relaxed"
              >
                I agree to the{" "}
                <Link
                  href="/policies/terms"
                  className="underline decoration-2 underline-offset-4 hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/policies/privacy"
                  className="underline decoration-2 underline-offset-4 hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <div className="pt-2">
              <div className="mb-3 grid grid-cols-1 gap-2 text-xs text-gray-600">
                <p className="rounded-md border border-gray-200 px-3 py-2 bg-gray-50">
                  Buyer protection included
                </p>
                <p className="rounded-md border border-gray-200 px-3 py-2 bg-gray-50">
                  Easy returns on eligible items
                </p>
                <p className="rounded-md border border-gray-200 px-3 py-2 bg-gray-50">
                  Secure checkout and protected payment data
                </p>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing || !canPlaceOrder || !acceptedPolicies}
                className="w-full text-center px-6 py-4 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 disabled:opacity-50 text-base"
              >
                {placing ? "Sending order..." : "Place order"}
              </button>
            </div>
            {!canPlaceOrder && (
              <p className="text-xs font-bold uppercase tracking-widest text-rose-600 text-center mt-2">
                Select a saved address or add a complete shipping address.
              </p>
            )}
            <p aria-live="polite" className="sr-only">
              {liveMessage}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

// Disable SSR for this page to avoid hydration issues around auth gating
export default dynamic(() => Promise.resolve(CheckoutPage), { ssr: false });
