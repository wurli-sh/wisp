import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MobileTabBar } from "./MobileTabBar";
import { Navbar } from "./Navbar";

export function MainLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <Navbar />
      <main className="pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}
