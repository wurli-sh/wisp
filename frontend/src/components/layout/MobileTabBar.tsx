import { Link, useLocation } from "react-router-dom";
import { Home, PlayCircle, Wallet } from "lucide-react";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";

const TAB_ICONS = {
  "/": Home,
  "/wisp-pay": Wallet,
  "/demo": PlayCircle,
} as const;

function isTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/wisp-pay") {
    return (
      pathname === "/wisp-pay" ||
      pathname.startsWith("/wisp-pay") ||
      pathname.startsWith("/pay/") ||
      pathname.startsWith("/receipt/") ||
      pathname === "/invoice"
    );
  }
  if (href === "/demo") {
    return pathname === "/demo" || pathname.startsWith("/demo") || pathname.startsWith("/compliance");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Mobile navigation"
      className="shrink-0 border-t-2 border-border bg-brand-soft/80 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-14 items-stretch">
        {COPY.nav.links.map(({ href, label }) => {
          const isActive = isTabActive(pathname, href);
          const Icon = TAB_ICONS[href as keyof typeof TAB_ICONS];

          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold uppercase tracking-wide outline-none transition-colors focus-visible:shadow-glow",
                isActive
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-primary",
              )}
            >
              {Icon && <Icon size={18} strokeWidth={isActive ? 2.25 : 2} aria-hidden />}
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
