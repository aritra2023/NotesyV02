export function NotesyLogo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="notesy-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f766e" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="notesy-grad-2" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f766e" stopOpacity="0.8" />
          <stop offset="1" stopColor="#0891b2" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Card background */}
      <rect width="36" height="36" rx="9" fill="url(#notesy-grad)" />

      {/* Left page of open book */}
      <path
        d="M18 10.5C16.2 9.5 12.5 9.3 10.5 10V26C12.5 25.3 16.2 25.5 18 26.5V10.5Z"
        fill="white" fillOpacity="0.95"
      />
      {/* Right page of open book */}
      <path
        d="M18 10.5C19.8 9.5 23.5 9.3 25.5 10V26C23.5 25.3 19.8 25.5 18 26.5V10.5Z"
        fill="white" fillOpacity="0.72"
      />

      {/* Text lines on left page */}
      <path d="M12 14H16.5" stroke="url(#notesy-grad-2)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 16.5H16.5" stroke="url(#notesy-grad-2)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 19H15" stroke="url(#notesy-grad-2)" strokeWidth="1.2" strokeLinecap="round" />

      {/* 4-point sparkle star (AI) — top right corner */}
      <path
        d="M27.5 7L28.15 8.85L30 9.5L28.15 10.15L27.5 12L26.85 10.15L25 9.5L26.85 8.85L27.5 7Z"
        fill="white"
      />

      {/* Tiny dot sparkle bottom right of star */}
      <circle cx="30.5" cy="7" r="1" fill="white" fillOpacity="0.6" />
    </svg>
  );
}
