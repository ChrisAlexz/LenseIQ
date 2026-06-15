import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../lib/AuthContext";
import { googleLogin } from "../services/auth";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/** Decode a JWT payload without verification (safe for client-side display data only) */
function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function GoogleButton({ redirectTo = "/dashboard" }) {
  const { login } = useAuth();
  const router = useRouter();
  const containerRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");

  // Load Google GSI script dynamically
  useEffect(() => {
    if (document.getElementById("google-gsi-script")) {
      setScriptReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
  }, []);

  // Once script is ready, initialize and render the button
  useEffect(() => {
    if (!scriptReady || !CLIENT_ID || !window.google || !containerRef.current) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response) => {
        try {
          setError("");
          // Verify token server-side and get an app JWT
          const result = await googleLogin(response.credential);
          // Decode Google JWT for display info (name, picture) only
          const googlePayload = decodeJwt(response.credential);
          login({
            name:    result.name || googlePayload?.name || "",
            email:   result.email || googlePayload?.email || "",
            picture: googlePayload?.picture,
            token:   result.token,
            user_id: result.user_id,
          });
          router.push(redirectTo);
        } catch {
          setError("Google sign-in failed. Please try again.");
        }
      },
    });

    window.google.accounts.id.renderButton(containerRef.current, {
      type:   "standard",
      theme:  "filled_black",
      size:   "large",
      width:  containerRef.current.offsetWidth,
      text:   "continue_with",
      shape:  "rectangular",
      logo_alignment: "left",
    });
  }, [scriptReady, login, router, redirectTo]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <div ref={containerRef} className="w-full" />
      {error && <p className="text-sm text-red-500 mt-2 text-center">{error}</p>}
    </>
  );
}

