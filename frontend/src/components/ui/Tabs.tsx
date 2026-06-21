import { LayoutGroup, motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface TabItem {
  label: string;
  key: string;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  trailing?: React.ReactNode;
  layoutId?: string;
}

export function Tabs({
  items,
  active,
  onChange,
  className,
  trailing,
  layoutId = "tabIndicator",
}: TabsProps) {
  return (
    <LayoutGroup id={layoutId}>
      <div
        className={cn(
          "flex items-center gap-1 border-b-2 border-border bg-background px-2 pt-2",
          className,
        )}
      >
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                "relative cursor-pointer px-4 py-2.5 text-xs font-bold uppercase tracking-wider outline-none transition-colors duration-200 focus-visible:shadow-glow",
                isActive
                  ? "text-brand-foreground"
                  : "text-muted-foreground hover:bg-brand-soft/70 hover:text-primary",
              )}
            >
              {isActive && (
                <>
                  <motion.div
                    layoutId="tab-panel"
                    initial={false}
                    className="absolute inset-0 border-2 border-brand-dark bg-brand shadow-blue-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                  <motion.div
                    layoutId="tab-bar"
                    initial={false}
                    className="absolute inset-x-2 bottom-0 h-0.5 bg-brand-foreground/80"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                </>
              )}
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
        {trailing && <div className="ml-auto pr-2">{trailing}</div>}
      </div>
    </LayoutGroup>
  );
}
