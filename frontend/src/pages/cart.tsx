import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import {
  updateCartQty,
  removeFromCart,
  fetchCart,
} from "../store/slices/cartSlice";
import { applyCoupon, removeCoupon } from "../store/slices/cartSlice";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currency } from "../utils/format";
import { getImageUrl } from "../utils/images";
import { TrashIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";

export default function CartPage() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items,
    subtotal,
    discount,
    discountedSubtotal,
    appliedCoupon,
    couponError,
  } = useSelector((s: RootState) => s.cart);

  const [code, setCode] = useState("");

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  if (!items || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-12 max-w-xl mx-auto flex flex-col items-center">
          <img
            src="/empty-cart.svg"
            alt="Empty cart"
            className="w-40 mx-auto mb-8 opacity-90"
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
            }
          />
          <h2 className="text-3xl font-black uppercase tracking-widest text-foreground mb-4">
            Your cart is empty
          </h2>
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-8">
            Add products to review pricing, delivery, and checkout.
          </p>
          <Link
            href="/products"
            className="px-8 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 block max-w-xs mx-auto text-center"
          >
            Shop products
          </Link>
        </div>
      </div>
    );
  }

  // Using same 5% tax logic as before, but on discounted subtotal
  const tax = Math.round(discountedSubtotal * 0.05);
  const total = discountedSubtotal + tax;

  const onDecrease = async (id: string, qty: number) => {
    if (qty <= 1) return;
    await dispatch(updateCartQty({ itemId: id, qty: qty - 1 }));
    await dispatch(fetchCart());
  };

  const onIncrease = async (id: string, qty: number) => {
    await dispatch(updateCartQty({ itemId: id, qty: qty + 1 }));
    await dispatch(fetchCart());
  };

  const onRemove = async (id: string) => {
    await dispatch(removeFromCart(id));
    await dispatch(fetchCart());
  };

  const onApply = async () => {
    if (!code.trim()) return;
    const action = await dispatch(applyCoupon(code.trim().toUpperCase()));
    if (applyCoupon.fulfilled.match(action)) {
      toast.success("Discount applied");
      setCode("");
      dispatch(fetchCart());
    } else {
      toast.error((action.payload as any) || "Enter a valid code");
    }
  };

  const onRemoveCoupon = async () => {
    await dispatch(removeCoupon());
    toast.success("Discount removed");
    dispatch(fetchCart());
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
      {/* Cart Items */}
      <div className="md:col-span-2 space-y-4">
        {items.map((i) => (
          <div key={i._id} className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-4 group">
            <div className="grid grid-cols-[72px,1fr] sm:grid-cols-[112px,1fr,auto] gap-4 items-start sm:items-center">
              <img
                src={getImageUrl(i.product.images?.[0])}
                alt={i.product.title}
                className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-none border-[3px] border-border shadow-[2px_2px_0px_#111]"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
                }
              />

              <div className="min-w-0 pr-2">
                <h3 className="font-black uppercase tracking-widest text-foreground text-lg truncate group-hover:underline underline-offset-4 decoration-[3px]">
                  {i.product.title}
                </h3>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm mt-1">
                  {currency(i.priceAtAdd ?? i.product.price)} each
                </p>

                {/* Quantity controls */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() => onDecrease(i._id, i.qty)}
                    className="w-10 h-10 flex items-center justify-center rounded-none border-[3px] border-border bg-card shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all focus:outline-none"
                  >
                    <span className="font-black text-foreground">-</span>
                  </button>
                  <span className="w-10 text-center text-foreground font-black text-lg">{i.qty}</span>
                  <button
                    aria-label="Increase quantity"
                    onClick={() => onIncrease(i._id, i.qty)}
                    className="w-10 h-10 flex items-center justify-center rounded-none border-[3px] border-border bg-card shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all focus:outline-none"
                  >
                    <span className="font-black text-foreground">+</span>
                  </button>
                </div>
              </div>

              {/* Price + Remove */}
              <div className="flex sm:block items-center justify-between gap-3 sm:gap-2 mt-4 sm:mt-0 sm:self-start sm:text-right">
                <p className="font-black text-2xl text-foreground">
                  {currency((i.priceAtAdd ?? i.product.price) * i.qty)}
                </p>
                <button
                  aria-label="Remove item"
                  onClick={() => onRemove(i._id)}
                  className="mt-2 text-rose-600 hover:text-rose-500 hover:underline underline-offset-4 decoration-2 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-widest"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Remove item</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <aside className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 h-fit md:sticky md:top-24 space-y-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-foreground border-b-[3px] border-border pb-4">Order Summary</h2>

        {/* Coupon UI */}
        <div className="space-y-2">
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-emerald-300 border-[3px] border-emerald-950 text-emerald-950 px-3 py-2 font-black uppercase tracking-widest shadow-[4px_4px_0px_#111]">
              <span>Code: {appliedCoupon.code}</span>
              <button onClick={onRemoveCoupon} className="text-xs hover:underline decoration-2 underline-offset-2">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter discount code"
                className="flex-1 bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[2px_2px_0px_#111] focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all uppercase placeholder:text-muted-foreground/50"
              />
              <button
                onClick={onApply}
                className="px-4 py-2 border-[3px] border-foreground bg-foreground text-background font-black uppercase tracking-widest shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              >
                Apply
              </button>
            </div>
          )}
          {couponError && (
            <p className="text-sm font-bold text-rose-600 mt-2">{couponError}</p>
          )}
        </div>

        <div className="space-y-3 pb-4 border-b-[3px] border-border font-bold uppercase tracking-widest text-sm">
          <p className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{currency(subtotal)}</span>
          </p>
          {discount > 0 && (
            <p className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span>-{currency(discount)}</span>
            </p>
          )}
          <p className="flex justify-between text-muted-foreground">
            <span>Estimated tax</span>
            <span className="text-foreground">{currency(tax)}</span>
          </p>
        </div>
        
        <p className="flex justify-between font-black uppercase tracking-widest text-2xl text-foreground">
          <span>Total</span>
          <span>{currency(total)}</span>
        </p>

        <Link
          href="/checkout"
          className="w-full text-center px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 block mt-4"
        >
          Continue to checkout
        </Link>
      </aside>
    </div>
  );
}
