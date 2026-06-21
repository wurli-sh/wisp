import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";

export function InvoiceLegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/wisp-pay${search}`} replace />;
}

export function PayRedirect() {
  const { invoiceId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const d = searchParams.get("d");

  if (!invoiceId) {
    return <Navigate to="/wisp-pay" replace />;
  }

  const target = d
    ? `/wisp-pay?mode=pay&id=${encodeURIComponent(invoiceId)}&d=${encodeURIComponent(d)}`
    : `/wisp-pay?mode=pay&id=${encodeURIComponent(invoiceId)}`;

  return <Navigate to={target} replace />;
}

export function ReceiptRedirect() {
  const { txHash = "" } = useParams();
  if (!txHash) {
    return <Navigate to="/wisp-pay?mode=receipt" replace />;
  }
  return <Navigate to={`/wisp-pay?mode=receipt&tx=${encodeURIComponent(txHash)}`} replace />;
}
