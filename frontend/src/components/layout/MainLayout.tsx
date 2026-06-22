import { Outlet } from "react-router-dom";
import { MobileTabBar } from "./MobileTabBar";
import { Navbar } from "./Navbar";

export function MainLayout() {
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
