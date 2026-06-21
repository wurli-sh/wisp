import { Loader2 } from "lucide-react";
import { COPY } from "@/content/copy";
import { Button } from "@/components/ui/Button";
import { useCircleUsdcTrustline } from "@/hooks/useCircleUsdcTrustline";
import type { WalletSigner } from "@wisp_/sdk";

interface CircleUsdcTrustlineBannerProps {
  address: string | null;
  walletSigner: WalletSigner | null;
}

export function CircleUsdcTrustlineBanner({
  address,
  walletSigner,
}: CircleUsdcTrustlineBannerProps) {
  const { needsTrustline, checking, adding, addTrustline } = useCircleUsdcTrustline(
    address,
    walletSigner,
  );

  if (!needsTrustline) return null;

  const copy = COPY.circleUsdc;

  return (
    <div className="border-2 border-brand/40 bg-brand-soft/50 px-4 py-3">
      <p className="text-sm font-semibold text-primary">{copy.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{copy.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={checking || adding || !walletSigner}
          onClick={() => void addTrustline()}
          className="gap-2"
        >
          {adding ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {copy.adding}
            </>
          ) : (
            copy.action
          )}
        </Button>
        <a
          href={copy.faucetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-brand underline-offset-2 hover:underline"
        >
          {copy.faucetLink}
        </a>
      </div>
    </div>
  );
}
