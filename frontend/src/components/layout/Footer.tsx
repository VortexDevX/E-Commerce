import Link from "next/link";

const groups = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "Products" },
      { href: "/wishlist", label: "Saved" },
      { href: "/cart", label: "Cart" },
      { href: "/orders", label: "Orders" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/auth/login", label: "Login" },
      { href: "/auth/register", label: "Register" },
      { href: "/profile", label: "Profile" },
      { href: "/seller/apply", label: "Become a seller" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/policies/terms", label: "Terms" },
      { href: "/policies/privacy", label: "Privacy" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/policies/shipping", label: "Shipping" },
      { href: "/policies/returns", label: "Returns" },
      { href: "/policies/cookies", label: "Cookies" },
      { href: "/policies/payments", label: "Payments" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-foreground text-white">
      <div className="page-shell space-y-10">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_repeat(4,1fr)]">
          <div>
            <div className="display-font mb-4 text-4xl font-semibold text-white">
              Luxora
            </div>
            <p className="max-w-sm text-sm leading-6 text-white/70">
              Curated products, clear seller tools, secure checkout, and simple
              order tracking in one marketplace.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="tag-chip bg-white/10 text-white">Verified sellers</span>
              <span className="tag-chip bg-white/10 text-white">Secure checkout</span>
              <span className="tag-chip bg-white/10 text-white">Order tracking</span>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-sm font-semibold text-white">
                {group.title}
              </h3>
              <div className="space-y-3">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-sm text-white/62 hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/15 pt-6 text-sm text-white/62 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} <span className="text-white">Luxora</span>. All rights reserved.
          </p>
          <p>Designed for buying, selling, and keeping operations tidy.</p>
        </div>
      </div>
    </footer>
  );
}
