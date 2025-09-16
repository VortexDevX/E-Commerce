import {
  BanknotesIcon,
  CubeIcon,
  ShoppingBagIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import Sparkline from "./Sparkline";

export type OverviewStats = {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
};

export default function OverviewCards({
  stats,
  trends,
}: {
  stats: OverviewStats;
  trends?: { orders?: number[]; revenue?: number[] };
}) {
  const cards = [
    {
      label: "Revenue",
      value: `₹${(stats.totalRevenue || 0).toLocaleString("en-IN")}`,
      icon: BanknotesIcon,
      iconTint: "bg-emerald-50 text-emerald-600",
      trend: trends?.revenue,
      stroke: "#10b981",
      fill: "rgba(16, 185, 129, 0.15)",
    },
    {
      label: "Orders",
      value: stats.totalOrders,
      icon: ShoppingBagIcon,
      iconTint: "bg-purple-50 text-purple-600",
      trend: trends?.orders,
      stroke: "#7c3aed",
      fill: "rgba(124, 58, 237, 0.15)",
    },
    {
      label: "Users",
      value: stats.totalUsers,
      icon: UserGroupIcon,
      iconTint: "bg-sky-50 text-sky-600",
    },
    {
      label: "Products",
      value: stats.totalProducts,
      icon: CubeIcon,
      iconTint: "bg-fuchsia-50 text-fuchsia-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-xl bg-white border border-gray-200 shadow-sm p-4 flex items-center gap-3"
        >
          <div
            className={`shrink-0 rounded-lg p-2 border border-gray-200 ${c.iconTint}`}
          >
            <c.icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-xl font-semibold text-gray-900 truncate">
              {c.value}
            </div>
          </div>
          {c.trend && c.trend.length > 1 && (
            <div className="absolute right-2 bottom-2 opacity-80">
              <Sparkline data={c.trend} stroke={c.stroke} fill={c.fill} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
