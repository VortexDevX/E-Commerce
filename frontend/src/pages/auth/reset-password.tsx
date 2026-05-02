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
        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-4 border-b-[3px] border-border pb-4">
          Password reset successful
        </h1>
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          You can now sign in with your new password.
        </p>
        <div className="mt-8">
          <Link
            href="/auth/login"
            className="px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 inline-block"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-8 text-center border-b-[3px] border-border pb-4">
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
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
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
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
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
          className="btn-primary w-full disabled:opacity-50"
        >
          {submitting ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="text-sm text-gray-600 mt-4">
        Don’t have a token?{" "}
        <Link
          href="/auth/forgot-password"
          className="font-black uppercase tracking-widest pt-1 border-b-[3px] border-primary text-primary hover:opacity-80 transition-all ml-1"
        >
          Request a new reset link
        </Link>
      </p>
    </div>
  );
}
