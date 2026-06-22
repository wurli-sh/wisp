import { Hero } from "@/components/home/Hero";
import { ParadoxSection } from "@/components/home/ParadoxSection";
import { EngineSection } from "@/components/home/EngineSection";
import { WispPayShowcaseSection } from "@/components/home/WispPayShowcaseSection";
import { UseCasesSection } from "@/components/home/UseCasesSection";
import { SdkSection } from "@/components/home/SdkSection";
import { DeploymentCTA } from "@/components/home/DeploymentCTA";
import { LaunchVideoSection } from "@/components/home/LaunchVideoSection";

export function HomePage() {
  return (
    <div className="bg-background">
      <Hero />
      <ParadoxSection />
      <EngineSection />
      <WispPayShowcaseSection />
      <UseCasesSection />
      <SdkSection />
      <DeploymentCTA />
      <LaunchVideoSection />
    </div>
  );
}
