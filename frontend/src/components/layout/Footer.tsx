import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="text-xl font-bold text-gray-900">Luxora</div>
            <p className="mt-2 text-sm text-gray-600">
              A modern, fast e‑commerce experience built with Next.js and
              Node.js.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Shop</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/products" className="hover:text-gray-900">
                  Products
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="hover:text-gray-900">
                  Wishlist
                </Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-gray-900">
                  Cart
                </Link>
              </li>
              <li>
                <Link href="/orders" className="hover:text-gray-900">
                  Orders
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Account</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/auth/login" className="hover:text-gray-900">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-gray-900">
                  Register
                </Link>
              </li>
              <li>
                <Link href="/profile" className="hover:text-gray-900">
                  Profile
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            © {year} <span className="font-medium text-gray-900">Luxora</span>.
            All rights reserved.
          </p>
          <p className="text-xs text-gray-500">
            Crafted for a clean, realistic shopping experience.
          </p>
        </div>
      </div>
    </footer>
  );
}
