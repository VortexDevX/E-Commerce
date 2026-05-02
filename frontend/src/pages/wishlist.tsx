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
      toast.success("Share link is ready");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "We could not create a share link");
    }
  };

  const disableShare = async () => {
    try {
      const { data } = await api.post("/wishlist/share/disable");
      setShareEnabled(!!data?.enabled);
      setShareId(null); // id cleared on disable
      toast.success("Share link turned off");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "We could not turn off sharing");
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("We could not copy the link");
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
          ? "Price alerts turned on"
          : "Price alerts turned off"
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "We could not update your alerts");
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-12 max-w-xl mx-auto flex flex-col items-center">
          <HeartIcon className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <h2 className="text-3xl font-black uppercase tracking-widest text-foreground mb-4">
            Your wishlist is empty
          </h2>
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-8">
            Save items here so you can compare them and buy when you are ready.
          </p>
          <Link
            href="/products"
            className="px-8 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 block max-w-xs mx-auto text-center"
          >
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8 border-b-[3px] border-border pb-6">
        <h1 className="text-4xl font-black uppercase tracking-widest text-foreground">Saved items</h1>
        {/* Price drop alerts toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Price alerts</span>
          {alertsLoading ? (
            <div className="h-5 w-10 bg-gray-100 border border-gray-200 rounded-full animate-pulse" />
          ) : (
            <button
              onClick={toggleAlerts}
              className={`inline-flex w-10 h-5 rounded-full transition ${
                alertsEnabled ? "bg-emerald-500" : "bg-gray-300"
              }`}
              aria-pressed={alertsEnabled}
              title={alertsEnabled ? "Turn off alerts" : "Turn on alerts"}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transform transition ${
                  alertsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {statusLoading ? (
            <div className="h-10 w-[320px] bg-card border-[3px] border-border animate-pulse" />
          ) : !shareEnabled ? (
            <button
              onClick={enableShare}
              className="px-4 py-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 text-xs"
            >
              Share wishlist
            </button>
          ) : (
            <>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="w-[260px] sm:w-[340px] bg-card border-[3px] border-border rounded-none px-3 py-2 text-foreground font-bold shadow-[4px_4px_0px_#111] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40 text-xs"
                />
                <button
                  onClick={copyLink}
                  className="px-3 py-2 border-[3px] border-border bg-card shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all"
                  title="Copy link"
                >
                  <LinkIcon className="w-4 h-4 text-foreground" />
                </button>
              </div>
              <button
                onClick={disableShare}
                className="px-4 py-2 border-[3px] border-border bg-card text-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all text-xs"
              >
                Turn off
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((p) => (
          <div key={p._id} className="relative group bg-card border-[3px] border-border shadow-[8px_8px_0px_#111]">
            <ProductCard p={p} />
            <div className="absolute top-2 right-2">
              <button
                onClick={() => dispatch(removeFromWishlist(p._id))}
                className="border-[3px] border-rose-600 bg-rose-50 text-rose-600 p-2 shadow-[2px_2px_0px_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all z-10"
                title="Remove from saved items"
              >
                <HeartIcon className="w-5 h-5 fill-rose-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
