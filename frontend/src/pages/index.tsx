import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { fetchProducts } from "../store/slices/productSlice";
import ProductCard from "../components/products/ProductCard";
import ProductCardSkeleton from "../components/products/ProductCardSkeleton";
import RecentlyViewed from "../components/products/RecentlyViewed";
import {
  SparklesIcon,
  TruckIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import api from "../utils/api";
import BannerHero from "../components/BannerHero";

type Banner = {
  _id: string;
  title?: string;
  altText?: string;
  imageUrl: string;
  linkUrl?: string;
  placement: "home_hero" | "category_header";
  layout?: "image_full" | "split_asym";
  imagePosition?: "left" | "right";
  imageFit?: "contain" | "cover";
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
};

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const { list, loading } = useSelector((s: RootState) => s.products);

  const [banner, setBanner] = useState<Banner | null>(null);
  const impressionSent = useRef(false);

  useEffect(() => {
    dispatch(fetchProducts({ limit: 8 }));
  }, [dispatch]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("banners/active", {
          params: { placement: "home_hero" },
        });
        setBanner(data?.banner || null);
      } catch {
        setBanner(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!banner || impressionSent.current) return;
    impressionSent.current = true;
    api.post(`banners/${banner._id}/impression`).catch(() => {});
  }, [banner]);

  return (
    <div className="space-y-16">
      {/* Original Hero (kept) */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 via-white to-blue-50 border border-gray-200">
        <img
          src="/pattern.svg"
          alt=""
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="max-w-6xl mx-auto px-6 py-20 text-center relative z-10">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-purple-700 bg-purple-100/60 px-3 py-1 rounded-full mb-5">
            ✨ New season picks are here
          </p>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tight text-gray-900">
            Discover premium products at{" "}
            <span className="text-purple-700">Luxora</span>
          </h1>
          <p className="text-lg md:text-xl mb-8 text-gray-600">
            Curated collections. Trusted quality. Fast delivery.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/products"
              className="bg-purple-600 text-white px-7 py-3 rounded-full font-semibold shadow hover:bg-purple-500 transition"
            >
              Shop Now
            </Link>
            <Link
              href="/products"
              className="px-7 py-3 rounded-full font-semibold border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition"
            >
              View Deals
            </Link>
          </div>

          <div className="mt-10 grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { icon: ShieldCheckIcon, label: "Secure Checkout" },
              { icon: TruckIcon, label: "Fast, Free Shipping" },
              { icon: SparklesIcon, label: "Handpicked Quality" },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 px-4"
              >
                <b.icon className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin-Managed Banner (brand-safe) */}
      {banner ? <BannerHero banner={banner as any} /> : null}

      {/* Featured Categories */}
      <section className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Shop by Category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: "Fashion", emoji: "🧥" },
            { name: "Electronics", emoji: "📱" },
            { name: "Home", emoji: "🏠" },
            { name: "Beauty", emoji: "💄" },
          ].map((c) => (
            <Link
              key={c.name}
              href={{ pathname: "/products", query: { search: c.name } }}
              className="group rounded-2xl border border-gray-200 bg-white p-6 text-center font-semibold hover:shadow-md hover:-translate-y-0.5 transition"
            >
              <div className="text-2xl mb-2">{c.emoji}</div>
              <div className="text-gray-900">{c.name}</div>
              <div className="text-sm text-gray-500 mt-1 group-hover:text-purple-600">
                Explore →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Continue browsing */}
      <section className="max-w-6xl mx-auto px-6">
        <RecentlyViewed title="Continue browsing" />
      </section>

      {/* Featured Products */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Featured Products
          </h2>
          <Link
            href="/products"
            className="text-purple-700 font-medium hover:underline"
          >
            See all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {list.map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </div>
        )}
      </section>

      {/* Promo banner (kept) */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              Up to 40% off on select electronics
            </h3>
            <p className="text-gray-600 mt-1">
              Limited time. While stocks last.
            </p>
          </div>
          <Link
            href="/products"
            className="px-6 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
          >
            Grab the deal
          </Link>
        </div>
      </section>
    </div>
  );
}
