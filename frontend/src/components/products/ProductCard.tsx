import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FireIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
} from "@heroicons/react/24/solid";
import type { Product } from "../../store/slices/productSlice";
import { currency } from "../../utils/format";
import { getImageUrl } from "../../utils/images";

export default function ProductCard({
  p,
}: {
  p: Product & { isSponsored?: boolean };
}) {
  const image = getImageUrl(p.images?.[0]);
  const [imgSrc, setImgSrc] = useState(image);

  useEffect(() => {
    setImgSrc(image);
  }, [image]);

  const hasDiscount =
    typeof p.discountPrice === "number" && p.discountPrice >= 0 && p.discountPrice < p.price;

  const displayPrice = hasDiscount ? p.discountPrice! : p.price;
  const discountPercent = hasDiscount
    ? Math.round(((p.price - (p.discountPrice || 0)) / p.price) * 100)
    : 0;

  const stock = typeof p.stock === "number" ? p.stock : 0;
  const inStock = stock > 0;
  const lowStock = inStock && stock <= 5;
  const tags = Array.isArray(p.tags) ? p.tags.slice(0, 2) : [];

  return (
    <article className="group flex h-full flex-col overflow-hidden border border-border bg-card shadow-card">
      <Link href={`/products/${p._id}`} className="relative block overflow-hidden bg-secondary">
        <div className="relative aspect-[4/5] w-full">
          <Image
            src={imgSrc}
            alt={p.title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
            onError={() => {
              if (imgSrc !== "/fallback.png") setImgSrc("/fallback.png");
            }}
          />
        </div>

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {hasDiscount ? (
            <span className="tag-chip tag-chip-warning">
              <TagIcon className="h-3.5 w-3.5" />
              {discountPercent}% off
            </span>
          ) : null}
          {p.isSponsored ? (
            <span className="tag-chip tag-chip-primary">
              <FireIcon className="h-3.5 w-3.5" />
              Featured
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-3 right-3">
          <span className={`tag-chip ${inStock ? "tag-chip-success" : "tag-chip-danger"}`}>
            {inStock ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
            {lowStock ? `${stock} left` : inStock ? "In stock" : "Sold out"}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <SparklesIcon className="h-3.5 w-3.5 text-accent" />
              <span className="truncate">{p.brand || "Luxora marketplace"}</span>
            </div>
            <Link href={`/products/${p._id}`} className="block">
              <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground group-hover:text-primary">
                {p.title}
              </h3>
            </Link>
          </div>
          {typeof p.avgRating === "number" ? (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-xs font-semibold text-foreground">
              <StarIcon className="h-3.5 w-3.5 text-warning" />
              {p.avgRating.toFixed(1)}
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-end gap-2">
          <div className="text-xl font-semibold text-foreground">{currency(displayPrice)}</div>
          {hasDiscount ? (
            <div className="text-sm text-muted-foreground line-through">
              {currency(p.price)}
            </div>
          ) : null}
        </div>

        {tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <Link href={`/products/${p._id}`} className="btn-primary mt-auto w-full">
          View product
        </Link>
      </div>
    </article>
  );
}
