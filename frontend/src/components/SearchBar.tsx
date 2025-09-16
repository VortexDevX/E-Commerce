import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import api from "../utils/api";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [trending, setTrending] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setShowDropdown(false);
    router.push(`/products?search=${encodeURIComponent(q)}`);
  }

  // 🚀 load trending once on mount
  useEffect(() => {
    async function fetchTrending() {
      try {
        const { data } = await api.get("/search/trending");
        setTrending(data);
      } catch {
        setTrending([]);
      }
    }
    fetchTrending();
  }, []);

  // 🚀 autosuggest whenever user types
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (query.trim().length > 0) {
        setLoading(true);
        try {
          const { data } = await api.get(
            `/search?q=${encodeURIComponent(query)}`
          );
          setResults(data);
        } catch {
          setResults(null);
        } finally {
          setLoading(false);
        }
      } else {
        setResults(null);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(delay);
  }, [query]);

  // dropdown toggle logic
  const handleFocus = () => setShowDropdown(true);
  const handleBlur = () => setTimeout(() => setShowDropdown(false), 200);

  return (
    <div className="relative w-full max-w-lg">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg flex items-center"
      >
        <input
          type="text"
          placeholder="Search products, tags, categories..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          className="absolute right-2 text-gray-500 hover:text-purple-600"
          aria-label="Search"
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
        </button>

        {/* dropdown results/trending like before … */}
      </form>
      {showDropdown && (
        <div className="absolute top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-full max-h-80 overflow-y-auto z-50 text-sm">
          {/* Show loading */}
          {loading && (
            <div className="p-3 text-gray-500 text-center">Searching…</div>
          )}

          {/* 🔎 Results if there is a typed query */}
          {results && !loading && (
            <>
              {results.products?.length > 0 && (
                <div className="p-2">
                  <h4 className="font-semibold text-gray-700 mb-1">Products</h4>
                  {results.products.map((p: any) => (
                    <Link
                      key={p._id}
                      href={`/products/${p._id}`}
                      className="block px-2 py-1 hover:bg-gray-100 rounded"
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              )}
              {results.categories?.length > 0 && (
                <div className="p-2 border-t">
                  <h4 className="font-semibold text-gray-700 mb-1">
                    Categories
                  </h4>
                  {results.categories.map((c: any, idx: number) => (
                    <span key={idx} className="block px-2 py-1">
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
              {results.sellers?.length > 0 && (
                <div className="p-2 border-t">
                  <h4 className="font-semibold text-gray-700 mb-1">Sellers</h4>
                  {results.sellers.map((s: any) => (
                    <span key={s._id} className="block px-2 py-1">
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
              {results.products?.length === 0 &&
                results.categories?.length === 0 &&
                results.sellers?.length === 0 && (
                  <div className="p-3 text-gray-500 text-center">
                    No results for “{query}”
                  </div>
                )}
            </>
          )}

          {/* ⭐️ Trending if no query typed */}
          {!query.trim() && trending.length > 0 && (
            <div className="p-2">
              <h4 className="font-semibold text-gray-700 mb-1">Trending</h4>
              {trending.map((t, idx) => (
                <button
                  key={idx}
                  onMouseDown={() => setQuery(t)} // use onMouseDown so it fires before blur
                  className="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
