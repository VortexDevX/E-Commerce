import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getImageUrl } from "../utils/images";

type BannerData = {
  _id?: string;
  imageUrl: string;
  linkUrl?: string;
  altText?: string;

  // Layout/content (optional)
  layout?: "image_full" | "split_asym";
  imagePosition?: "left" | "right";
  imageFit?: "contain" | "cover";
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
};

type Props = {
  banner: BannerData;
  showAdBadge?: boolean;
  disableTracking?: boolean; // used for Admin preview
};

export default function BannerHero({
  banner,
  showAdBadge = true,
  disableTracking = false,
}: Props) {
  const {
    _id,
    imageUrl,
    linkUrl = "/products",
    altText,
    layout,
    imagePosition = "right",
    imageFit = "contain",
    headline,
    subheadline,
    ctaLabel,
  } = banner;

  const isSplit =
    layout === "split_asym" || Boolean(headline || subheadline || ctaLabel);
  const isImageRight = imagePosition !== "left";

  // Desktop smart-fit: auto switch to "cover" if "contain" would letterbox vertically
  const imgBoxRef = useRef<HTMLAnchorElement | HTMLDivElement | null>(null);
  const naturalRatioRef = useRef<number | null>(null); // width/height of the actual image
  const [smartFit, setSmartFit] = useState<"contain" | "cover">(
    imageFit || "contain"
  );

  const computeSmartFit = () => {
    if (imageFit === "cover") {
      setSmartFit("cover");
      return;
    }
    const r = naturalRatioRef.current;
    const el = imgBoxRef.current as HTMLElement | null;
    if (!r || !el) {
      setSmartFit(imageFit || "contain");
      return;
    }
    const width = el.clientWidth || 0;
    const height = el.clientHeight || 0; // should be ~ h-72 (288px), but read actual
    if (width === 0 || height === 0) {
      setSmartFit(imageFit || "contain");
      return;
    }
    const containerAspect = width / height;
    // If image is much wider than container aspect, contain would produce top/bottom gaps.
    // Threshold +5% to avoid flicker around equality.
    if (r >= containerAspect * 1.05) {
      setSmartFit("cover");
    } else {
      setSmartFit("contain");
    }
  };

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      naturalRatioRef.current = img.naturalWidth / img.naturalHeight;
      computeSmartFit();
    }
  };

  useEffect(() => {
    // Recompute on resize to keep fit optimal across breakpoints
    const onResize = () => computeSmartFit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordClick = () => {
    if (disableTracking || !_id) return;
    try {
      const url = `/api/banners/${_id}/click`;
      if ("sendBeacon" in navigator) {
        const blob = new Blob([], { type: "application/octet-stream" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, { method: "POST", keepalive: true }).catch(() => {});
      }
    } catch {}
  };

  // Legacy image-only banner
  if (!isSplit) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-gray-200">
        {showAdBadge && (
          <span className="absolute top-2 left-2 z-10 text-[11px] px-2 py-0.5 rounded-full bg-gray-900/80 text-white">
            Advertisement
          </span>
        )}
        <a href={linkUrl} onClick={recordClick} className="block">
          <img
            src={getImageUrl(imageUrl)}
            alt={altText || headline || "Banner"}
            className="block w-full h-72 md:h-96 object-cover"
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
            }
          />
        </a>
      </section>
    );
  }

  // Split (asymmetric, brand-safe)
  return (
    <section className="relative overflow-hidden rounded-2xl border border-gray-200">
      {showAdBadge && (
        <span className="absolute top-2 left-2 z-10 text-[11px] px-2 py-0.5 rounded-full bg-gray-900/80 text-white">
          Advertisement
        </span>
      )}

      {/* Mobile: stacked with overlay card */}
      <div className="md:hidden relative">
        {/* If CTA exists, do NOT wrap the whole banner with <a> to avoid nested anchors */}
        {ctaLabel ? (
          <div className="relative">
            <img
              src={getImageUrl(imageUrl)}
              alt={altText || headline || "Banner"}
              className="block w-full h-64 object-cover"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
              }
            />
            {/* Brand gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-purple-600/25 via-transparent to-transparent" />
            {/* Glass card */}
            <div className="absolute inset-x-4 bottom-4">
              <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-xl shadow p-4 text-center">
                {headline && (
                  <h3 className="text-base font-semibold text-gray-900">
                    {headline}
                  </h3>
                )}
                {subheadline && (
                  <p className="text-sm text-gray-700 mt-1">{subheadline}</p>
                )}
                <div className="mt-3">
                  <Link
                    href={linkUrl}
                    onClick={recordClick}
                    className="inline-block px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-500"
                  >
                    {ctaLabel}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <a href={linkUrl} onClick={recordClick} className="block relative">
            <img
              src={getImageUrl(imageUrl)}
              alt={altText || headline || "Banner"}
              className="block w-full h-64 object-cover"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
              }
            />
            <div className="absolute inset-0 bg-gradient-to-t from-purple-600/25 via-transparent to-transparent" />
            {(headline || subheadline) && (
              <div className="absolute inset-x-4 bottom-4">
                <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-xl shadow p-4 text-center">
                  {headline && (
                    <h3 className="text-base font-semibold text-gray-900">
                      {headline}
                    </h3>
                  )}
                  {subheadline && (
                    <p className="text-sm text-gray-700 mt-1">{subheadline}</p>
                  )}
                </div>
              </div>
            )}
          </a>
        )}
      </div>

      {/* Desktop: asymmetric split (md and up) */}
      <div className="hidden md:grid grid-cols-12">
        {/* Text side ~ 5/12 (≈42%) */}
        <div
          className={`${
            isImageRight ? "order-1" : "order-2"
          } col-span-12 md:col-span-5 p-6 lg:p-8 flex items-center`}
        >
          <div className="bg-white/75 backdrop-blur-md border border-white/60 rounded-xl shadow p-6 w-full">
            {headline && (
              <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {headline}
              </h3>
            )}
            {subheadline && (
              <p className="text-gray-700 mt-2 lg:mt-3">{subheadline}</p>
            )}
            {ctaLabel ? (
              <div className="mt-4">
                <Link
                  href={linkUrl}
                  onClick={recordClick}
                  className="inline-block px-5 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-500"
                >
                  {ctaLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {/* Image side ~ 7/12 (≈58%) */}
        <div
          className={`${
            isImageRight ? "order-2" : "order-1"
          } col-span-12 md:col-span-7 relative`}
        >
          {/* Blurred cover background to always fill, no bands */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src={getImageUrl(imageUrl)}
              alt=""
              aria-hidden="true"
              className="block w-full h-full object-cover blur-md scale-105 opacity-40"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).style.display = "none")
              }
            />
          </div>

          {/* Foreground image area */}
          <a
            ref={imgBoxRef as any}
            href={linkUrl}
            onClick={recordClick}
            className="relative block"
          >
            <img
              src={getImageUrl(imageUrl)}
              alt={altText || headline || "Banner"}
              onLoad={onImgLoad}
              className={`block w-full h-72 object-${
                smartFit === "cover" ? "cover" : "contain"
              }`}
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
              }
            />
          </a>
        </div>
      </div>
    </section>
  );
}
