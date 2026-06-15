import { LogoIcon } from "./Logo";

export default function Footer() {
  return (
    <footer className="py-10 px-6 lg:px-10 border-t border-[#d2d2d7]/50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <LogoIcon size={22} />
          <span className="text-sm font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
              LENSEIQ
            </span>
          </span>
        </div>
        <p className="text-xs text-[#424245]">© 2026 LENSEIQ</p>
      </div>
    </footer>
  );
}
