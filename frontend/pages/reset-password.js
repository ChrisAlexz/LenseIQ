import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import GridBackground from "../components/GridBackground";
import FormInput from "../components/FormInput";
import Button from "../components/Button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ResetPassword() {
  const router = useRouter();

  const [token, setToken] = useState(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (router.isReady) {
      setToken(router.query.token);
    }
  }, [router.isReady, router.query.token]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!token) {
      setMessage("Invalid reset link.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_password: password,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Password reset failed");
      }

      setMessage("Password updated successfully!");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GridBackground subtle>
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md bg-white/70 backdrop-blur-md p-8 rounded-2xl border border-[#d2d2d7]/70 shadow-[0_18px_48px_rgba(15,23,42,0.10)]">
          <h1 className="text-2xl font-bold mb-6">Reset Password</h1>

          <form onSubmit={handleSubmit}>
            <FormInput
              id="password"
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />

            <Button type="submit" loading={loading} className="w-full py-3 mt-4">
              Update Password
            </Button>
          </form>

          {message && (
            <p className="text-sm text-center text-gray-600 mt-4">
              {message}
            </p>
          )}
        </div>
      </div>
    </GridBackground>
  );
}
