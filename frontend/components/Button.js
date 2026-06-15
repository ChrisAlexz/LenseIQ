export default function Button({
  children,
  onClick,
  type = "button",
  loading = false,
  disabled = false,
  variant = "primary",
  className = "",
}) {
  const base =
    "inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-sm font-semibold transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";

  const variants = {
    primary:
      "text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:opacity-95 focus:ring-blue-500",
    secondary:
      "bg-white/70 hover:bg-white text-[#1d1d1f] border border-[#d2d2d7] focus:ring-[#86868b]",
    danger: "bg-red-600 hover:bg-red-500 text-white focus:ring-red-500",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
