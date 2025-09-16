import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  CubeIcon,
  ShoppingCartIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/useAuth";
import { hasSellerPerm } from "../../utils/permissions";

type NavItem = { href: string; label: string; icon: any; perm?: string };

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const catalog: NavItem[] = [
    { href: "/seller", label: "Dashboard", icon: HomeIcon },
    {
      href: "/seller/analytics",
      label: "Analytics",
      icon: ChartBarIcon,
      perm: "seller:analytics:read",
    },
    {
      href: "/seller/orders",
      label: "Orders",
      icon: ShoppingCartIcon,
      perm: "seller:orders:read",
    },
    {
      href: "/seller/products",
      label: "Products",
      icon: CubeIcon,
      perm: "seller:products:read",
    },
  ];

  const nav = useMemo(
    () => catalog.filter((n) => !n.perm || hasSellerPerm(user as any, n.perm!)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const isActive = (href: string) =>
    router.pathname === href ||
    (href !== "/seller" && router.pathname.startsWith(href));

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="space-y-1">
      {nav.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 overflow-x-hidden">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Seller</h2>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open seller menu"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
        >
          <Bars3Icon className="w-5 h-5 text-gray-700" />
          <span className="hidden sm:inline text-sm text-gray-700">Menu</span>
        </button>
      </div>

      {/* Content */}
      <section className="space-y-6 min-w-0">{children}</section>

      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 transition-opacity" />
          <div
            ref={panelRef}
            className="absolute left-0 top-0 bottom-0 w-80 max-w-[85%] bg-white border-r border-gray-200 p-4 overflow-y-auto shadow-xl transform transition-transform duration-200 ease-out translate-x-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Seller Menu
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close seller menu"
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
