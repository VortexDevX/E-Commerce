import Link from "next/link";
import { useEffect } from "react";
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

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const { list, loading } = useSelector((s: RootState) => s.products);

  useEffect(() => {
    dispatch(fetchProducts({ limit: 8 }));
  }, [dispatch]);

  return (
    <div className="space-y-16">
      {/* Hero (light, soft gradient) */}
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
              href="/products"
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

      {/* Continue browsing (recently viewed) */}
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

      {/* Promo banner */}
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

      {/* Why Choose Luxora */}
      <section className="border-t border-gray-200 py-16">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8 text-center">
          {[
            {
              icon: ShieldCheckIcon,
              title: "Secure Payments",
              desc: "Your data stays private with bank-level security.",
            },
            {
              icon: TruckIcon,
              title: "Fast Shipping",
              desc: "Get your orders at lightning speed, always.",
            },
            {
              icon: SparklesIcon,
              title: "Premium Quality",
              desc: "Every product handpicked & quality-checked.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-8 rounded-2xl border border-gray-200 bg-white hover:shadow-md transition"
            >
              <f.icon className="w-12 h-12 mx-auto mb-4 text-purple-600" />
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                {f.title}
              </h3>
              <p className="text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
