import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import {
  login,
  loginSuccess,
  clearMfa,
  setMfa,
  verifyAdmin2FA,
  enrollInit2FA,
  enrollVerify2FA,
} from "../../store/slices/authSlice";
import type { AppDispatch, RootState } from "../../store";
import api from "../../utils/api";
import { EyeIcon, EyeSlashIcon, XMarkIcon } from "@heroicons/react/24/outline";

const HCaptcha = dynamic(() => import("@hcaptcha/react-hcaptcha"), {
  ssr: false,
});
const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, loading, error, mfa } = useSelector((s: RootState) => s.auth);

  const [otp, setOtp] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [submittingMFA, setSubmittingMFA] = useState(false);
  const [enrollInfo, setEnrollInfo] = useState<{
    secretBase32: string;
    otpauthUrl: string;
    issuer: string;
    accountName: string;
  } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (siteKey && !captchaToken) {
      setCaptchaError("Please complete the CAPTCHA");
      return;
    }
    setCaptchaError(null);

    const res: any = await dispatch(
      login({ email, password, captchaToken: captchaToken || undefined })
    );

    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);

    if (login.fulfilled.match(res)) {
      const next = (router.query.next as string) || "/";
      router.replace(next);
      return;
    }

    const raw = res?.payload as any;
    const flat = raw?.mfa || raw;
    if ((flat?.twoFARequired || flat?.twoFAEnrollRequired) && flat?.challenge) {
      dispatch(
        setMfa({
          mode: flat.twoFARequired ? "verify" : "enroll",
          challenge: flat.challenge || "", // ✅ ensure string
        })
      );
    }
  };

  useEffect(() => {
    if (mfa.mode === "enroll" && mfa.challenge) {
      (async () => {
        const res: any = await dispatch(
          enrollInit2FA({ challenge: mfa.challenge || "" })
        );
        if (enrollInit2FA.fulfilled.match(res)) {
          setEnrollInfo({
            secretBase32: res.payload.secretBase32,
            otpauthUrl: res.payload.otpauthUrl,
            issuer: res.payload.issuer,
            accountName: res.payload.accountName,
          });
          dispatch(
            setMfa({ mode: "enroll-verify", challenge: res.payload.challenge })
          );
        } else {
          setMfaError(res?.payload || "Failed to start 2FA enrollment");
        }
      })();
    }
  }, [mfa.mode, mfa.challenge, dispatch]);

  useEffect(() => {
    if (user) {
      const next = (router.query.next as string) || "/";
      router.replace(next);
    }
  }, [user, router]);

  const verifyMFA = async () => {
    if (!mfa.challenge || !otp) return;
    setSubmittingMFA(true);
    setMfaError(null);
    try {
      const res: any = await dispatch(
        verifyAdmin2FA({ challenge: mfa.challenge, code: otp })
      );
      if (verifyAdmin2FA.fulfilled.match(res)) {
        dispatch(clearMfa());
        const next = (router.query.next as string) || "/admin";
        router.replace(next);
      } else {
        setMfaError(res?.payload || "Invalid code");
      }
    } finally {
      setSubmittingMFA(false);
    }
  };

  const enrollVerifyMFA = async () => {
    if (!mfa.challenge || !otp) return;
    setSubmittingMFA(true);
    setMfaError(null);
    try {
      const res: any = await dispatch(
        enrollVerify2FA({ challenge: mfa.challenge, code: otp })
      );
      if (enrollVerify2FA.fulfilled.match(res)) {
        dispatch(clearMfa());
        const next = (router.query.next as string) || "/admin";
        router.replace(next);
      } else {
        setMfaError(res?.payload || "Invalid code");
      }
    } finally {
      setSubmittingMFA(false);
    }
  };

  const closeModal = () => {
    dispatch(clearMfa());
    setEnrollInfo(null);
    setOtp("");
    setMfaError(null);
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Sign in to your account
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

        <div>
          <label className="block text-sm text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-2 my-auto p-1 rounded-md text-gray-600"
            >
              <span
                className={`inline-block transition-transform duration-150 ${
                  show ? "scale-90 opacity-60" : "scale-100 opacity-100"
                }`}
              >
                {show ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href={`/auth/forgot-password${
              email ? `?email=${encodeURIComponent(email)}` : ""
            }`}
            className="text-sm text-purple-700 hover:text-purple-600"
          >
            Forgot password?
          </Link>
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex justify-center items-center bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      {mfa.mode && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6 relative">
            <button
              type="button"
              aria-label="Close"
              onClick={closeModal}
              className="absolute top-3 right-3 p-2 rounded-md text-gray-500 hover:bg-gray-100"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            {mfa.mode === "verify" && (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  Two‑Factor Authentication
                </h2>
                <p className="text-gray-600 mt-1 mb-4">
                  Enter the 6‑digit code from your authenticator app.
                </p>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  placeholder="123456"
                  autoFocus
                />
                {mfaError && (
                  <p className="text-sm text-red-600 mt-2">{mfaError}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={verifyMFA}
                    disabled={submittingMFA || !otp}
                    className="flex-1 inline-flex justify-center items-center bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2"
                  >
                    {submittingMFA ? "Verifying..." : "Verify and continue"}
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {(mfa.mode === "enroll" || mfa.mode === "enroll-verify") && (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  Enable Two‑Factor Authentication
                </h2>
                <p className="text-gray-600 mt-1">
                  Scan the QR with Google Authenticator, or add the details
                  manually.
                </p>

                {enrollInfo ? (
                  <>
                    <div className="mt-4 flex justify-center">
                      <div className="p-3 bg-white border rounded">
                        <QRCode value={enrollInfo.otpauthUrl} size={168} />
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-700 space-y-1">
                      <p>
                        <strong>Issuer:</strong> {enrollInfo.issuer}
                      </p>
                      <p>
                        <strong>Account:</strong> {enrollInfo.accountName}
                      </p>
                      <p>
                        <strong>Secret (base32):</strong>{" "}
                        <code className="px-1 py-0.5 bg-gray-100 rounded">
                          {enrollInfo.secretBase32}
                        </code>
                      </p>
                      <p className="mt-1">
                        Or tap this link on mobile:{" "}
                        <a
                          href={enrollInfo.otpauthUrl}
                          className="text-purple-700 underline break-all"
                        >
                          Add to Authenticator
                        </a>
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-600 mt-3">
                    Preparing enrollment…
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-sm text-gray-700 mb-1">
                    Enter 6‑digit code
                  </label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    placeholder="123456"
                  />
                </div>
                {mfaError && (
                  <p className="text-sm text-red-600 mt-2">{mfaError}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={enrollVerifyMFA}
                    disabled={submittingMFA || !otp || !enrollInfo}
                    className="flex-1 inline-flex justify-center items-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2"
                  >
                    {submittingMFA ? "Enabling..." : "Enable 2FA and continue"}
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-600 mt-4">
        Don’t have an account?{" "}
        <Link
          href="/auth/register"
          className="text-purple-700 hover:text-purple-600 font-medium"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
