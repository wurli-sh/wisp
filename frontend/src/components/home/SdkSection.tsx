import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { BRAND_IMAGES } from "@/config/brand";
import { PAGE_MAX } from "@/config/layout";
import { COPY } from "@/content/copy";
import { InstallCommand, TypeScriptSnippet } from "@/components/spell/code-highlight";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { cn } from "@/lib/cn";
import { sectionReveal, sectionStagger, useSectionReveal } from "@/hooks/useSectionReveal";

export function SdkSection() {
  const { sdk } = COPY;
  const { sectionRef, showContent } = useSectionReveal();
  const [activeTab, setActiveTab] = useState<string>(sdk.tabs[0].id);
  const [copied, setCopied] = useState(false);

  const current = sdk.tabs.find((t) => t.id === activeTab) ?? sdk.tabs[0];
  const isQuickstart = current.id === "quickstart";
  const copyText = isQuickstart ? sdk.snippet : current.command;

  const handleCopy = () => {
    void navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <section className="bg-background py-16 sm:py-28 md:py-32">
      <div className={cn("mx-auto px-4 sm:px-6", PAGE_MAX)}>
        <motion.div
          ref={sectionRef}
          initial={false}
          animate={showContent ? "visible" : "hidden"}
          variants={sectionStagger}
        >
          <motion.div variants={sectionReveal} className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {sdk.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
              {sdk.headlineLead}{" "}
              <HighlightedText variant="sky" from="bottom" active={showContent} delay={0.18}>
                {sdk.headlineAccent}
              </HighlightedText>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {sdk.sub}
            </p>
          </motion.div>

          <motion.div
            variants={sectionReveal}
            className="mx-auto mt-12 max-w-2xl overflow-hidden border-2 border-border shadow-card"
          >
            <ImageWithSkeleton
              src={BRAND_IMAGES.portableSdk.src}
              alt={BRAND_IMAGES.portableSdk.alt}
              width={BRAND_IMAGES.portableSdk.width}
              height={BRAND_IMAGES.portableSdk.height}
            />
          </motion.div>

          <motion.div
            variants={sectionReveal}
            className="mx-auto mt-10 max-w-2xl overflow-hidden border-2 border-border bg-charcoal shadow-card"
          >
            <div className="flex gap-0 overflow-x-auto border-b-2 border-inverse-border">
              {sdk.tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={activeTab === tab.id}
                  className={cn(
                    "relative shrink-0 px-5 py-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal",
                    activeTab === tab.id
                      ? "text-inverse-foreground"
                      : "text-inverse-muted hover:text-brand-sky",
                  )}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 bg-brand-sky" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-start justify-between gap-4 px-5 py-4">
              {isQuickstart ? (
                <TypeScriptSnippet code={sdk.snippet} />
              ) : (
                <InstallCommand command={current.command} />
              )}
              <button
                type="button"
                aria-label={copied ? "Copied" : "Copy to clipboard"}
                onClick={handleCopy}
                className="shrink-0 cursor-pointer border border-inverse-border p-2 text-inverse-muted transition-colors hover:border-brand-sky hover:bg-charcoal-panel hover:text-inverse-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"
              >
                {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
              </button>
            </div>
          </motion.div>

          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            {sdk.stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={sectionReveal}
                className="border-2 border-border bg-background px-3 py-4 text-center shadow-soft"
              >
                <p className="text-xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
