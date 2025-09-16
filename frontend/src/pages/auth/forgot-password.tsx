import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import api from "../../utils/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = (router.query.email as string) || "";
    if (q) setEmail(q);
  }, [router.query.email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        // Avoid user enumeration: still show success-like state
        setDone(true);
      } else {
        setError(err.response?.data?.message || "Failed to send reset link");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Check your email
        </h1>
        <p className="text-gray-700">
          If an account exists for <strong>{email}</strong>, a password reset
          link has been sent.
        </p>
        <p className="text-gray-600 mt-2">
          Didn’t get it? Check spam or try again later.
        </p>
        <div className="mt-6">
          <Link
            href="/auth/login"
            className="text-purple-700 hover:text-purple-600 font-medium"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Forgot your password?
      </h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            placeholder="you@example.com"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex justify-center items-center bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2"
        >
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-gray-600 mt-4">
        Remembered your password?{" "}
        <Link
          href="/auth/login"
          className="text-purple-700 hover:text-purple-600 font-medium"
        >
          Login
        </Link>
      </p>
    </div>
  );
}
