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
        <img
          src="/empty-cart.svg"
          alt="Empty cart"
          className="w-40 mx-auto mb-6 opacity-80"
          onError={(e) =>
            ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
          }
        />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Your cart is empty
        </h2>
        <p className="text-gray-600 mb-6">Add items to get started.</p>
        <Link href="/products" className="btn btn-primary">
          Continue Shopping
        </Link>
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
      toast.success("Coupon applied");
      setCode("");
      dispatch(fetchCart());
    } else {
      toast.error((action.payload as any) || "Invalid coupon");
    }
  };

  const onRemoveCoupon = async () => {
    await dispatch(removeCoupon());
    toast.success("Coupon removed");
    dispatch(fetchCart());
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
      {/* Cart Items */}
      <div className="md:col-span-2 space-y-4">
        {items.map((i) => (
          <div key={i._id} className="card p-4">
            <div className="grid grid-cols-[72px,1fr] sm:grid-cols-[96px,1fr,auto] gap-3 sm:gap-4 items-start sm:items-center">
              <img
                src={getImageUrl(i.product.images?.[0])}
                alt={i.product.title}
                className="w-18 h-18 sm:w-24 sm:h-24 object-cover rounded-lg border border-gray-200"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
                }
              />

              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {i.product.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {currency(i.priceAtAdd ?? i.product.price)} each
                </p>

                {/* Quantity controls */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() => onDecrease(i._id, i.qty)}
                    className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="px-3 text-gray-900">{i.qty}</span>
                  <button
                    aria-label="Increase quantity"
                    onClick={() => onIncrease(i._id, i.qty)}
                    className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price + Remove */}
              <div className="flex sm:block items-center justify-between gap-3 sm:gap-2 mt-2 sm:mt-0">
                <p className="font-bold text-gray-900">
                  {currency((i.priceAtAdd ?? i.product.price) * i.qty)}
                </p>
                <button
                  aria-label="Remove item"
                  onClick={() => onRemove(i._id)}
                  className="text-rose-600 hover:text-rose-500 inline-flex items-center gap-1 text-sm"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <aside className="card p-6 h-fit md:sticky md:top-24 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>

        {/* Coupon UI */}
        <div className="space-y-2">
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 text-purple-800 rounded px-3 py-2">
              <span className="font-medium">Coupon: {appliedCoupon.code}</span>
              <button onClick={onRemoveCoupon} className="text-sm underline">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Promo code"
                className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900"
              />
              <button
                onClick={onApply}
                className="px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800"
              >
                Apply
              </button>
            </div>
          )}
          {couponError && (
            <p className="text-sm text-rose-600">{couponError}</p>
          )}
        </div>

        <p className="flex justify-between text-gray-700">
          <span>Subtotal</span>
          <span>{currency(subtotal)}</span>
        </p>
        {discount > 0 && (
          <p className="flex justify-between text-gray-700">
            <span>Discount</span>
            <span>-{currency(discount)}</span>
          </p>
        )}
        <p className="flex justify-between text-gray-700">
          <span>Estimated Tax</span>
          <span>{currency(tax)}</span>
        </p>
        <hr className="border-gray-200" />
        <p className="flex justify-between font-semibold text-lg text-gray-900">
          <span>Total</span>
          <span>{currency(total)}</span>
        </p>

        <Link
          href="/checkout"
          className="w-full inline-block text-center btn btn-primary"
        >
          Proceed to Checkout
        </Link>
      </aside>
    </div>
  );
}
