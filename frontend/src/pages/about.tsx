import Head from "next/head";
import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About Us · Luxora</title>
        <meta
          name="description"
          content="Learn about Luxora — our mission, values, and the experience we want to deliver."
        />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900">About Luxora</h1>
        <p className="text-sm text-gray-500 mt-1">
          Built for a modern shopping experience
        </p>

        <div className="mt-6 space-y-6 text-gray-800">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">Our Mission</h2>
            <p className="mt-2">
              To make high‑quality online shopping fast, reliable, and enjoyable
              — from discovery to doorstep.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              What We Offer
            </h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Curated products and honest pricing</li>
              <li>Fast checkout and secure account management</li>
              <li>
                Helpful features like wishlists, reviews, and price alerts
              </li>
              <li>Transparent policies and responsive support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Our Values</h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Trust and transparency</li>
              <li>Customer‑first design</li>
              <li>Performance and reliability</li>
            </ul>
          </section>

          <section className="text-gray-700">
            Have questions?{" "}
            <Link
              href="/contact"
              className="text-purple-700 hover:text-purple-600 font-medium underline"
            >
              Contact our team
            </Link>
            .
          </section>
        </div>
      </div>
    </>
  );
}
