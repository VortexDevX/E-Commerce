import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../store";
import { jwtDecode } from "jwt-decode";
import type { User } from "../../store/slices/authSlice";
import { logoutAsync } from "../../store/slices/authSlice";

import {
  HomeIcon,
  CubeIcon,
  PhotoIcon,
  Bars3Icon,
  XMarkIcon,
  ChartBarIcon,
  ShoppingCartIcon,
  TagIcon,
  UsersIcon,
  TicketIcon,
  EnvelopeIcon,
  ClipboardDocumentListIcon as ClipboardCheckIcon,
  DocumentMagnifyingGlassIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const user = useSelector((s: RootState) => s.auth.user) as User | null;

  // Decode JWT to check MFA flag
  let needsMFA = false;
  if (
    user?.accessToken &&
    (user.role === "admin" || user.role === "subadmin")
  ) {
    try {
      const decoded: any = jwtDecode(user.accessToken);
      needsMFA = !decoded?.mfa;
    } catch {}
  }

  // Catalog nav
  const catalog = [
    { href: "/admin", label: "Dashboard", icon: HomeIcon },
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: ChartBarIcon,
      perm: "analytics:read",
    },
    {
      href: "/admin/orders",
      label: "Orders",
      icon: ShoppingCartIcon,
      perm: "orders:read",
    },
    {
      href: "/admin/products",
      label: "Products",
      icon: CubeIcon,
      perm: "products:read",
    },
    {
      href: "/admin/returns",
      label: "Returns",
      icon: CurrencyDollarIcon,
      perm: "returns:read",
    },
    {
      href: "/admin/categories",
      label: "Categories",
      icon: TagIcon,
      perm: "products:read",
    },
    {
      href: "/admin/users",
      label: "Users",
      icon: UsersIcon,
      perm: "users:read",
    },
    {
      href: "/admin/seller-requests",
      label: "Seller Requests",
      icon: ClipboardCheckIcon,
      perm: "sellers:read",
    },
    {
      href: "/admin/coupons",
      label: "Coupons",
      icon: TicketIcon,
      perm: "coupons:read",
    },
    {
      href: "/admin/emails",
      label: "Email Templates",
      icon: EnvelopeIcon,
      perm: "emailTemplates:read",
    },
    {
      href: "/admin/media",
      label: "Media",
      icon: PhotoIcon,
      perm: "media:read",
    },
    {
      href: "/admin/logs",
      label: "Logs",
      icon: DocumentMagnifyingGlassIcon,
      perm: "logs:read",
    },
  ];

  const nav = useMemo(() => {
    if (user?.role === "admin") return catalog;
    if (user?.role === "subadmin") {
      const set = new Set(user?.permissions || []);
      return catalog.filter((n) => !n.perm || set.has(n.perm));
    }
    return catalog.filter((n) => !n.perm);
  }, [user]);

  const isActive = (href: string) => {
    if (href === "/admin") return router.pathname === "/admin";
    return router.pathname.startsWith(href);
  };

  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="space-y-1">
      {nav.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onItemClick}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition
              ${
                active
                  ? "bg-purple-50 border-purple-300 text-purple-800"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
          >
            <n.icon
              className={`w-5 h-5 ${
                active ? "text-purple-600" : "text-gray-500"
              }`}
            />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  // Force overlay if MFA required and not satisfied
  const forceLogout = async () => {
    await dispatch<any>(logoutAsync());
    router.replace("/auth/login?next=/admin");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Admin</h2>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
        >
          <Bars3Icon className="w-5 h-5 text-gray-700" />
          <span className="hidden sm:inline text-sm text-gray-700">Menu</span>
        </button>
      </div>

      {/* MFA ENFORCEMENT OVERLAY */}
      {needsMFA && (user?.role === "admin" || user?.role === "subadmin") && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center space-y-4">
            <h2 className="text-xl font-bold text-red-600">
              Two‑Factor Authentication Required
            </h2>
            <p className="text-gray-700">
              You must complete 2FA before accessing the Admin area. Please log
              out and sign in again to complete verification.
            </p>
            <button
              onClick={forceLogout}
              className="w-full py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-500 font-medium"
            >
              Logout & Re‑Login
            </button>
          </div>
        </div>
      )}

      <section className="space-y-6">{children}</section>

      {/* Drawer stays unchanged */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 transition-opacity" />
          <div
            ref={panelRef}
            className="absolute left-0 top-0 bottom-0 w-80 max-w-[85%] bg-white border-r border-gray-200 p-4 overflow-y-auto shadow-xl
                       transform transition-transform duration-200 ease-out translate-x-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Admin Menu
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <XMarkIcon className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            <NavList onItemClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
