import Link from "next/link";
import { currency } from "../../utils/format";
import type { Product } from "../../store/slices/productSlice";
import { getImageUrl } from "../../utils/images";
import { StarIcon, TagIcon } from "@heroicons/react/24/solid";

export default function ProductCard({ p }: { p: Product }) {
  const image = getImageUrl(p.images?.[0]);
  const hasDiscount =
    typeof p.discountPrice === "number" &&
    p.discountPrice! >= 0 &&
    p.discountPrice! < p.price;
  const displayPrice = hasDiscount ? p.discountPrice! : p.price;

  const tags = Array.isArray(p.tags) ? p.tags.slice(0, 3) : [];
  const moreTags =
    Array.isArray(p.tags) && p.tags.length > 3 ? p.tags.length - 3 : 0;

  const attrs = Array.isArray(p.attributes) ? p.attributes.slice(0, 2) : [];
  const seoLine = p.seo?.title || p.seo?.description || "";

  return (
    <div className="bg-white text-gray-900 rounded-xl shadow-sm overflow-hidden group relative border border-gray-200 hover:border-purple-400/60 hover:shadow-lg transition-all">
      <Link href={`/products/${p._id}`}>
        <img
          src={image}
          alt={p.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (target.src !== "/fallback.png") target.src = "/fallback.png";
          }}
        />
      </Link>

      <div className="p-4 space-y-2">
        {/* Brand + Title */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {p.brand && (
              <span className="inline-block text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full mb-1">
                {p.brand}
              </span>
            )}
            <h3 className="font-semibold text-base truncate">{p.title}</h3>
          </div>
          {typeof p.avgRating === "number" && (
            <div className="flex items-center text-yellow-500 text-sm flex-shrink-0">
              <StarIcon className="w-4 h-4 mr-1" />
              {p.avgRating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-bold text-purple-700">
            {currency(displayPrice)}
          </p>
          {hasDiscount && (
            <p className="text-sm text-gray-500 line-through">
              {currency(p.price)}
            </p>
          )}
        </div>

        {/* Attributes (first two) */}
        {attrs.length > 0 && (
          <ul className="text-xs text-gray-700 space-y-1">
            {attrs.map((a, i) => (
              <li key={`${a.key}-${i}`} className="truncate">
                <span className="text-gray-500">{a.key}:</span> {a.value}
              </li>
            ))}
          </ul>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <TagIcon className="w-3.5 h-3.5 text-gray-400" />
            {tags.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
              >
                {t}
              </span>
            ))}
            {moreTags > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                +{moreTags}
              </span>
            )}
          </div>
        )}

        {/* SEO line (subtle) */}
        {seoLine && (
          <p className="text-xs text-gray-500 line-clamp-1">{seoLine}</p>
        )}

        <Link
          href={`/products/${p._id}`}
          className="mt-1 inline-block text-sm font-medium text-purple-700 hover:text-purple-600"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}
