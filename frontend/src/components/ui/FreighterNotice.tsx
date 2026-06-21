import { COPY } from "@/content/copy";

/**
 * Shown next to a Connect CTA when the Freighter extension is not detected, so
 * the user gets an actionable install link instead of a silently failing button.
 */
export function FreighterNotice() {
  return (
    <p className="text-xs text-muted-foreground">
      {COPY.common.installFreighter}{" "}
      <a
        href={COPY.common.freighterUrl}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-brand underline-offset-2 hover:underline"
      >
        {COPY.common.installFreighterLink}
      </a>
    </p>
  );
}
