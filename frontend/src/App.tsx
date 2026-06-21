import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { DemoPageSkeleton } from "@/components/skeletons/DemoSkeletons";
import { WispPayPageSkeleton } from "@/components/skeletons/WispPaySkeletons";
import { HomePage } from "@/pages/HomePage";
import { InvoiceLegacyRedirect, PayRedirect, ReceiptRedirect } from "@/pages/WispPayRoutes";

const WispPayPage = lazy(() =>
  import("@/pages/WispPayPage").then((module) => ({ default: module.WispPayPage })),
);
const DemoPage = lazy(() =>
  import("@/pages/DemoPage").then((module) => ({ default: module.DemoPage })),
);

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route
            path="wisp-pay"
            element={
              <Suspense fallback={<WispPayPageSkeleton />}>
                <WispPayPage />
              </Suspense>
            }
          />
          <Route path="invoice" element={<InvoiceLegacyRedirect />} />
          <Route path="pay/:invoiceId" element={<PayRedirect />} />
          <Route path="receipt/:txHash" element={<ReceiptRedirect />} />
          <Route
            path="demo"
            element={
              <Suspense fallback={<DemoPageSkeleton />}>
                <DemoPage />
              </Suspense>
            }
          />
          <Route path="compliance" element={<Navigate to="/demo" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  );
}
