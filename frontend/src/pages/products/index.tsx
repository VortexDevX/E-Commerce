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

const CATEGORIES = ["Fashion", "Electronics", "Home", "Beauty"];
const PRICE_OPTIONS: Array<{ label: string; range: [number, number] }> = [
  { label: "Under ₹500", range: [0, 500] },
  { label: "₹500 - ₹2,000", range: [500, 2000] },
  { label: "₹2,000 - ₹5,000", range: [2000, 5000] },
  { label: "₹5,000 - ₹10,000", range: [5000, 10000] },
];

const priceRangeLabel = (range: [number, number] | null) => {
  if (!range) return "";
  const hit = PRICE_OPTIONS.find(
    (item) => item.range[0] === range[0] && item.range[1] === range[1]
  );
  return hit?.label || `${range[0]} - ${range[1]}`;
};

const getQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parsePriceRange = (value: string | string[] | undefined): [number, number] | null => {
  const raw = getQueryValue(value);
  if (!raw) return null;
  const [min, max] = raw.split(",").map((item) => Number(item));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return [min, max];
};

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

  const lastParamsRef = useRef<Record<string, string | number | boolean> | null>(null);

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

  const buildParams = (): Record<string, string | number | boolean> => {
    const params: Record<string, string | number | boolean> = {};
    if (searchParam) params.q = searchParam;
    if (sort) params.sort = sort;
    if (category) params.category = category;
    if (priceRange) params.priceRange = priceRange.join(",");
    if (minRating > 0) params.minRating = minRating;
    if (inStock) params.inStock = true;
    return params;
  };

  // Hydrate filter state from URL query so storefront CTAs and shared links apply correctly.
  useEffect(() => {
    if (!router.isReady) return;
    const nextCategory = getQueryValue(router.query.category) || "";
    const nextSort = getQueryValue(router.query.sort) || "";
    const nextRating = Number(getQueryValue(router.query.minRating) || 0);

    setCategory(nextCategory);
    setSort(sortOptions.some((item) => item.value === nextSort) ? nextSort : "");
    setMinRating(Number.isFinite(nextRating) ? Math.min(Math.max(nextRating, 0), 4) : 0);
    setInStock(getQueryValue(router.query.inStock) === "true");
    setPriceRange(parsePriceRange(router.query.priceRange));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    router.isReady,
    router.query.category,
    router.query.sort,
    router.query.minRating,
    router.query.inStock,
    router.query.priceRange,
  ]);

  // Selecting a category updates URL and clears search
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    const query: Record<string, string> = { category: newCategory };
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

  const activeFilters: Array<{ key: string; label: string }> = [];
  if (category) activeFilters.push({ key: "category", label: `Category: ${category}` });
  if (priceRange)
    activeFilters.push({
      key: "priceRange",
      label: `Price: ${priceRangeLabel(priceRange)}`,
    });
  if (minRating > 0)
    activeFilters.push({ key: "minRating", label: `Rating: ${minRating}★ & up` });
  if (inStock) activeFilters.push({ key: "inStock", label: "In stock" });
  if (sort) {
    const sortLabel = sortOptions.find((s) => s.value === sort)?.label || "Sort";
    activeFilters.push({ key: "sort", label: sortLabel });
  }

  const clearOneFilter = (key: string) => {
    if (key === "category") {
      setCategory("");
      router.push("/products", undefined, { shallow: true });
    }
    if (key === "priceRange") setPriceRange(null);
    if (key === "minRating") setMinRating(0);
    if (key === "inStock") setInStock(false);
    if (key === "sort") setSort("");
  };

  const searchInfo = searchParam ? (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 p-4 text-foreground">
      <span className="text-sm text-muted-foreground">
        Showing results for <strong className="ml-1 font-semibold text-foreground">{searchParam}</strong>
      </span>
      <button
        onClick={() => router.push("/products", undefined, { shallow: true })}
        className="text-sm font-semibold text-primary hover:text-primary/80"
      >
        Clear search
      </button>
    </div>
  ) : null;

  return (
    <div className="page-shell grid gap-8 md:grid-cols-4">
      {/* Sidebar */}
      <aside className="hidden h-fit space-y-6 border border-border bg-card p-6 shadow-card md:block">
        <button
          onClick={onClearFilters}
          className="btn-secondary mb-4 w-full px-3 py-2 text-sm"
        >
          Clear filters
        </button>

        <div>
          <h3 className="mb-2 font-semibold text-foreground">Categories</h3>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => handleCategoryChange(c)}
              className={`mb-2 block w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all ${
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-foreground">Price</h3>
          {PRICE_OPTIONS.map((r) => (
            <button
              key={r.label}
              onClick={() => setPriceRange(r.range as [number, number])}
              className={`mb-2 block w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all ${
                priceRange &&
                priceRange[0] === r.range[0] &&
                priceRange[1] === r.range[1]
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Ratings */}
        <div>
          <h3 className="mb-2 font-semibold text-foreground">Ratings</h3>
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
              className={`mb-2 block w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all ${
                minRating === o.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Availability */}
        <div>
          <h3 className="mb-2 font-semibold text-foreground">Availability</h3>
          <label className="flex select-none items-center gap-2 text-sm font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
              className="h-5 w-5 rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
            />
            In stock only
          </label>
        </div>
      </aside>

      {/* Main Content */}
      <div className="space-y-6 md:col-span-3">
        <div className="flex flex-col gap-3 border border-border bg-card p-5 shadow-card md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">Luxora catalog</p>
            <h1 className="display-font text-4xl font-semibold text-foreground md:text-5xl">
              Browse the edit
            </h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Filter by department, price, rating, and availability. Good shopping starts with fewer surprises.
          </p>
        </div>
        {searchInfo}

        <div className="md:hidden -mx-1 overflow-x-auto no-scrollbar sticky top-[68px] z-30 bg-[hsl(var(--background))] py-2">
          <div className="flex gap-2 px-1 min-w-max">
            <button
              onClick={() => setCategory("")}
              className={`px-3 py-1.5 text-xs rounded-full border ${
                !category ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border text-muted-foreground"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => handleCategoryChange(c)}
                className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap ${
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface border-border text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => clearOneFilter(chip.key)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
                >
                  {chip.label}
                  <span aria-hidden>×</span>
                </button>
              ))}
              <button
                onClick={onClearFilters}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Sort dropdown */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {list.length} result{list.length === 1 ? "" : "s"}
          </p>
          <Listbox value={sort} onChange={setSort}>
            <div className="relative w-48">
              <Listbox.Button className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm font-medium text-foreground transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40">
                {["", "priceAsc", "priceDesc", "newest"].includes(sort)
                  ? {
                      "": "Sort by",
                      priceAsc: "Price: Low → High",
                      priceDesc: "Price: High → Low",
                      newest: "Newest",
                    }[sort as "" | "priceAsc" | "priceDesc" | "newest"]
                  : "Sort by"}
              </Listbox.Button>
              <Listbox.Options className="absolute z-50 mt-2 w-full space-y-1 rounded-xl border border-border bg-card p-2 shadow-card">
                {[
                  { value: "", label: "Sort by" },
                  { value: "priceAsc", label: "Price: Low → High" },
                  { value: "priceDesc", label: "Price: High → Low" },
                  { value: "newest", label: "Newest" },
                ].map((o) => (
                  <Listbox.Option
                    key={o.value}
                    value={o.value}
                    className="cursor-pointer rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
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
          className="btn-primary mt-4 block w-full py-4 text-center md:hidden"
          onClick={() => setShowFilters(true)}
        >
          Show filters
        </button>

        {/* NEW: Category Header Banner */}
        {categoryBanner ? <BannerHero banner={categoryBanner} /> : null}

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
                <Dialog.Panel className="max-h-[80vh] w-full max-w-md space-y-6 overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 pb-20">
                  <div className="flex justify-between items-center">
                    <Dialog.Title className="text-lg font-semibold text-foreground">
                      Filters
                    </Dialog.Title>
                    <button
                      onClick={onClearFilters}
                      className="text-sm font-medium text-error"
                    >
                      Reset all
                    </button>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">
                      Categories
                    </h3>
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleCategoryChange(c)}
                        className={`mb-2 block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          category === c
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">Price</h3>
                    {PRICE_OPTIONS.map((r) => (
                      <button
                        key={r.label}
                        onClick={() =>
                          setPriceRange(r.range as [number, number])
                        }
                        className={`mb-2 block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          priceRange &&
                          priceRange[0] === r.range[0] &&
                          priceRange[1] === r.range[1]
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {/* Ratings */}
                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">
                      Ratings
                    </h3>
                    {ratingOptions.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setMinRating(o.value)}
                        className={`mb-2 block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          minRating === o.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>

                  {/* Availability */}
                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">
                      Availability
                    </h3>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={inStock}
                        onChange={(e) => setInStock(e.target.checked)}
                      />
                      In stock only
                    </label>
                  </div>

                  <div className="sticky bottom-0 flex justify-between gap-4 border-t border-border bg-surface pt-4">
                    <button
                      onClick={onClearFilters}
                      className="btn-secondary flex-1 py-2"
                    >
                      Clear all
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="btn-primary flex-1 py-2"
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
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">
              No products found
            </h2>
            <p className="mb-8 max-w-sm text-muted-foreground">
              {searchParam
                ? "Try adjusting your search or clear it to see all products."
                : "Try adjusting your filters or browse all products."}
            </p>
            <button
              onClick={onClearFilters}
              className="btn-primary"
            >
              Clear filters
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
