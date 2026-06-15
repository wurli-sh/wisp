import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ClipboardCopy } from "lucide-react";
import { COPY } from "@/content/copy";
import { HighlightedText } from "@/components/spell/highlighted-text";
import { cn } from "@/lib/cn";
import { fadeInUp, scrollViewport, staggerContainer } from "@/lib/animations";

export function SdkSection() {
  const { sdk } = COPY;
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
    <section className="bg-primary-soft/35 py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="text-center"
        >
          <motion.p
            variants={fadeInUp}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            {sdk.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="mt-4 text-3xl font-bold text-foreground sm:text-4xl"
          >
            <HighlightedText variant="bright" from="bottom" inView delay={0.05}>
              Three lines
            </HighlightedText>{" "}
            of code.
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base"
          >
            {sdk.sub}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={scrollViewport}
          className="mx-auto mt-12 max-w-2xl overflow-hidden border-2 border-border bg-charcoal shadow-card"
        >
          <div className="flex gap-0 overflow-x-auto border-b-2 border-white/10">
            {sdk.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative shrink-0 px-5 py-3.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/40 hover:text-white/70",
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 bg-primary-bright" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-start justify-between gap-4 px-5 py-4">
            {isQuickstart ? (
              <div className="m-0 flex-1 overflow-x-auto whitespace-pre-wrap text-left text-xs leading-relaxed text-white/85">
                {sdk.snippet}
              </div>
            ) : (
              <p className="flex-1 text-left text-sm text-white/85">
                <span className="text-white/50">$ </span>
                {current.command}
              </p>
            )}
            <button
              type="button"
              aria-label="Copy"
              onClick={handleCopy}
              className="shrink-0 cursor-pointer p-1 text-white/40 transition-colors hover:text-white"
            >
              {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={scrollViewport}
          variants={staggerContainer}
          className="mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-3"
        >
          {sdk.stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeInUp}
              className="border-2 border-border bg-background px-3 py-4 text-center shadow-soft"
            >
              <p className="text-xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
