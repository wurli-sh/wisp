import { LOGO_SRC } from "@/config/brand";
import { cn } from "@/lib/cn";

const sizes = {
  sm: "h-4 w-auto",
  md: "h-6 w-auto",
  lg: "h-9 w-auto",
  hero: "h-11 w-auto sm:h-14 md:h-16",
} as const;

export type LogoSize = keyof typeof sizes;
export type LogoTone = "light" | "dark";

type LogoProps = {
  size?: LogoSize;
  tone?: LogoTone;
  className?: string;
  alt?: string;
};

export function Logo({ size = "md", tone = "dark", className, alt = "Wisp" }: LogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      draggable={false}
      className={cn(sizes[size], tone === "dark" && "brightness-0", className)}
    />
  );
}
