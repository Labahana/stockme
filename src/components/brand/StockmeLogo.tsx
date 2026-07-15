import { APP_NAME } from "@/lib/constants";

type Size = "sm" | "md" | "lg";

const SIZES: Record<
  Size,
  { mark: number; text: string; gap: string }
> = {
  sm: { mark: 22, text: "text-base", gap: "gap-2" },
  md: { mark: 28, text: "text-lg", gap: "gap-2.5" },
  lg: { mark: 36, text: "text-2xl", gap: "gap-3" },
};

/**
 * Layered isometric diamond mark from stockme-feature-graphic.png
 * (three stacked hollow frames; bottom opens into a soft V).
 */
export function StockmeMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M20 3L34 10.5L20 18L6 10.5L20 3Z"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinejoin="round"
      />
      <path
        d="M20 13L34 20.5L20 28L6 20.5L20 13Z"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinejoin="round"
      />
      <path
        d="M6 30.5L20 23L34 30.5"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 33L20 27.5L30.5 33L20 38.5L9.5 33Z"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StockmeLogo({
  size = "md",
  className = "",
  showWordmark = true,
}: {
  size?: Size;
  className?: string;
  showWordmark?: boolean;
}) {
  const s = SIZES[size];

  return (
    <span
      className={`inline-flex items-center ${s.gap} text-[#0a5c4c] ${className}`}
    >
      <StockmeMark size={s.mark} />
      {showWordmark ? (
        <span className={`${s.text} font-bold tracking-tight`}>{APP_NAME}</span>
      ) : null}
    </span>
  );
}
