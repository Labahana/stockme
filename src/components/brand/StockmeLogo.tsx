import { APP_NAME } from "@/lib/constants";

type Size = "sm" | "md" | "lg";

const SIZES: Record<
  Size,
  { mark: number; text: string; gap: string }
> = {
  sm: { mark: 28, text: "text-base", gap: "gap-2" },
  md: { mark: 34, text: "text-lg", gap: "gap-2.5" },
  lg: { mark: 44, text: "text-2xl", gap: "gap-3" },
};

/** 3-layer isometric stock mark (icon only). */
export function StockmeMark({
  size = 34,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <rect width="512" height="512" fill="none" />
      <g transform="translate(256, 276)">
        {/* Layer 1 (bottom) */}
        <polygon points="-65,52 0,91 65,52 0,13" fill="#0D7377" />
        <polygon points="0,91 65,52 65,-23 0,16" fill="#08555A" />
        {/* White separator 1 */}
        <polygon points="-65,13 0,52 65,13 0,-26" fill="#FFFFFF" />
        <polygon points="0,52 65,13 65,-22 0,17" fill="#E6F5F5" />
        {/* Layer 2 (middle) */}
        <polygon points="-65,-26 0,13 65,-26 0,-65" fill="#0D7377" />
        <polygon points="0,13 65,-26 65,-101 0,-62" fill="#08555A" />
        {/* White separator 2 */}
        <polygon points="-65,-65 0,-26 65,-65 0,-104" fill="#FFFFFF" />
        <polygon points="0,-26 65,-65 65,-100 0,-61" fill="#E6F5F5" />
        {/* Layer 3 (top) */}
        <polygon points="-65,-104 0,-65 65,-104 0,-143" fill="#0D7377" />
        <polygon points="0,-65 65,-104 65,-179 0,-140" fill="#08555A" />
        <polygon points="0,-143 65,-104 0,-65 -65,-104" fill="#14A085" />
      </g>
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
