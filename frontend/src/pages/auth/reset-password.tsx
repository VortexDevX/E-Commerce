import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import api from "../../utils/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = (router.query.token as string) || "";
    if (t) setToken(t);
  }, [router.query.token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Password reset successful
        </h1>
        <p className="text-gray-700">
          You can now sign in with your new password.
        </p>
        <div className="mt-6">
          <Link
            href="/auth/login"
            className="text-purple-700 hover:text-purple-600 font-medium"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Set a new password
      </h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            New password
          </label>
          <input
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirm}
            placeholder="Repeat password"
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            required
          />
          {confirm.length > 0 && password !== confirm && (
            <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !token}
          className="w-full inline-flex justify-center items-center bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2"
        >
          {submitting ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="text-sm text-gray-600 mt-4">
        Don’t have a token?{" "}
        <Link
          href="/auth/forgot-password"
          className="text-purple-700 hover:text-purple-600 font-medium"
        >
          Request a new reset link
        </Link>
      </p>
    </div>
  );
}
