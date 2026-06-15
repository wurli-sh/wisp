import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ClipboardCopy, ExternalLink, LogOut } from "lucide-react";
import { COPY } from "@/content/copy";
import { stellarExplorerAccount } from "@/config/env";
import { useWallet } from "@/hooks/useWallet";
import { DropdownPanel } from "@/components/ui/DropdownPanel";
import { cn } from "@/lib/cn";

export function Navbar() {
  const { pathname } = useLocation();
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const connectTriggerRef = useRef<HTMLButtonElement>(null);
  const connectedTriggerRef = useRef<HTMLButtonElement>(null);

  const display = address ? `${address.slice(0, 5)}...${address.slice(-4)}` : "";

  useEffect(() => {
    setWalletMenuOpen(false);
  }, [isConnected, pathname]);

  return (
    <header className="sticky top-0 z-40 flex w-full justify-center px-4">
      <div className="mt-4 grid h-14 w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center border-2 border-border bg-primary-soft/80 px-4 shadow-soft backdrop-blur-md sm:px-6">
        <Link to="/" className="group flex select-none items-center gap-2">
          <div className="flex size-4 items-center justify-center bg-primary-bright shadow-blue-pill" />
          <span className="text-base font-bold tracking-tight text-primary transition-colors group-hover:text-primary-bright">
            Amoeba
          </span>
        </Link>

        <nav className="hidden items-center justify-center gap-0.5 sm:flex sm:gap-1">
          {COPY.nav.links.map(({ href, label }) => {
            const isActive =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                to={href}
                className={cn(
                  "relative px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:px-4 sm:text-sm",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-primary",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-primary-bright/20"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex justify-end">
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
                className="pill-gradient flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap bg-primary-bright px-4 py-2 text-xs font-semibold text-primary-foreground shadow-blue-pill sm:px-5 sm:text-sm"
              >
                {COPY.nav.wallet.connect}
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
                    <div className="size-4 bg-primary-bright" />
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
                    "text-muted-foreground transition-transform duration-200",
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
