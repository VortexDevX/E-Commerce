import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SearchBar from "../SearchBar";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { logoutAsync } from "../../store/slices/authSlice";
import {
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

type Role = "user" | "seller" | "admin" | "subadmin" | "seller_assistant";

export default function Header() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const cartItems = useSelector((s: RootState) => s.cart.items ?? []);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => {
      router.events.off("routeChangeComplete", close);
    };
  }, [router.events]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const handleLogout = async () => {
    await dispatch(logoutAsync());
    router.replace("/");
  };

  const canSeeAdmin = (role?: Role) => role === "admin" || role === "subadmin";
  const canSeeSeller = (role?: Role) =>
    role === "seller" || role === "seller_assistant";

  const NavLinks = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <Link
        href="/products"
        className="hover:text-gray-900"
        onClick={onItemClick}
      >
        Products
      </Link>
      <Link
        href="/wishlist"
        className="hover:text-gray-900"
        onClick={onItemClick}
      >
        Wishlist
      </Link>
      <Link
        href="/cart"
        className="relative hover:text-gray-900"
        onClick={onItemClick}
      >
        <span>Cart</span>
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-4 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
            {cartCount}
          </span>
        )}
      </Link>
      {user ? (
        <>
          <Link
            href="/orders"
            className="hover:text-gray-900"
            onClick={onItemClick}
          >
            My Orders
          </Link>
          <Link
            href="/profile"
            className="hover:text-gray-900"
            onClick={onItemClick}
          >
            Profile
          </Link>
          {canSeeSeller(user.role as Role) && (
            <Link
              href="/seller"
              className="hover:text-gray-900"
              onClick={onItemClick}
            >
              Seller
            </Link>
          )}
          {canSeeAdmin(user.role as Role) && (
            <Link
              href="/admin"
              className="hover:text-gray-900"
              onClick={onItemClick}
            >
              Admin
            </Link>
          )}
          <button
            onClick={() => {
              onItemClick?.();
              handleLogout();
            }}
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-left"
          >
            Logout
          </button>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            onClick={onItemClick}
          >
            Login
          </Link>
          <Link
            href="/auth/register"
            className="px-3 py-1.5 rounded-md border border-transparent bg-purple-600 text-white hover:bg-purple-500"
            onClick={onItemClick}
          >
            Register
          </Link>
        </div>
      )}
    </>
  );

  if (!mounted) {
    return (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            <div className="h-8 w-28 rounded-md bg-gray-100 border border-gray-200" />
            <div className="h-8 w-8 rounded-md bg-gray-100 border border-gray-200" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between py-4">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/luxora-4.png"
              alt="Luxora"
              width={120}
              height={40}
              priority
              className="h-10 w-auto"
            />
            <span className="sr-only">Luxora</span>
          </Link>

          {/* Desktop search */}
          <div className="hidden md:flex flex-1 justify-center px-6">
            <SearchBar />
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-gray-700">
            <NavLinks />
          </nav>

          {/* Mobile right actions */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
              aria-label="Open search"
            >
              <MagnifyingGlassIcon className="w-6 h-6" />
            </button>
            <button
              aria-label="Toggle menu"
              className="p-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile search popup */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start pt-20 px-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-4">
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                aria-label="Close search"
              >
                ✖
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 transition-opacity" />
          <div
            ref={panelRef}
            className="absolute right-0 top-0 bottom-0 w-80 max-w-[85%] bg-white border-l border-gray-200 p-5 shadow-xl transform transition-transform duration-200 ease-out translate-x-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2"
              >
                <Image
                  src="/luxora-4.png"
                  alt="Luxora"
                  width={110}
                  height={110}
                  className="h-10 w-auto"
                />
                <span className="sr-only">Luxora</span>
              </Link>
              <button
                aria-label="Close menu"
                className="p-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-3 text-gray-700">
              <NavLinks onItemClick={() => setOpen(false)} />
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
