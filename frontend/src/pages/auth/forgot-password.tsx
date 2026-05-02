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
        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-4 border-b-[3px] border-border pb-4">
          Check your email
        </h1>
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          If an account exists for <strong className="text-foreground">{email}</strong>, a password reset
          link has been sent.
        </p>
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-2">
          Didn’t get it? Check spam or try again later.
        </p>
        <div className="mt-8">
          <Link
            href="/auth/login"
            className="px-6 py-3 border-[3px] border-primary bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[4px_4px_0px_transparent] hover:shadow-[4px_4px_0px_#111] transition-all hover:-translate-y-1 inline-block"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-8 text-center border-b-[3px] border-border pb-4">
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
            className="w-full bg-card border-[3px] border-border rounded-none px-4 py-3 pb-2 text-foreground font-bold shadow-[4px_4px_0px_hsl(var(--foreground))] focus:outline-none focus:translate-x-[4px] focus:translate-y-[4px] focus:shadow-none transition-all placeholder:text-foreground/40"
            placeholder="you@example.com"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-gray-600 mt-4">
        Remembered your password?{" "}
        <Link
          href="/auth/login"
          className="font-black uppercase tracking-widest pt-1 border-b-[3px] border-primary text-primary hover:opacity-80 transition-all ml-1"
        >
          Login
        </Link>
      </p>
    </div>
  );
}
