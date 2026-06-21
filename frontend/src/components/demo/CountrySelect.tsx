import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DropdownPanel } from "@/components/ui/DropdownPanel";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { getCountryDisplayName } from "@/lib/countryDisplay";
import { cn } from "@/lib/cn";

type CountrySelectProps = {
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  variant?: "light" | "dark";
  onChange: (value: string) => void;
};

export function CountrySelect({
  label,
  value,
  options,
  disabled,
  variant = "dark",
  onChange,
}: CountrySelectProps) {
  const isLight = variant === "light";
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  const fieldClass = isLight
    ? "min-h-12 border-2 border-border bg-background px-4 text-sm font-medium text-primary outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    : "min-h-12 border-2 border-inverse-border bg-charcoal-panel px-4 text-sm font-medium text-inverse-foreground outline-none transition-colors placeholder:text-inverse-muted focus-visible:border-brand-sky focus-visible:ring-2 focus-visible:ring-brand-sky/20 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-panel";

  const labelClass = isLight
    ? "text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
    : "text-[10px] font-bold uppercase tracking-widest text-inverse-muted";

  const mutedText = isLight ? "text-muted-foreground" : "text-inverse-muted";

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className={labelClass}>
        {label}
      </span>

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        aria-label={`${label}: ${value ? getCountryDisplayName(value) : "none selected"}`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          fieldClass,
          "flex h-12 w-full cursor-pointer items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {value ? (
          <>
            <CountryFlag code={value} size="sm" />
            <span className="min-w-0 flex-1 truncate text-left">{getCountryDisplayName(value)}</span>
            <span className={cn("shrink-0 text-xs font-bold uppercase tracking-wide", mutedText)}>
              {value}
            </span>
          </>
        ) : (
          <span className={cn("flex-1 text-left", mutedText)}>Select country</span>
        )}
        <ChevronDown
          size={14}
          className={cn("shrink-0 transition-transform duration-200", mutedText, open && "rotate-180")}
        />
      </button>

      <DropdownPanel
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        align="start"
        role="listbox"
        className={cn(
          "shadow-elev",
          isLight ? "border-border bg-background" : "border-inverse-border bg-charcoal-panel",
        )}
      >
        <div className="max-h-60 overflow-y-auto p-1">
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                  isLight
                    ? selected
                      ? "bg-brand-soft text-primary"
                      : "text-primary hover:bg-muted/60"
                    : selected
                      ? "bg-brand/20 text-inverse-foreground"
                      : "text-inverse-foreground hover:bg-charcoal-panel-soft",
                )}
              >
                <CountryFlag code={option} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{getCountryDisplayName(option)}</span>
                <span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-wide", mutedText)}>
                  {option}
                </span>
              </button>
            );
          })}
        </div>
      </DropdownPanel>
    </div>
  );
}
