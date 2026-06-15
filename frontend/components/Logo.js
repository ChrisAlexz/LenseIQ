import Link from "next/link";

export function LogoIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="13" stroke="#2563eb" strokeWidth="1.5" opacity="0.5" />
      <circle cx="14" cy="14" r="9" stroke="#2563eb" strokeWidth="1" opacity="0.25" />
      <circle cx="14" cy="4" r="1.5" fill="#2563eb" opacity="0.4" />
      <circle cx="14" cy="24" r="1.5" fill="#2563eb" opacity="0.4" />
      <circle cx="4" cy="14" r="1.5" fill="#2563eb" opacity="0.4" />
      <circle cx="24" cy="14" r="1.5" fill="#2563eb" opacity="0.4" />
      <path d="M11.5 9.5V18.5L19.5 14L11.5 9.5Z" fill="#2563eb" />
    </svg>
  );
}

export function LogoWithText({ size = 28 }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <LogoIcon size={size} />
      <span className="hidden sm:inline text-sm font-extrabold tracking-tight">
        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
          LENSEIQ
        </span>
      </span>
    </Link>
  );
}
