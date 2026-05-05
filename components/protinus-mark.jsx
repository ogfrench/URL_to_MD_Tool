export function ProtinusMark({ size = 28, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" className={className}>
      <rect width="34" height="34" rx="8" fill="#0E1E3F" />
      <path d="M10 8h7a6 6 0 0 1 0 12h-7V8z" fill="#1A7F3C" />
      <rect x="10" y="21" width="4" height="5" fill="white" />
    </svg>
  );
}
