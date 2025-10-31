import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900">You’re offline</h1>
      <p className="mt-2 text-gray-600">
        It looks like your connection is unavailable. Some pages may be cached.
      </p>

      <div className="mt-6 space-y-3">
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
        >
          Go to Home
        </Link>
        <div className="text-sm text-gray-500">
          When you’re back online, reload to get the latest content.
        </div>
      </div>
    </div>
  );
}
