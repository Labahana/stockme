import { APP_NAME } from "@/lib/constants";

type Size = "sm" | "md" | "lg";

const SIZES: Record<
  Size,
  { mark: number; text: string; gap: string }
> = {
  sm: { mark: 26, text: "text-base", gap: "gap-2" },
  md: { mark: 32, text: "text-lg", gap: "gap-2.5" },
  lg: { mark: 40, text: "text-2xl", gap: "gap-3" },
};

/**
 * Brand mark — isometric inventory cube with open stock shelves.
 * Matches App Store icon language; uses brand teals on transparent ground.
 */
export function StockmeMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      {/* Top */}
      <polygon points="32,10 50,20 32,30 14,20" fill="#14A085" />
      {/* Right */}
      <polygon points="32,30 50,20 50,44 32,54" fill="#08555A" />
      {/* Front panel (recessed shelves show brand teal) */}
      <polygon points="14,20 32,30 32,54 14,44" fill="#0D7377" />
      {/* Three stock shelves */}
      <polygon points="17,26 29,33 29,36.5 17,29.5" fill="#FFFFFF" />
      <polygon points="17,34 29,41 29,44.5 17,37.5" fill="#E6F5F5" />
      <polygon points="17,42 29,49 29,52.5 17,45.5" fill="#FFFFFF" />
    </svg>
  );
}

/** Icon + Stockme wordmark for headers / footers. */
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
      className={`inline-flex items-center ${s.gap} text-[#0D7377] ${className}`}
    >
      <StockmeMark size={s.mark} />
      {showWordmark ? (
        <span className={`${s.text} font-semibold tracking-tight`}>
          {APP_NAME}
        </span>
      ) : null}
    </span>
  );
}
