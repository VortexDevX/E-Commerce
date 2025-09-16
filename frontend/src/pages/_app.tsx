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
        </div>
      </ThemeProvider>
    </Provider>
  );
}
