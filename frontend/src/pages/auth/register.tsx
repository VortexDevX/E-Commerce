import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { register } from "../../store/slices/authSlice";
import type { AppDispatch } from "../../store";
import { useRouter } from "next/router";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

// Load hCaptcha only on client
const HCaptcha = dynamic(() => import("@hcaptcha/react-hcaptcha"), {
  ssr: false,
});

export default function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0); // re-mount to reset
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.name.trim()) return "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return "Enter a valid email";
    if (form.password.length < 6)
      return "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setLocalError(v);
      return;
    }

    if (siteKey && !captchaToken) {
      setCaptchaError("Please complete the CAPTCHA");
      return;
    }
    setCaptchaError(null);

    setSubmitting(true);
    const { name, email, password } = form;
    const res = await dispatch(
      register({
        name,
        email,
        password,
        captchaToken: captchaToken || undefined,
      })
    );
    setSubmitting(false);

    // Reset captcha after attempt
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);

    if (register.fulfilled.match(res)) {
      router.push("/");
    } else {
      setLocalError((res as any)?.payload || "Registration failed");
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Create your account
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Name</label>
          <input
            type="text"
            name="name"
            placeholder="Your name"
            value={form.name}
            onChange={handleChange}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Email</label>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
            />
            <button
              type="button"
              aria-label={showPwd ? "Hide password" : "Show password"}
              aria-pressed={showPwd}
              onClick={() => setShowPwd((s) => !s)}
              className="absolute inset-y-0 right-2 my-auto p-1 rounded-md text-gray-600"
            >
              <span
                className={`inline-block transition-transform duration-150 ${
                  showPwd ? "scale-90 opacity-60" : "scale-100 opacity-100"
                }`}
              >
                {showPwd ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </span>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">At least 6 characters.</p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
              aria-invalid={
                form.confirmPassword.length > 0 &&
                form.password !== form.confirmPassword
              }
            />
            <button
              type="button"
              aria-label={
                showConfirm ? "Hide confirm password" : "Show confirm password"
              }
              aria-pressed={showConfirm}
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute inset-y-0 right-2 my-auto p-1 rounded-md text-gray-600"
            >
              <span
                className={`inline-block transition-transform duration-150 ${
                  showConfirm ? "scale-90 opacity-60" : "scale-100 opacity-100"
                }`}
              >
                {showConfirm ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </span>
            </button>
          </div>
          {form.confirmPassword.length > 0 &&
            form.password !== form.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">
                Passwords do not match
              </p>
            )}
        </div>

        {siteKey && (
          <div className="pt-1">
            <HCaptcha
              key={captchaKey}
              sitekey={siteKey}
              onVerify={(token: string) => {
                setCaptchaToken(token);
                setCaptchaError(null);
              }}
              onExpire={() => setCaptchaToken(null)}
            />
            {captchaError && (
              <p className="text-sm text-red-600 mt-2">{captchaError}</p>
            )}
          </div>
        )}

        {localError && <p className="text-sm text-red-600">{localError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex justify-center items-center bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2"
        >
          {submitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="text-sm text-gray-600 mt-4">
        Already have an account?{" "}
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
