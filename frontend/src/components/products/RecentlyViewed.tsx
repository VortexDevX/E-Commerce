// frontend/src/components/products/RecentlyViewed.tsx
import { useEffect, useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import { getRecent, RecentProduct } from "../../utils/recent";

type Props = {
  excludeId?: string;
  max?: number;
  title?: string;
};

export default function RecentlyViewed({
  excludeId,
  max = 8,
  title = "Recently viewed",
}: Props) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    const recents = getRecent(max + 2); // small buffer to allow exclude
    setItems(recents);
  }, [max]);

  const visible = useMemo(() => {
    const filtered = items.filter((p) => p && p._id && p._id !== excludeId);
    // de-dupe by _id just in case
    const map = new Map<string, RecentProduct>();
    for (const p of filtered) if (!map.has(p._id)) map.set(p._id, p);
    return Array.from(map.values()).slice(0, max);
  }, [items, excludeId, max]);

  if (visible.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {visible.map((p) => (
          <ProductCard key={p._id} p={p as any} />
        ))}
      </div>
    </section>
  );
}
