import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import OverviewCards, {
  OverviewStats,
} from "../../components/charts/OverviewCards";
import { fillSalesSeries } from "../../utils/analytics";
import { useAuth } from "../../hooks/useAuth";
import api from "../../utils/api";
import { downloadCSV, csvDate } from "../../utils/csv";
import { currency } from "../../utils/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/shadcn/card";
import { Button } from "../../components/shadcn/button";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartBarIcon,
  ShoppingCartIcon,
  CubeIcon,
  UsersIcon,
  ClipboardDocumentListIcon as ClipboardCheckIcon,
  CurrencyDollarIcon,
  TicketIcon,
  EnvelopeIcon,
  PhotoIcon,
  DocumentMagnifyingGlassIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

type TopProduct = { product: string; sold: number; revenue: number };
type SalesPoint = { date: string; orders: number; revenue: number };

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [salesRaw, setSalesRaw] = useState<SalesPoint[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const days = 7;

  const isAdmin = user?.role === "admin";
  const isSubadmin = user?.role === "subadmin";
  const userPerms = new Set<string>((user as any)?.permissions || []);
  const hasPerm = (perm: string) =>
    isAdmin || (isSubadmin && userPerms.has(perm));

  const analyticsRead = hasPerm("analytics:read");

  useEffect(() => {
    let mounted = true;

    if (!analyticsRead) {
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const [{ data: s }, { data: sal }, { data: tp }] = await Promise.all([
          api.get("/admin/analytics/overview"),
          api.get("/admin/analytics/sales", { params: { days } }),
          api.get("/admin/analytics/top-products"),
        ]);
        if (!mounted) return;
        setStats(s);
        setSalesRaw(sal || []);
        setTop(tp || []);
      } catch {
        if (!mounted) return;
        setStats(null);
        setSalesRaw([]);
        setTop([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [analyticsRead]);

  const sales = useMemo(
    () => fillSalesSeries(days, salesRaw),
    [salesRaw, days]
  );
  const trends = useMemo(
    () => ({
      orders: sales.map((d) => d.orders),
      revenue: sales.map((d) => d.revenue),
    }),
    [sales]
  );

  const aovData = useMemo(
    () =>
      sales.map((d) => ({
        date: d.date,
        aov: d.orders ? Math.round(d.revenue / d.orders) : 0,
      })),
    [sales]
  );

  // Exports
  const exportSalesCSV = () =>
    downloadCSV(
      "dashboard-sales.csv",
      sales.map((d) => ({
        date: csvDate(d.date),
        orders: d.orders,
        revenue: d.revenue,
      })),
      { date: "Date", orders: "Orders", revenue: "Revenue" }
    );

  const exportAOVCSV = () =>
    downloadCSV(
      "dashboard-aov.csv",
      aovData.map((d) => ({ date: csvDate(d.date), aov: d.aov })),
      { date: "Date", aov: "AOV" }
    );

  const exportTopProductsCSV = () =>
    downloadCSV(
      "dashboard-top-products.csv",
      top.map((t) => ({
        product: t.product,
        sold: t.sold,
        revenue: t.revenue,
      })),
      { product: "Product", sold: "Sold", revenue: "Revenue" }
    );

  // Quick shortcuts based on permissions
  const shortcuts = [
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: ChartBarIcon,
      perm: "analytics:read",
    },
    {
      href: "/admin/orders",
      label: "Orders",
      icon: ShoppingCartIcon,
      perm: "orders:read",
    },
    {
      href: "/admin/products",
      label: "Products",
      icon: CubeIcon,
      perm: "products:read",
    },
    {
      href: "/admin/categories",
      label: "Categories",
      icon: TagIcon,
      perm: "products:read",
    },
    {
      href: "/admin/returns",
      label: "Returns",
      icon: CurrencyDollarIcon,
      perm: "returns:read",
    },
    {
      href: "/admin/users",
      label: "Users",
      icon: UsersIcon,
      perm: "users:read",
    },
    {
      href: "/admin/seller-requests",
      label: "Seller Requests",
      icon: ClipboardCheckIcon,
      perm: "sellers:read",
    },
    {
      href: "/admin/coupons",
      label: "Coupons",
      icon: TicketIcon,
      perm: "coupons:read",
    },
    {
      href: "/admin/emails",
      label: "Email Templates",
      icon: EnvelopeIcon,
      perm: "emailTemplates:read",
    },
    {
      href: "/admin/media",
      label: "Media",
      icon: PhotoIcon,
      perm: "media:read",
    },
    {
      href: "/admin/logs",
      label: "Logs",
      icon: DocumentMagnifyingGlassIcon,
      perm: "logs:read",
    },
  ].filter((s) => !s.perm || hasPerm(s.perm));

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-gray-600">
                Welcome{user?.name ? `, ${user.name}` : ""}.{" "}
                {isAdmin
                  ? "You have full administrative access."
                  : "You have sub-admin access based on assigned permissions."}
              </p>
            </div>
            {hasPerm("analytics:read") && (
              <Link href="/admin/analytics" className="inline-flex">
                <Button variant="outline" className="gap-2">
                  <ChartBarIcon className="w-4 h-4" />
                  Open Analytics
                </Button>
              </Link>
            )}
          </div>

          {/* Analytics section (only if allowed) */}
          {analyticsRead ? (
            <>
              {loading ? (
                <div className="card p-6 text-gray-600">Loading analytics…</div>
              ) : (
                <>
                  {stats && <OverviewCards stats={stats} trends={trends} />}

                  {/* Charts grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Left column: 2 charts stacked */}
                    <div className="xl:col-span-7 space-y-6">
                      <Card>
                        <CardHeader className="flex-row items-center justify-between">
                          <CardTitle>
                            Last {days} Days — Revenue & Orders
                          </CardTitle>
                          <Button variant="outline" onClick={exportSalesCSV}>
                            Export Sales CSV
                          </Button>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="w-full h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={sales}
                                margin={{
                                  top: 12,
                                  right: 16,
                                  left: 8,
                                  bottom: 8,
                                }}
                              >
                                <CartesianGrid
                                  stroke="#e5e7eb"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="date"
                                  tick={{ fill: "#6b7280", fontSize: 11 }}
                                />
                                <YAxis
                                  yAxisId="left"
                                  tick={{ fill: "#6b7280", fontSize: 11 }}
                                />
                                <YAxis
                                  yAxisId="right"
                                  orientation="right"
                                  tick={{ fill: "#6b7280", fontSize: 11 }}
                                />
                                <Tooltip
                                  formatter={(v: any, n: any) =>
                                    n === "revenue"
                                      ? `₹${Number(v).toLocaleString("en-IN")}`
                                      : v
                                  }
                                />
                                <Legend />
                                <Line
                                  yAxisId="left"
                                  type="monotone"
                                  dataKey="orders"
                                  stroke="#7c3aed"
                                  strokeWidth={2}
                                  dot={false}
                                  name="Orders"
                                />
                                <Line
                                  yAxisId="right"
                                  type="monotone"
                                  dataKey="revenue"
                                  stroke="#10b981"
                                  strokeWidth={2}
                                  dot={false}
                                  name="Revenue"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="flex-row items-center justify-between">
                          <CardTitle>Average Order Value (AOV)</CardTitle>
                          <Button variant="outline" onClick={exportAOVCSV}>
                            Export AOV CSV
                          </Button>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="w-full h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={aovData}
                                margin={{
                                  top: 12,
                                  right: 16,
                                  left: 8,
                                  bottom: 8,
                                }}
                              >
                                <CartesianGrid
                                  stroke="#e5e7eb"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="date"
                                  tick={{ fill: "#6b7280", fontSize: 11 }}
                                />
                                <YAxis
                                  tick={{ fill: "#6b7280", fontSize: 11 }}
                                />
                                <Tooltip
                                  formatter={(v: any) =>
                                    `₹${Number(v).toLocaleString("en-IN")}`
                                  }
                                />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="aov"
                                  stroke="#6366f1"
                                  strokeWidth={2}
                                  dot={false}
                                  name="AOV"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right column: Top products */}
                    <Card className="xl:col-span-5">
                      <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Top Products</CardTitle>
                        <Button
                          variant="outline"
                          onClick={exportTopProductsCSV}
                        >
                          Export CSV
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {top.length === 0 ? (
                          <div className="text-sm text-gray-600">No data</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-600">
                                  <th className="py-2">Product</th>
                                  <th className="py-2">Sold</th>
                                  <th className="py-2">Revenue</th>
                                </tr>
                              </thead>
                              <tbody>
                                {top.slice(0, 8).map((t, idx) => (
                                  <tr
                                    key={idx}
                                    className="border-t border-gray-200 text-gray-900"
                                  >
                                    <td className="py-2">{t.product}</td>
                                    <td className="py-2">{t.sold}</td>
                                    <td className="py-2">
                                      ₹{t.revenue.toLocaleString("en-IN")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="card p-5">
              <h3 className="text-lg font-semibold text-gray-900">
                Analytics restricted
              </h3>
              <p className="text-gray-600 mt-1">
                You don’t have access to Analytics. You can still use the tools
                below based on your permissions.
              </p>
            </div>
          )}

          {/* Shortcuts (always visible; filtered by permissions) */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Shortcuts</h3>
            {shortcuts.length === 0 ? (
              <p className="text-gray-600">
                No admin areas available for your role. Please contact a full
                admin to assign permissions.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {shortcuts.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition"
                  >
                    <s.icon className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-900">{s.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
