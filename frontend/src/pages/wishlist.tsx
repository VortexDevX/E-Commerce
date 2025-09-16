import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { removeFromWishlist } from "../store/slices/wishlistSlice";
import ProductCard from "../components/products/ProductCard";
import { HeartIcon, LinkIcon } from "@heroicons/react/24/outline";
import api from "../utils/api";
import { toast } from "react-hot-toast";

export default function WishlistPage() {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector((s: RootState) => s.wishlist.items ?? []);
  const userId = useSelector((s: RootState) => s.auth.user?._id);

  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const shareUrl = useMemo(() => {
    if (!shareId) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/wishlist/${shareId}`;
  }, [shareId]);

  // Load share status on mount (after user ready)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setStatusLoading(false);
        return;
      }
      setStatusLoading(true);
      try {
        const { data } = await api.get("/wishlist/share/status");
        if (cancelled) return;
        setShareEnabled(!!data?.enabled);
        setShareId(data?.id || null);
      } catch {
        if (!cancelled) {
          setShareEnabled(false);
          setShareId(null);
        }
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      if (!userId) {
        setAlertsLoading(false);
        return;
      }
      setAlertsLoading(true);
      try {
        const { data } = await api.get("/users/me/alerts/price-drop");
        if (cancelled) return;
        setAlertsEnabled(!!data?.enabled);
      } catch {
        if (!cancelled) setAlertsEnabled(false);
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    }
    loadAlerts();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const enableShare = async () => {
    try {
      const { data } = await api.post("/wishlist/share/enable");
      setShareEnabled(!!data?.enabled);
      setShareId(data?.id || null);
      toast.success("Sharing enabled");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to enable share");
    }
  };

  const disableShare = async () => {
    try {
      const { data } = await api.post("/wishlist/share/disable");
      setShareEnabled(!!data?.enabled);
      setShareId(null); // id cleared on disable
      toast.success("Sharing disabled");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to disable share");
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const toggleAlerts = async () => {
    try {
      const { data } = await api.post("/users/me/alerts/price-drop", {
        enabled: !alertsEnabled,
      });
      setAlertsEnabled(!!data?.enabled);
      toast.success(
        data?.enabled
          ? "Price drop alerts enabled"
          : "Price drop alerts disabled"
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update alerts");
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <HeartIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Your wishlist is empty
        </h2>
        <p className="text-gray-600 mb-6">
          Save products you love to view them later.
        </p>
        <Link href="/products" className="btn btn-primary">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
        {/* Price drop alerts toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Price drop alerts</span>
          {alertsLoading ? (
            <div className="h-5 w-10 bg-gray-100 border border-gray-200 rounded-full animate-pulse" />
          ) : (
            <button
              onClick={toggleAlerts}
              className={`inline-flex w-10 h-5 rounded-full transition ${
                alertsEnabled ? "bg-emerald-500" : "bg-gray-300"
              }`}
              aria-pressed={alertsEnabled}
              title={alertsEnabled ? "Disable alerts" : "Enable alerts"}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transform transition ${
                  alertsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {statusLoading ? (
            <div className="h-10 w-[320px] bg-gray-100 border border-gray-200 rounded animate-pulse" />
          ) : !shareEnabled ? (
            <button
              onClick={enableShare}
              className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
            >
              Enable Share
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="w-[260px] sm:w-[340px] bg-white border border-gray-300 rounded px-3 py-2 text-gray-900"
                />
                <button
                  onClick={copyLink}
                  className="px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  title="Copy share link"
                >
                  <LinkIcon className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={disableShare}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Disable
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((p) => (
          <div key={p._id} className="relative group">
            <ProductCard p={p} />
            <button
              onClick={() => dispatch(removeFromWishlist(p._id))}
              className="absolute top-2 right-2 bg-white/90 rounded-full p-2 text-rose-600 hover:bg-white"
              title="Remove"
            >
              <HeartIcon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
