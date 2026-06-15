import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../lib/AuthContext";

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/");
  }

  // Use stored name; fall back to email prefix
  const displayName = user?.name || user?.email?.split("@")[0] || "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-16 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      {/* Logo */}
            <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="font-extrabold text-white text-lg tracking-tight">LENSEIQ</span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {user ? (
          <>
            {/* Avatar + name */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-xs font-bold text-black uppercase">
                  {displayName[0]}
                </span>
              </div>
              <span className="text-sm font-medium text-white capitalize">{displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                router.pathname === "/login"
                  ? "text-white bg-zinc-800"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-500 text-black hover:bg-green-400 transition"
            >
              Sign Up Free →
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
