import Skeleton from "../ui/Skeleton";

export default function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded shadow p-3 space-y-3">
      <Skeleton className="w-full h-40" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
