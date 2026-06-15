import { useRouter } from "next/router";
import { LayoutDashboard, LogIn, LogOut, Info, Sparkles } from "lucide-react";
import { NavBar } from "./ui/tubelight-navbar";
import { useAuth } from "../lib/AuthContext";
import { LogoWithText } from "./Logo";

export default function GlobalNav() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const navItems = !isLoading && user
    ? [
        { name: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { name: "About", url: "/about", icon: Info },
        { name: "Pricing", url: "/pro", icon: Sparkles, label: <span className="inline-flex items-center gap-1.5 text-red-600">Pricing<span className="w-1.5 h-1.5 rounded-full bg-red-600" /></span> },

        { name: "Sign Out", url: "#", icon: LogOut, onClick: handleLogout },
      ]
    : [
        { name: "About", url: "/about", icon: Info },
        { name: "Pricing", url: "/pro", icon: Sparkles, label: <span className="inline-flex items-center gap-1.5 text-red-600">Pricing<span className="w-1.5 h-1.5 rounded-full bg-red-600" /></span> },
        { name: "Sign In", url: "/login", icon: LogIn },
      ];

  return (
    <NavBar
      items={navItems}
      logo={<LogoWithText />}
    />
  );
}
