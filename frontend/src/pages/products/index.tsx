import Link from "next/link";
import { useEffect, useRef, useState, Fragment } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import type { RootState, AppDispatch } from "../../store";
import { fetchProducts } from "../../store/slices/productSlice";
import ProductCard from "../../components/products/ProductCard";
import ProductCardSkeleton from "../../components/products/ProductCardSkeleton";
import { Listbox, Dialog, Transition } from "@headlessui/react";
import api from "../../utils/api";
import BannerHero from "../../components/BannerHero";

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

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function ProductsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { list, loading } = useSelector((s: RootState) => s.products);

  const router = useRouter();
  const searchParam = router.query.search as string | undefined;

  const [sort, setSort] = useState("");
  const [category, setCategory] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // NEW: Ratings + Availability
  const [minRating, setMinRating] = useState<number>(0);
  const [inStock, setInStock] = useState<boolean>(false);

  // NEW: Category banner state
  const [categoryBanner, setCategoryBanner] = useState<Banner | null>(null);
  const catBannerImpressionRef = useRef<string | null>(null);

  const lastParamsRef = useRef<any>(null);

  const sortOptions = [
    { value: "", label: "Sort by" },
    { value: "priceAsc", label: "Price: Low → High" },
    { value: "priceDesc", label: "Price: High → Low" },
    { value: "newest", label: "Newest" },
  ];

  const ratingOptions = [
    { value: 0, label: "Any rating" },
    { value: 1, label: "1★ & up" },
    { value: 2, label: "2★ & up" },
    { value: 3, label: "3★ & up" },
    { value: 4, label: "4★ & up" },
  ];

  const buildParams = () => {
    const params: any = {};
    if (searchParam) params.q = searchParam;
    if (sort) params.sort = sort;
    if (category) params.category = category;
    if (priceRange) params.priceRange = priceRange.join(",");
    if (minRating > 0) params.minRating = minRating;
    if (inStock) params.inStock = true;
    return params;
  };

  // Initialize category from URL query (e.g., /products?category=Electronics)
  useEffect(() => {
    if (!router.isReady) return;
    const c = router.query.category;
    if (typeof c === "string") {
      setCategory(c);
    }
  }, [router.isReady, router.query.category]);

  // Selecting a category updates URL and clears search
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    const query: any = { category: newCategory };
    router.push({ pathname: "/products", query }, undefined, { shallow: true });
  };

  // Fetch products when filters change
  useEffect(() => {
    const params = buildParams();
    lastParamsRef.current = params;
    dispatch(fetchProducts(params));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, sort, category, priceRange, minRating, inStock]);

  useEffect(() => {
    if (list.length === 0) {
      const params = buildParams();
      lastParamsRef.current = params;
      dispatch(fetchProducts(params));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NEW: Fetch category_header banner whenever category changes
  useEffect(() => {
    const run = async () => {
      if (!category) {
        setCategoryBanner(null);
        catBannerImpressionRef.current = null;
        return;
      }
      try {
        const slug = slugify(category);
        const { data } = await api.get("banners/active", {
          params: { placement: "category_header", categorySlug: slug },
        });
        setCategoryBanner(data?.banner || null);
      } catch {
        setCategoryBanner(null);
      }
      catBannerImpressionRef.current = null;
    };
    run();
  }, [category]);

  // NEW: Send impression for category banner once per banner id
  useEffect(() => {
    if (!categoryBanner) return;
    if (catBannerImpressionRef.current === categoryBanner._id) return;
    catBannerImpressionRef.current = categoryBanner._id;
    api.post(`banners/${categoryBanner._id}/impression`).catch(() => {});
  }, [categoryBanner]);

  const onClearFilters = () => {
    setCategory("");
    setPriceRange(null);
    setSort("");
    setMinRating(0);
    setInStock(false);
    setCategoryBanner(null);
    catBannerImpressionRef.current = null;
    // Clear category/search from URL
    router.push("/products", undefined, { shallow: true });
  };

  const isInitialLoading = loading && list.length === 0;

  const searchInfo = searchParam ? (
    <div className="mb-4 p-3 bg-purple-50 rounded-md flex items-center justify-between">
      <span className="text-sm text-gray-700">
        Searching for: <strong>{searchParam}</strong>
      </span>
      <button
        onClick={() => router.push("/products", undefined, { shallow: true })}
        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
      >
        Clear search
      </button>
    </div>
  ) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-4 gap-8">
      {/* Sidebar */}
      <aside className="hidden md:block space-y-6 card p-6 h-fit">
        <button
          onClick={onClearFilters}
          className="w-full mb-4 px-3 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-500 text-sm font-medium"
        >
          Clear All Filters
        </button>

        <div>
          <h3 className="font-semibold mb-2 text-gray-900">Categories</h3>
          {["Fashion", "Electronics", "Home", "Beauty"].map((c) => (
            <button
              key={c}
              onClick={() => handleCategoryChange(c)}
              className={`block w-full text-left px-3 py-1 rounded ${
                category === c
                  ? "bg-purple-600 text-white"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div>
          <h3 className="font-semibold mb-2 text-gray-900">Price</h3>
          {[
            { label: "Under ₹500", range: [0, 500] },
            { label: "₹500 - ₹2,000", range: [500, 2000] },
            { label: "₹2,000 - ₹5,000", range: [2000, 5000] },
            { label: "₹5,000 - ₹10,000", range: [5000, 10000] },
          ].map((r) => (
            <button
              key={r.label}
              onClick={() => setPriceRange(r.range as [number, number])}
              className={`block w-full text-left px-3 py-1 rounded ${
                priceRange &&
                priceRange[0] === r.range[0] &&
                priceRange[1] === r.range[1]
                  ? "bg-purple-600 text-white"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Ratings */}
        <div>
          <h3 className="font-semibold mb-2 text-gray-900">Ratings</h3>
          {[
            { value: 0, label: "Any rating" },
            { value: 1, label: "1★ & up" },
            { value: 2, label: "2★ & up" },
            { value: 3, label: "3★ & up" },
            { value: 4, label: "4★ & up" },
          ].map((o) => (
            <button
              key={o.value}
              onClick={() => setMinRating(o.value)}
              className={`block w-full text-left px-3 py-1 rounded ${
                minRating === o.value
                  ? "bg-purple-600 text-white"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Availability */}
        <div>
          <h3 className="font-semibold mb-2 text-gray-900">Availability</h3>
          <label className="flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
            />
            In stock only
          </label>
        </div>
      </aside>

      {/* Main Content */}
      <div className="md:col-span-3 space-y-6">
        {searchInfo}

        {/* Sort dropdown */}
        <div className="flex justify-end">
          <Listbox value={sort} onChange={setSort}>
            <div className="relative w-48">
              <Listbox.Button className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm text-left text-gray-900">
                {["", "priceAsc", "priceDesc", "newest"].includes(sort)
                  ? {
                      "": "Sort by",
                      priceAsc: "Price: Low → High",
                      priceDesc: "Price: High → Low",
                      newest: "Newest",
                    }[sort as "" | "priceAsc" | "priceDesc" | "newest"]
                  : "Sort by"}
              </Listbox.Button>
              <Listbox.Options className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50">
                {[
                  { value: "", label: "Sort by" },
                  { value: "priceAsc", label: "Price: Low → High" },
                  { value: "priceDesc", label: "Price: High → Low" },
                  { value: "newest", label: "Newest" },
                ].map((o) => (
                  <Listbox.Option
                    key={o.value}
                    value={o.value}
                    className="cursor-pointer px-3 py-2 hover:bg-gray-50 text-gray-900"
                  >
                    {o.label}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        {/* Mobile Filters Button */}
        <button
          className="md:hidden w-full bg-purple-600 text-white py-2 rounded-md"
          onClick={() => setShowFilters(true)}
        >
          Show Filters
        </button>

        {/* NEW: Category Header Banner */}
        {categoryBanner ? <BannerHero banner={categoryBanner as any} /> : null}

        {/* Mobile Filters Modal */}
        <Transition show={showFilters} as={Fragment}>
          <Dialog
            onClose={() => setShowFilters(false)}
            className="relative z-50"
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50" />
            </Transition.Child>

            <div className="fixed inset-0 flex items-end justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="translate-y-full"
                enterTo="translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="translate-y-0"
                leaveTo="translate-y-full"
              >
                <Dialog.Panel className="w-full max-w-md bg-white rounded-t-2xl p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Filters
                    </Dialog.Title>
                    <button
                      onClick={onClearFilters}
                      className="text-rose-600 text-sm font-medium"
                    >
                      Reset All
                    </button>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">
                      Categories
                    </h3>
                    {["Fashion", "Electronics", "Home", "Beauty"].map((c) => (
                      <button
                        key={c}
                        onClick={() => handleCategoryChange(c)}
                        className={`block w-full text-left px-3 py-2 rounded ${
                          category === c
                            ? "bg-purple-600 text-white"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">Price</h3>
                    {[
                      { label: "Under ₹500", range: [0, 500] },
                      { label: "₹500 - ₹2000", range: [500, 2000] },
                      { label: "₹2000 - ₹5,000", range: [2000, 5000] },
                      { label: "₹5000 - ₹10,000", range: [5000, 10000] },
                    ].map((r) => (
                      <button
                        key={r.label}
                        onClick={() =>
                          setPriceRange(r.range as [number, number])
                        }
                        className={`block w-full text-left px-3 py-2 rounded ${
                          priceRange &&
                          priceRange[0] === r.range[0] &&
                          priceRange[1] === r.range[1]
                            ? "bg-purple-600 text-white"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {/* Ratings */}
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">
                      Ratings
                    </h3>
                    {ratingOptions.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setMinRating(o.value)}
                        className={`block w-full text-left px-3 py-2 rounded ${
                          minRating === o.value
                            ? "bg-purple-600 text-white"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>

                  {/* Availability */}
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">
                      Availability
                    </h3>
                    <label className="flex items-center gap-2 text-gray-700">
                      <input
                        type="checkbox"
                        checked={inStock}
                        onChange={(e) => setInStock(e.target.checked)}
                      />
                      In stock only
                    </label>
                  </div>

                  <div className="flex justify-between gap-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={onClearFilters}
                      className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-md"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="flex-1 bg-purple-600 text-white py-2 rounded-md hover:bg-purple-500"
                    >
                      Apply
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Grid */}
        {isInitialLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="card p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No products found
            </h2>
            <p className="text-gray-600 mb-4">
              {searchParam
                ? "Try adjusting your search or clear it to see all products."
                : "Try adjusting your filters or browse all products."}
            </p>
            <button
              onClick={onClearFilters}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-500"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 ${
              loading ? "opacity-50" : ""
            }`}
          >
            {list.map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
