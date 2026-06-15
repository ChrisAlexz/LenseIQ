import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function VerifyPage() {
  const router = useRouter();
  const { token } = router.query;

  const [status, setStatus] = useState("Verifying your account...");

  useEffect(() => {
    if (!token) return;

    const verifyAccount = async () => {
      try {
        const res = await fetch(
          `${API_URL}/auth/verify?token=${token}`
        );

        if (res.ok) {
          setStatus("Account verified successfully!");

          setTimeout(() => {
            router.push("/login");
          }, 2000);
        } else {
          setStatus(" Verification failed or link expired.");
        }
      } catch (err) {
        setStatus(" Server error. Try again later.");
      }
    };

    verifyAccount();
  }, [token]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "Arial",
      }}
    >
      <h1>Email Verification</h1>
      <p>{status}</p>
    </div>
  );
}
