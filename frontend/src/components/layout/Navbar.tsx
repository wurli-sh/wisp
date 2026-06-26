import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ClipboardCopy, ExternalLink, LogOut } from "lucide-react";
import { NAV_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { stellarExplorerAccount } from "@/config/env";
import { useWallet } from "@/hooks/useWallet";
import { DropdownPanel } from "@/components/ui/DropdownPanel";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

const indicatorSpring = { type: "spring" as const, stiffness: 420, damping: 32 };
const NAV_INDICATOR_INSET = 4;

function getActiveNavHref(pathname: string): string {
  if (
    pathname === "/wisp-pay" ||
    pathname.startsWith("/wisp-pay") ||
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/receipt/") ||
    pathname === "/invoice"
  ) {
    return "/wisp-pay";
  }

  if (pathname === "/demo" || pathname.startsWith("/demo") || pathname.startsWith("/compliance")) {
    return "/demo";
  }

  return "/";
}

export function Navbar() {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null);
  const navListRef = useRef<HTMLDivElement>(null);
  const navLinkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const connectTriggerRef = useRef<HTMLButtonElement>(null);
  const connectedTriggerRef = useRef<HTMLButtonElement>(null);

  const display = address ? `${address.slice(0, 5)}...${address.slice(-4)}` : "";
  const activeHref = getActiveNavHref(pathname);

  useEffect(() => {
    setWalletMenuOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    const navList = navListRef.current;
    const activeLink = navLinkRefs.current[activeHref];

    if (!navList || !activeLink) return;

    let frame = 0;
    const updateIndicator = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const navRect = navList.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        setIndicator({
          x: linkRect.left - navRect.left + NAV_INDICATOR_INSET,
          width: Math.max(0, linkRect.width - NAV_INDICATOR_INSET * 2),
        });
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);

    const observer = new ResizeObserver(updateIndicator);
    observer.observe(navList);
    observer.observe(activeLink);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeHref]);

  const indicatorTransition = reduceMotion ? { duration: 0 } : indicatorSpring;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-front flex w-full justify-center px-4 pt-4 sm:px-6">
      <div
        className={cn(
          "pointer-events-auto flex h-14 w-full items-center justify-between gap-3 border-2 border-border bg-brand-soft/60 px-4 shadow-soft backdrop-blur-md sm:gap-4 sm:px-6",
          NAV_MAX,
        )}
      >
        <Link to="/" className="group flex shrink-0 select-none items-center gap-2.5">
          <div className="relative h-6 w-6 shrink-0">
            {!logoLoaded && (
              <div className="absolute inset-0 bg-charcoal/50 animate-pulse" aria-hidden />
            )}
            <Logo
              size="md"
              tone="dark"
              onLoad={() => setLogoLoaded(true)}
              className={cn(
                "transition-opacity group-hover:opacity-80",
                !logoLoaded && "opacity-0",
              )}
            />
          </div>
          <span className="text-base font-bold tracking-tight text-primary transition-colors group-hover:text-charcoal">
            Wisp
          </span>
        </Link>

        <nav className="hidden min-w-0 items-center justify-center sm:flex sm:flex-1">
          <div
            ref={navListRef}
            className="relative flex items-center justify-center gap-0.5 whitespace-nowrap sm:gap-1"
          >
            {indicator && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-0 h-1 bg-brand-dark/70"
                animate={{ x: indicator.x, width: indicator.width }}
                initial={false}
                transition={indicatorTransition}
              />
            )}
            {COPY.nav.links.map(({ href, label }) => {
              const isActive = activeHref === href;
              return (
                <Link
                  key={href}
                  ref={(node) => {
                    navLinkRefs.current[href] = node;
                  }}
                  to={href}
                  className={cn(
                    "relative shrink-0 px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-200 focus-visible:shadow-glow sm:px-4 sm:text-sm",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-primary",
                  )}
                >
                  <span className="relative z-10">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 justify-end">
          {isConnecting ? (
            <div className="flex items-center gap-2 border-2 border-border bg-card px-5 py-2">
              <div className="h-4 w-20 animate-pulse bg-muted" />
            </div>
          ) : !isConnected ? (
            <div>
              <motion.button
                ref={connectTriggerRef}
                whileTap={{ scale: 0.96 }}
                aria-haspopup="menu"
                aria-expanded={walletMenuOpen}
                onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                className="pill-gradient flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground shadow-blue-pill hover:bg-brand-dark sm:px-5 sm:text-sm"
              >
                <span className="sm:hidden">Connect</span>
                <span className="hidden sm:inline">{COPY.nav.wallet.connect}</span>
              </motion.button>

              <DropdownPanel
                anchorRef={connectTriggerRef}
                open={walletMenuOpen}
                onClose={() => setWalletMenuOpen(false)}
                align="end"
                minWidth={224}
                className="shadow-elev"
              >
                <div className="border-b-2 border-border px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {COPY.nav.wallet.choose}
                  </span>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => {
                      void connect();
                      setWalletMenuOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <div className="size-4 bg-primary-dark" />
                    Freighter
                  </button>
                </div>
              </DropdownPanel>
            </div>
          ) : (
            <div>
              <button
                ref={connectedTriggerRef}
                aria-haspopup="menu"
                aria-expanded={walletMenuOpen}
                onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                className="flex cursor-pointer items-center justify-center gap-2 border-2 border-border bg-card px-4 py-2 transition-colors hover:bg-muted sm:px-5"
              >
                <span className="text-xs font-semibold text-primary sm:text-sm">
                  {display}
                </span>
                <ChevronDown
                  size={12}
                  className={cn(
                    "text-muted-foreground transition-transform duration-300",
                    walletMenuOpen && "rotate-180",
                  )}
                />
              </button>

              <DropdownPanel
                anchorRef={connectedTriggerRef}
                open={walletMenuOpen}
                onClose={() => setWalletMenuOpen(false)}
                align="end"
                minWidth={208}
                className="shadow-elev"
              >
                <div className="border-b-2 border-border px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Connected Wallet
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {address}
                  </p>
                </div>
                <div className="space-y-0.5 p-1">
                  <button
                    onClick={() => {
                      if (address) {
                        navigator.clipboard.writeText(address);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <ClipboardCopy size={13} className="text-muted-foreground" />
                    {copied ? "Copied!" : "Copy Address"}
                  </button>
                  {address && (
                    <a
                      href={stellarExplorerAccount(address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      <ExternalLink size={13} className="text-muted-foreground" />
                      Explorer
                    </a>
                  )}
                  <button
                    onClick={() => {
                      disconnect();
                      setWalletMenuOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 border-t-2 border-border px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut size={13} />
                    Disconnect
                  </button>
                </div>
              </DropdownPanel>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
