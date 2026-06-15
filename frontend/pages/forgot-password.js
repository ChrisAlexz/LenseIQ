import { useState } from "react";
import GridBackground from "../components/GridBackground";
import FormInput from "../components/FormInput";
import Button from "../components/Button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to send reset email");
      }

      setMessage("If this email exists, a reset link has been sent.");
    } catch (err) {
        console.error("Forgot password error:", err);

        const msg = err?.message || "Something went wrong";

        setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <GridBackground subtle>
      <div className="flex items-center justify-center min-h-screen px-4 pb-20">
        <div className="w-full max-w-md bg-white/70 backdrop-blur-md p-8 rounded-2xl border border-[#d2d2d7]/70 shadow-[0_18px_48px_rgba(15,23,42,0.10)]">
          <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>

          <p className="text-sm text-gray-500 mb-6">
            Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit}>
            <FormInput
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />

            <Button type="submit" loading={loading} className="w-full py-3 mt-4">
              Send Reset Link
            </Button>
          </form>

          {message && (
            <div className="mt-5 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 text-center font-medium">
              {message}
            </div>
          )}
        </div>
      </div>
    </GridBackground>
  );
}
