import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { HomePage } from "@/pages/HomePage";
import { DemoPage } from "@/pages/DemoPage";
import { WispPayPage } from "@/pages/WispPayPage";
import { InvoiceLegacyRedirect, PayRedirect, ReceiptRedirect } from "@/pages/WispPayRoutes";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="wisp-pay" element={<WispPayPage />} />
          <Route path="invoice" element={<InvoiceLegacyRedirect />} />
          <Route path="pay/:invoiceId" element={<PayRedirect />} />
          <Route path="receipt/:txHash" element={<ReceiptRedirect />} />
          <Route path="demo" element={<DemoPage />} />
          <Route path="compliance" element={<Navigate to="/demo" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  );
}
