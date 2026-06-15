import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import GridBackground from "../components/GridBackground";
import { useAuth } from "../lib/AuthContext";
import { PLAN_LIMITS } from "../lib/planUtils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const FREE_FEATURES = [
  `${PLAN_LIMITS.free} videos per day`,
  "Sport-based highlight detection",
  "Add captions on or off",
  "9:16 and 16:9 export",
  "LENSEIQ watermark",
];

const PRO_FEATURES = [
  `${PLAN_LIMITS.pro} videos per day`,
  "Any topic — not just sports",
  "Edit captions after generation",
  "Custom caption style, position, and color",
  "No watermark",
  "Priority processing",
];

function PlanCard({ name, price, period, features, cta, href, highlight, blurb, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative rounded-3xl border p-8 sm:p-10 ${
        highlight
          ? "border-blue-500/40 bg-gradient-to-br from-blue-50 via-white to-white shadow-[0_24px_64px_rgba(37,99,235,0.18)]"
          : "border-[#d2d2d7]/70 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
      }`}
    >
      <p className={`text-sm font-semibold ${highlight ? "text-blue-600" : "text-[#86868b]"}`}>{name}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-5xl font-semibold text-[#1d1d1f] tracking-tight">{price}</span>
        <span className="text-sm text-[#86868b]">{period}</span>
      </div>
      <p className="mt-3 text-sm text-[#424245] leading-relaxed">{blurb}</p>

      <ul className="mt-7 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm text-[#1d1d1f]">
            <Check size={18} className={highlight ? "text-blue-600 mt-0.5 shrink-0" : "text-[#86868b] mt-0.5 shrink-0"} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={`mt-8 inline-flex w-full items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold transition ${
            highlight
              ? "bg-[#1d1d1f] text-white hover:bg-black shadow-lg"
              : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7]"
          }`}
        >
          {cta}
        </button>
      ) : (
        <Link
          href={href}
          className={`mt-8 inline-flex w-full items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold transition ${
            highlight
              ? "bg-[#1d1d1f] text-white hover:bg-black shadow-lg"
              : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7]"
          }`}
        >
          {cta}
        </Link>
      )}
    </motion.div>
  );
}

export default function ProPage() {
  const { user } = useAuth();
  const dest = user ? "/dashboard" : "/signup";
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  async function handleWaitlistJoin(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const headers = { "Content-Type": "application/json" };
      const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : "";
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/auth/pro-waitlist`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not join waitlist");

      setSuccess("Thanks for joining the waitlist. Check your email.");
      setWaitlistOpen(false);
    } catch (err) {
      setError(err.message || "Could not join waitlist");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <GridBackground hue={220}>
      <section className="pt-40 pb-20 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm font-medium text-blue-600 mb-6">Pricing</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.05] max-w-3xl mx-auto">
            Start free. Go Pro when you're ready.
          </h1>
          <p className="mt-6 text-lg text-[#424245] max-w-2xl mx-auto leading-relaxed font-light">
            Free covers casual highlights. Pro is for creators who post often and want full control over their clips.
          </p>
        </div>
      </section>

      <section className="px-6 lg:px-10 pb-32">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-6 md:gap-8">
          <PlanCard
            name="Free"
            price="$0"
            period="forever"
            blurb="The whole pipeline, no card required. Great for trying it out."
            features={FREE_FEATURES}
            cta={user ? "Use free plan" : "Sign up free"}
            href={dest}
            highlight={false}
          />
          <PlanCard
            name="Pro"
            price="$12"
            period="/ month"
            blurb="More uploads, full caption control, any kind of footage."
            features={PRO_FEATURES}
            cta="Join waitlist"
            href="#"
            highlight={true}
            onClick={() => {
              setError("");
              setSuccess("");
              setWaitlistOpen(true);
            }}
          />
        </div>

        <div className="mt-8 max-w-xl mx-auto">
          {waitlistOpen && (
            <div className="rounded-3xl border border-[#d2d2d7]/70 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#1d1d1f]">Join the Pro waitlist</h2>
                  <p className="mt-2 text-sm text-[#424245]">Enter your email and we’ll keep you posted about updates on our Pro model.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWaitlistOpen(false)}
                  className="text-sm text-[#86868b] hover:text-[#1d1d1f]"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleWaitlistJoin} className="mt-5 flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Joining..." : "Join waitlist"}
                </button>
              </form>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}
          {success && <p className="mt-4 text-sm text-green-600 text-center">{success}</p>}
        </div>

        <p className="mt-10 text-center text-xs text-[#86868b]">
          Cancel anytime. Pricing in USD.
        </p>
      </section>
    </GridBackground>
  );
}
