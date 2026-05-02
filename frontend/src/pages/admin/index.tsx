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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 mb-6">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-widest text-foreground">
                Admin Dashboard
              </h1>
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-2">
                Welcome{user?.name ? `, ${user.name}` : ""}.{" "}
                {isAdmin
                  ? "You have full administrative access."
                  : "You have sub-admin access based on assigned permissions."}
              </p>
            </div>
            {hasPerm("analytics:read") && (
              <Link href="/admin/analytics" className="inline-flex">
                <Button className="gap-2 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 rounded-none px-6 py-6 h-auto">
                  <ChartBarIcon className="w-5 h-5" />
                  Open Analytics
                </Button>
              </Link>
            )}
          </div>

          {/* Analytics section (only if allowed) */}
          {analyticsRead ? (
            <>
              {loading ? (
                <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 text-foreground font-bold uppercase tracking-widest text-sm">Loading analytics…</div>
              ) : (
                <>
                  {stats && <OverviewCards stats={stats} trends={trends} />}

                  {/* Charts grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Left column: 2 charts stacked */}
                    <div className="xl:col-span-7 space-y-6">
                      <Card className="border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none bg-card">
                        <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                          <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">
                            Last {days} Days — Revenue & Orders
                          </CardTitle>
                          <Button 
                            variant="outline" 
                            onClick={exportSalesCSV}
                            className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                          >
                            Export CSV
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
                                  stroke="#0369a1"
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

                      <Card className="border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none bg-card">
                        <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                          <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Average Order Value (AOV)</CardTitle>
                          <Button 
                            variant="outline" 
                            onClick={exportAOVCSV}
                            className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                          >
                            Export CSV
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
                                  stroke="#0f766e"
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
                    <Card className="xl:col-span-5 border-[3px] border-border shadow-[8px_8px_0px_#111] rounded-none bg-card flex flex-col">
                      <CardHeader className="flex-row items-center justify-between border-b-[3px] border-border pb-4 mb-4">
                        <CardTitle className="font-black uppercase tracking-widest text-foreground text-lg">Top Products</CardTitle>
                        <Button
                          variant="outline"
                          onClick={exportTopProductsCSV}
                          className="border-[3px] border-border font-black uppercase tracking-widest shadow-[4px_4px_0px_#111] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all rounded-none text-xs"
                        >
                          Export CSV
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-0 flex-1 flex flex-col">
                        {top.length === 0 ? (
                          <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground m-auto">No data</div>
                        ) : (
                          <div className="overflow-x-auto border-[3px] border-border flex-1">
                            <table className="min-w-full text-sm">
                              <thead className="bg-muted border-b-[3px] border-border">
                                <tr className="text-left font-black uppercase tracking-widest text-foreground">
                                  <th className="px-4 py-3 border-r-[3px] border-border">Product</th>
                                  <th className="px-4 py-3 border-r-[3px] border-border text-center">Sold</th>
                                  <th className="px-4 py-3 text-right">Revenue</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y-[3px] divide-border font-bold uppercase tracking-widest text-xs text-foreground bg-card">
                                {top.slice(0, 8).map((t, idx) => (
                                  <tr
                                    key={idx}
                                    className="hover:bg-muted/50 transition-colors"
                                  >
                                    <td className="px-4 py-3 border-r-[3px] border-border truncate max-w-[150px]" title={t.product}>{t.product}</td>
                                    <td className="px-4 py-3 border-r-[3px] border-border text-center">
                                      <span className="bg-primary/10 text-primary border-[2px] border-primary px-2 py-0.5">{t.sold}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-600 font-black">
                                      {currency(t.revenue)}
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
            <div className="bg-card border-[3px] border-border shadow-[8px_8px_0px_#111] p-6 mb-8">
              <h3 className="text-2xl font-black tracking-widest uppercase text-foreground">
                Analytics restricted
              </h3>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm mt-2 leading-relaxed">
                You don’t have access to Analytics. You can still use the tools
                below based on your permissions.
              </p>
            </div>
          )}

          {/* Shortcuts (always visible; filtered by permissions) */}
          <section className="space-y-6 mt-4">
            <h3 className="text-2xl font-black uppercase tracking-widest text-foreground border-l-[6px] border-primary pl-4">Quick Shortcuts</h3>
            {shortcuts.length === 0 ? (
              <p className="text-foreground font-bold">
                No admin areas available for your role. Please contact a full
                admin to assign permissions.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {shortcuts.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex flex-col items-center justify-center gap-4 p-6 border-[3px] border-border bg-card shadow-[4px_4px_0px_#111] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none hover:bg-muted group text-center"
                  >
                    <s.icon className="w-8 h-8 text-foreground group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-foreground font-black uppercase tracking-widest text-sm">{s.label}</span>
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

