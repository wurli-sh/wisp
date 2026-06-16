import { Outlet, useLocation } from "react-router-dom";
import { PAGE_MAX } from "@/config/layout";
import { cn } from "@/lib/cn";
import { Navbar } from "./Navbar";

export function MainLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Navbar />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {isHome ? (
          <Outlet />
        ) : (
          <div className={cn("mx-auto h-full w-full px-4 sm:px-6", PAGE_MAX)}>
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
