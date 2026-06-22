import { Outlet } from "react-router-dom";
import { MobileTabBar } from "./MobileTabBar";
import { Navbar } from "./Navbar";

export function MainLayout() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Navbar />
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}
