import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import FormInput from "../components/FormInput";
import Button from "../components/Button";
import GoogleButton from "../components/GoogleButton";
import GridBackground from "../components/GridBackground";
import { LogoIcon } from "../components/Logo";
import { signupUser } from "../services/auth";
import { useAuth } from "../lib/AuthContext";
function validate({ name, email, password, confirmPassword }) {
  const errors = {};
  if (!name.trim()) errors.name = "Full name is required.";
  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

export default function SignupPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  function handleChange(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setLoading(true);
    setApiError("");
    try {
      const result = await signupUser({ name: form.name, email: form.email, password: form.password });
      if (result.user_id) {
        setSubmittedEmail(form.email);
      }
    } catch (err) {
      setApiError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GridBackground subtle>

      <div className="flex items-center justify-center min-h-screen px-4 pt-28 pb-20">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <LogoIcon size={36} />
            </div>
            <h1 className="text-2xl font-bold text-[#1d1d1f]">Create your account</h1>
            <p className="text-sm text-[#86868b] mt-1">Start generating highlight reels instantly</p>
          </div>

          {/* Card */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-[#d2d2d7]/70 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.10)]">
            {submittedEmail ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 ring-1 ring-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Check your email</h2>
                <p className="text-sm text-[#86868b] leading-relaxed max-w-sm mx-auto">
                  We sent a verification link to
                </p>
                <p className="text-sm font-medium text-[#1d1d1f] mt-1 mb-4 break-all">
                  {submittedEmail}
                </p>
                <p className="text-sm text-[#86868b] leading-relaxed max-w-sm mx-auto">
                  Click the link in the email to activate your account, then sign in to continue.
                </p>
                <div className="mt-6 pt-6 border-t border-[#d2d2d7]/70">
                  <p className="text-xs text-[#86868b] mb-3">Didn't receive it? Check your spam folder.</p>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-black transition"
                  >
                    Continue to login
                  </Link>
                </div>
              </div>
            ) : (
            <>
            {/* Google button + divider (only shown when Client ID is configured) */}
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <>
                <GoogleButton redirectTo="/dashboard" />
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-[#d2d2d7]" />
                  <span className="text-xs text-[#86868b] font-medium">or continue with email</span>
                  <div className="flex-1 h-px bg-[#d2d2d7]" />
                </div>
              </>
            )}

            {apiError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/40 border border-red-500/30 text-sm text-red-400">
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <FormInput
                id="name"
                label="Full Name"
                type="text"
                value={form.name}
                onChange={handleChange("name")}
                placeholder="name"
                error={fieldErrors.name}
                required
              />
              <FormInput
                id="email"
                label="Email"
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                placeholder="you@example.com"
                error={fieldErrors.email}
                required
              />
              <FormInput
                id="password"
                label="Password"
                type="password"
                value={form.password}
                onChange={handleChange("password")}
                placeholder="At least 8 characters"
                error={fieldErrors.password}
                required
              />
              <FormInput
                id="confirmPassword"
                label="Confirm Password"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange("confirmPassword")}
                placeholder="Repeat your password"
                error={fieldErrors.confirmPassword}
                required
              />
              <Button type="submit" loading={loading} className="w-full mt-2 py-3">
                Create Account →
              </Button>
            </form>
            </>
            )}
          </div>

          <p className="text-center text-sm text-[#86868b] mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 font-medium hover:text-blue-500 transition">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </GridBackground>
  );
}
