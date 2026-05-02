import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import { fetchProductById } from "../../store/slices/productSlice";
import { addToCart } from "../../store/slices/cartSlice";
import { currency } from "../../utils/format";
import { getImageUrl } from "../../utils/images";
import { classifyVideoUrl } from "../../utils/media";
import ProductDetailsSkeleton from "../../components/products/ProductDetailsSkeleton";
import ProductGallery from "../../components/products/ProductGallery";
import toast from "react-hot-toast";
import { HeartIcon } from "@heroicons/react/24/solid";
import {
  addToWishlist,
  removeFromWishlist,
} from "../../store/slices/wishlistSlice";
import { addReview, fetchReviews } from "../../store/slices/reviewSlice";

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import { addRecent } from "../../utils/recent";
import AlsoBought from "../../components/products/AlsoBought";
import RecentlyViewed from "../../components/products/RecentlyViewed";
import { trackProductView } from "../../utils/analytics";

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="tag-chip">{children}</span>;
}

export default function ProductDetails() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { id } = router.query as { id: string };
  const { current: p } = useSelector((s: RootState) => s.products);

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZooming, setIsZooming] = useState(false);
  const [adding, setAdding] = useState(false);

  const wishlist = useSelector((s: RootState) => s.wishlist.items ?? []);
  const isWishlisted = wishlist.some((w) => w._id === p?._id);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewImagePreviews, setReviewImagePreviews] = useState<string[]>([]);
  const [rvOpen, setRvOpen] = useState(false);
  const [rvSlides, setRvSlides] = useState<{ src: string }[]>([]);
  const [rvIndex, setRvIndex] = useState(0);
  const [reviewVideo, setReviewVideo] = useState<File | null>(null);
  const [reviewVideoUrl, setReviewVideoUrl] = useState("");

  useEffect(() => {
    if (id) dispatch(fetchProductById(id));
  }, [id, dispatch]);

  useEffect(() => {
    if (p?.images?.length) setActiveImage(getImageUrl(p.images[0]));
  }, [p]);

  useEffect(() => {
    if (id) dispatch(fetchReviews(id)).unwrap().then(setReviews);
  }, [id, dispatch]);

  // Record this product as recently viewed when loaded
  useEffect(() => {
    if (p?._id) {
      addRecent({
        _id: p._id,
        title: p.title,
        price: p.price,
        images: p.images || [],
      });
      // Track product view
      trackProductView(p._id);
    }
  }, [p?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // previews for images
  useEffect(() => {
    reviewImagePreviews.forEach((u) => URL.revokeObjectURL(u));
    const urls = reviewImages.map((f) => URL.createObjectURL(f));
    setReviewImagePreviews(urls);
    // cleanup on unmount or change
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewImages.length]);

  if (!p) return <ProductDetailsSkeleton />;

  const add = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await dispatch(addToCart({ productId: p._id, qty: 1 })).unwrap();
      toast.success("Added to cart");
    } catch {
      toast.error("Could not add this item to your cart");
    } finally {
      setTimeout(() => setAdding(false), 600);
    }
  };

  const toggleWishlist = async () => {
    if (!p) return;
    if (isWishlisted) {
      await dispatch(removeFromWishlist(p._id));
      toast.success("Removed from saved items");
    } else {
      await dispatch(addToWishlist(p._id));
      toast.success("Saved for later");
    }
  };

  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const max = 3;
    const accepted = files.filter((f) =>
      ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(f.type)
    );
    const next = [...reviewImages, ...accepted].slice(0, max);
    setReviewImages(next);
  };

  const onPickVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) {
      setReviewVideo(null);
      return;
    }
    if (!["video/mp4", "video/webm"].includes(f.type)) {
      toast.error("Only MP4 or WebM allowed");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Video must be <= 20MB");
      return;
    }
    setReviewVideoUrl(""); // clear URL if file chosen
    setReviewVideo(f);
  };

  // update submitReview
  const submitReview = async () => {
    if (!reviewText.trim()) {
      toast.error("Write a short review before you submit.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("productId", p._id);
      fd.append("rating", String(reviewRating));
      fd.append("comment", reviewText);
      reviewImages.forEach((file) => fd.append("images", file));
      if (reviewVideo) {
        fd.append("video", reviewVideo);
      } else if (reviewVideoUrl.trim()) {
        fd.append("videoUrl", reviewVideoUrl.trim());
      }
      await dispatch(addReview(fd)).unwrap();
      toast.success("Review submitted");

      // reset form
      setReviewText("");
      setReviewImages([]);
      setReviewVideo(null);
      setReviewVideoUrl("");

      // refresh list
      const updated = await dispatch(fetchReviews(p._id)).unwrap();
      setReviews(updated);
    } catch (e: any) {
      toast.error(e || "We could not submit your review");
    }
  };

  const allImages = p.images?.map(getImageUrl) || [];
  const activeIndex = Math.max(0, allImages.indexOf(activeImage || ""));

  const attributeMap = new Map<string, string>();
  (p.attributes || []).forEach((a: any) => {
    const key = String(a?.key || "")
      .trim()
      .toLowerCase();
    const value = String(a?.value || "").trim();
    if (key && value && !attributeMap.has(key)) attributeMap.set(key, value);
  });

  const pickSpec = (aliases: string[], fallback = "—") => {
    for (const alias of aliases) {
      const v = attributeMap.get(alias.toLowerCase());
      if (v) return v;
    }
    return fallback;
  };

  const specs = [
    { label: "Size", value: pickSpec(["size", "dimensions", "dimension"]) },
    { label: "Color", value: pickSpec(["color", "colour"]) },
    {
      label: "Quantity",
      value:
        typeof p.stock === "number" ? `${p.stock} in stock` : pickSpec(["qty", "quantity"]),
    },
    { label: "Quality", value: pickSpec(["quality", "material", "grade"]) },
    {
      label: "Tech Spec",
      value: pickSpec([
        "tech spec",
        "tech specs",
        "technical specification",
        "technical specs",
        "specs",
      ]),
    },
  ];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } =
      e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  return (
    <div className="page-shell grid grid-cols-1 items-start gap-8 overflow-x-clip md:grid-cols-2 md:gap-12">
      {/* Left: Gallery */}
      <ProductGallery title={p.title} images={p.images} videoUrl={p.videoUrl} />

      {/* Right: Details */}
      <div className="flex flex-col border border-border bg-card p-5 shadow-card md:p-7">
        <h1 className="display-font text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          {p.title}
        </h1>

        <div className="mt-2 flex flex-wrap gap-2">
          {p.brand && <Chip>{p.brand}</Chip>}
          {p.tags?.slice(0, 5).map((t: string, i: number) => (
            <Chip key={`${t}-${i}`}>{t}</Chip>
          ))}
          {p.tags && p.tags.length > 5 && <Chip>+{p.tags.length - 5}</Chip>}
        </div>

        <p className="mt-4 text-2xl font-semibold text-primary md:text-3xl">
          {currency(p.price)}
        </p>

        <p className="mt-4 leading-7 text-muted-foreground">{p.description}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="border border-border bg-secondary px-3 py-3 text-sm text-foreground">
            {typeof p.stock === "number" && p.stock > 0
              ? p.stock <= 5
                ? `Only ${p.stock} left`
                : "In stock now"
              : "Check availability"}
          </div>
          <div className="border border-border bg-secondary px-3 py-3 text-sm text-foreground">
            {typeof p.avgRating === "number"
              ? `${p.avgRating.toFixed(1)} average rating`
              : "Reviews available after purchase"}
          </div>
          <div className="border border-border bg-secondary px-3 py-3 text-sm text-foreground">
            Standard delivery available at checkout
          </div>
        </div>

        {p.attributes?.length ? (
          <div className="mt-4">
            <h3 className="font-semibold text-foreground">What to know</h3>
            <ul className="ml-6 list-disc text-sm text-muted-foreground">
              {p.attributes.map((a: any, i: number) => (
                <li key={i}>
                  {a.key}: {a.value}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 border border-border bg-secondary p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Specifications
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className="border border-border bg-card px-3 py-2"
              >
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {spec.label}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {spec.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-6">
          <button
            onClick={add}
            disabled={adding}
            className={`btn-primary shadow-none ${
              adding ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {adding ? "Adding to cart..." : "Add to cart"}
          </button>
          <button
            onClick={toggleWishlist}
            className={`btn shadow-none ${
              isWishlisted
                ? "bg-foreground text-background border-foreground"
                : ""
            }`}
          >
            <HeartIcon
              className={`w-5 h-5 inline-block mr-2 ${
                isWishlisted ? "text-white" : "text-sky-700"
              }`}
            />
            {isWishlisted ? "Saved" : "Save for later"}
          </button>
        </div>
      </div>

      {/* Reviews */}
      <div className="md:col-span-2 mt-10">
        <h2 className="display-font mb-4 text-4xl font-semibold text-foreground">
          Customer reviews
        </h2>

        {reviews.length === 0 ? (
          <p className="text-muted-foreground italic">No reviews yet. Buy this item and share what you liked.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r, i) => (
              <li key={i} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-yellow-500">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </div>
                  {r.verifiedPurchase && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M9 16.17l-3.88-3.88L4 13.41l5 5 12-12-1.41-1.41z" />
                      </svg>
                      Verified buyer
                    </span>
                  )}
                </div>
                <p className="text-foreground">{r.comment || (r as any).text}</p>
                <span className="mt-1 block text-sm text-muted-foreground">
                  — {r.user?.name || "Customer"}
                </span>

                {/* Media render */}
                {(r.media?.images?.length || r.media?.videoUrl) && (
                  <div className="mt-3 space-y-2">
                    {r.media?.images?.length ? (
                      <div className="flex gap-2 flex-wrap">
                        {r.media.images.map(
                          (
                            img: {
                              url: string | { url?: string } | undefined;
                              alt: any;
                            },
                            idx: number
                          ) => {
                            const src = getImageUrl(img.url);
                            return (
                              <img
                                key={idx}
                                src={src}
                                alt={img.alt || `review-img-${idx}`}
                                className="h-20 w-20 cursor-zoom-in border border-border object-cover"
                                onClick={() => {
                                  setRvSlides(
                                    (r.media?.images || []).map(
                                      (i: {
                                        url:
                                          | string
                                          | { url?: string }
                                          | undefined;
                                      }) => ({
                                        src: getImageUrl(i.url),
                                      })
                                    )
                                  );
                                  setRvIndex(idx);
                                  setRvOpen(true);
                                }}
                                onError={(e) =>
                                  ((e.currentTarget as HTMLImageElement).src =
                                    "/fallback.png")
                                }
                              />
                            );
                          }
                        )}
                      </div>
                    ) : null}
                    {r.media?.videoUrl
                      ? (() => {
                          const raw = getImageUrl(r.media.videoUrl);
                          const info = classifyVideoUrl(raw);
                          return info.kind === "file" ? (
                            <video
                              src={info.src}
                              className="w-full max-w-sm border border-border"
                              controls
                              playsInline
                            />
                          ) : (
                            <iframe
                              src={info.src}
                              title="Review video"
                              className="w-full max-w-sm border border-border"
                              style={{ border: 0, aspectRatio: "16 / 9" }}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              referrerPolicy="strict-origin-when-cross-origin"
                            />
                          );
                        })()
                      : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Review form */}
        <div className="mt-4 card p-4">
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <select
              value={reviewRating}
              onChange={(e) => setReviewRating(Number(e.target.value))}
              className="bg-card px-3 py-2 font-semibold text-foreground focus:border-primary focus:outline-none"
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} stars
                </option>
              ))}
            </select>
            <input
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share what helped you decide to buy"
              className="w-full flex-1 bg-card px-4 py-2 text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Media pickers */}
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Add up to 3 photos
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={onPickImages}
              />
              {reviewImagePreviews.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {reviewImagePreviews.map((src, idx) => (
                    <img
                      key={idx}
                      src={src}
                      alt={`preview-${idx}`}
                      className="h-16 w-16 border border-border object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Add a short video
              </label>
              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={onPickVideo}
              />
              <p className="mt-1 text-xs text-muted-foreground">Or paste a video link</p>
              <input
                type="url"
                value={reviewVideoUrl}
                onChange={(e) => {
                  setReviewVideoUrl(e.target.value);
                  if (e.target.value) setReviewVideo(null);
                }}
                placeholder="https://..."
                className="mt-2 w-full bg-card px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={submitReview}
              className="btn-primary"
            >
              Submit review
            </button>
          </div>
        </div>
      </div>

      {/* Customers also bought */}
      <div className="md:col-span-2">
        <AlsoBought productId={p._id} />
      </div>

      {/* Recently viewed (exclude current product) */}
      <div className="md:col-span-2">
        <RecentlyViewed excludeId={p._id} />
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={allImages.map((src) => ({ src }))}
          index={activeIndex < 0 ? 0 : activeIndex}
          carousel={{ finite: false }}
          plugins={[Zoom, Thumbnails]}
          render={{
            buttonPrev: () => null,
            buttonNext: () => null,
          }}
        />
      )}

      {rvOpen && (
        <Lightbox
          open={rvOpen}
          close={() => setRvOpen(false)}
          slides={rvSlides}
          index={rvIndex}
          plugins={[Zoom, Thumbnails]}
        />
      )}
    </div>
  );
}
