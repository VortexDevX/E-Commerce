import type { AppProps } from "next/app";
import { Provider, useDispatch, useSelector } from "react-redux";
import store, { AppDispatch, RootState } from "../store";
import { useEffect, useRef, useState } from "react";
import "../styles/globals.css";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import api from "../utils/api";
import {
  setAccessToken,
  logout,
  loginSuccess,
  fetchMe,
} from "../store/slices/authSlice";
import { fetchCart } from "../store/slices/cartSlice";
import { fetchWishlist } from "../store/slices/wishlistSlice";
import Router from "next/router";
import NProgress from "nprogress";
import GlobalRouteGuard from "../components/layout/GlobalRouteGuard";

// Client-only wrapper (prevents SSR mismatch)
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

function RouteProgress() {
  useEffect(() => {
    NProgress.configure({
      showSpinner: false,
      trickleSpeed: 120,
      minimum: 0.08,
    });
    const start = () => NProgress.start();
    const done = () => NProgress.done();

    Router.events.on("routeChangeStart", start);
    Router.events.on("routeChangeComplete", done);
    Router.events.on("routeChangeError", done);
    return () => {
      Router.events.off("routeChangeStart", start);
      Router.events.off("routeChangeComplete", done);
      Router.events.off("routeChangeError", done);
    };
  }, []);
  return null;
}

function InitAuth() {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        dispatch(loginSuccess(JSON.parse(stored)));
      } catch {
        localStorage.removeItem("user");
      }
    }
  }, [dispatch]);
  return null;
}

function InitHydrateOnce() {
  const dispatch = useDispatch<AppDispatch>();
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    dispatch(fetchMe());
  }, [dispatch]);
  return null;
}

function decodeExp(token?: string): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function InitAutoRefresh() {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((s: RootState) => s.auth.user?.accessToken);

  useEffect(() => {
    if (!token) return;
    const exp = decodeExp(token);
    if (!exp) return;
    const msToExp = exp * 1000 - Date.now();
    const msToRefresh = Math.max(5_000, msToExp - 60_000);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/auth/refresh");
        dispatch(setAccessToken(data.accessToken));
      } catch {
        dispatch(logout());
        if (typeof window !== "undefined") window.location.href = "/auth/login";
      }
    }, msToRefresh);
    return () => clearTimeout(t);
  }, [token, dispatch]);

  return null;
}

function InitCart() {
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((s: RootState) => s.auth.user?._id);
  useEffect(() => {
    if (userId) dispatch(fetchCart());
  }, [userId, dispatch]);
  return null;
}

function InitWishlist() {
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((s: RootState) => s.auth.user?._id);
  useEffect(() => {
    if (userId) dispatch(fetchWishlist());
  }, [userId, dispatch]);
  return null;
}

// PWA: register SW and show install prompt
function PWARegister() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        // In dev, ensure no SW is controlling the page (prevents HMR loops)
        navigator.serviceWorker
          .getRegistrations?.()
          .then((regs) => regs.forEach((r) => r.unregister()))
          .catch(() => {});
      }
    }

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallEvent(e);
      setShowPrompt(true);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowPrompt(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!installEvent) return;
    try {
      installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="rounded-lg shadow-lg border border-gray-200 bg-white text-gray-900 p-3 flex items-center gap-3">
        <img
          src="/ecommerce-favicon.ico"
          alt="App icon"
          className="w-6 h-6 rounded"
          onError={(e) =>
            ((e.currentTarget as HTMLImageElement).style.display = "none")
          }
        />
        <div className="text-sm">
          <div className="font-medium">Install Luxora</div>
          <div className="text-gray-600">Add to your home screen</div>
        </div>
        <button
          onClick={triggerInstall}
          className="ml-2 px-3 py-1.5 rounded-md bg-purple-600 text-white text-sm hover:bg-purple-500"
        >
          Install
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="ml-1 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Provider store={store}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <ClientOnly>
            <RouteProgress />
          </ClientOnly>
          <InitAuth />
          <InitHydrateOnce />
          <InitAutoRefresh />
          <InitCart />
          <InitWishlist />

          <ClientOnly>
            <Header />
          </ClientOnly>

          <main className="flex-1">
            <GlobalRouteGuard>
              <Component {...pageProps} />
            </GlobalRouteGuard>
            <ClientOnly>
              <Toaster position="top-right" toastOptions={{ duration: 2000 }} />
            </ClientOnly>
          </main>

          <ClientOnly>
            <Footer />
          </ClientOnly>

          {/* PWA registration + install prompt */}
          <ClientOnly>
            <PWARegister />
          </ClientOnly>
        </div>
      </ThemeProvider>
    </Provider>
  );
}
