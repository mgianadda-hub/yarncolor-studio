/** Logo: un gomitolo stilizzato con il capo del filo. */
export default function Logo({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <circle cx="30" cy="30" r="25" fill="var(--accent-soft)" />
      <g fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="30" cy="30" r="25" />
        <path d="M9 17c10 2 24 11 33 31" />
        <path d="M6 26c10 3 22 12 28 28" />
        <path d="M15 9c11 3 24 14 31 33" />
        <path d="M25 5.5c10 5 19 15 25 26" />
        <path d="M49 13c-12 1-27 12-33 37" />
        <path d="M54 25c-9 0-20 8-24 29" />
        <path d="M51 47c4 6 7 9 11 9" />
      </g>
    </svg>
  );
}
