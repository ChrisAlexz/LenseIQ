import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import FormInput from "../components/FormInput";
import Button from "../components/Button";
import GoogleButton from "../components/GoogleButton";
import GridBackground from "../components/GridBackground";
import { LogoIcon } from "../components/Logo";
import { loginUser } from "../services/auth";
import { useAuth } from "../lib/AuthContext";

function validate({ email, password }) {
  const errors = {};
  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!password) errors.password = "Password is required.";
  return errors;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const result = await loginUser({ email: form.email, password: form.password });
      // Name not available via email login — use email prefix as fallback
      const fallbackName = form.email.split("@")[0];
      login({ name: fallbackName, email: form.email, token: result.token, user_id: result.user_id, plan: result.plan });
      router.push("/dashboard");
    } catch {
      setApiError("Invalid credentials. Please try again.");
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
            <h1 className="text-2xl font-bold text-[#1d1d1f]">Welcome back</h1>
            <p className="text-sm text-[#86868b] mt-1">Sign in to your LENSEIQ account</p>
          </div>

          {/* Card */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-[#d2d2d7]/70 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.10)]">
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
                placeholder="Your password"
                error={fieldErrors.password}
                required
              />

              <div className="flex justify-end mb-5 -mt-1">
                <Link href="/forgot-password">
                  <span className="text-xs text-blue-500 cursor-pointer hover:underline">
                    Forgot password?
                  </span>
                </Link>
              </div>

              <Button type="submit" loading={loading} className="w-full py-3">
                Log In →
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-[#86868b] mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-blue-600 font-medium hover:text-blue-500 transition">
              Sign Up Free
            </Link>
          </p>
        </div>
      </div>
    </GridBackground>
  );
}
