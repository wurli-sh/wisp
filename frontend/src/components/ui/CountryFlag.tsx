import { Suspense, useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { getCountryDisplayName, normalizeCountryCode } from "@/lib/countryDisplay";
import { loadFlagSvg } from "@/lib/countryFlags";
import { cn } from "@/lib/cn";

type CountryFlagProps = {
  code: string;
  size?: "sm" | "md";
  className?: string;
};

const sizeClasses = {
  sm: "h-4 w-6",
  md: "h-5 w-[1.875rem]",
} as const;

const globeSizes = {
  sm: 14,
  md: 16,
} as const;

function GlobeFallback({
  size,
  className,
  muted,
}: {
  size: "sm" | "md";
  className?: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-inverse-border bg-charcoal-panel-soft",
        sizeClasses[size],
        muted && "opacity-40",
        className,
      )}
      aria-hidden
    >
      <Globe size={globeSizes[size]} className="text-inverse-muted" />
    </span>
  );
}

function CountryFlagInner({ code, size = "md", className }: CountryFlagProps) {
  const normalized = normalizeCountryCode(code);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!normalized) {
      setFailed(true);
      setSvg(null);
      return;
    }

    let cancelled = false;
    setFailed(false);
    setSvg(null);

    void loadFlagSvg(normalized).then((result) => {
      if (cancelled) return;
      if (result) {
        setSvg(result);
      } else {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [normalized]);

  if (!normalized || failed) {
    return <GlobeFallback size={size} className={className} />;
  }

  if (!svg) {
    return <GlobeFallback size={size} className={className} muted />;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 overflow-hidden ring-1 ring-inverse-border [&>svg]:block [&>svg]:h-full [&>svg]:w-full",
        sizeClasses[size],
        className,
      )}
      role="img"
      aria-label={getCountryDisplayName(normalized)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function CountryFlag(props: CountryFlagProps) {
  return (
    <Suspense fallback={<GlobeFallback size={props.size ?? "md"} className={props.className} muted />}>
      <CountryFlagInner {...props} />
    </Suspense>
  );
}
