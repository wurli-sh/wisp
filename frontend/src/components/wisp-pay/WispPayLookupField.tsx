import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { buttonHover, buttonTap } from "@/lib/animations";
import { cn } from "@/lib/cn";

interface WispPayLookupFieldProps {
  label: string;
  placeholder: string;
  loadLabel: string;
  onLoad: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function WispPayLookupField({
  label,
  placeholder,
  loadLabel,
  onLoad,
  disabled,
  className,
}: WispPayLookupFieldProps) {
  const [value, setValue] = useState("");
  const loadDisabled = disabled || !value.trim();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-12 flex-1 border-2 border-border bg-background px-4 text-sm font-medium text-primary outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
        />
        <motion.div
          className="inline-flex"
          whileHover={loadDisabled ? undefined : buttonHover}
          whileTap={loadDisabled ? undefined : buttonTap}
        >
          <Button
            type="button"
            variant="primary"
            disabled={loadDisabled}
            onClick={() => onLoad(value.trim())}
            className="w-full sm:min-w-28"
          >
            {loadLabel}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
