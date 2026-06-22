import { Hero } from "@/components/home/Hero";
import { ParadoxSection } from "@/components/home/ParadoxSection";
import { EngineSection } from "@/components/home/EngineSection";
import { LaunchVideoSection } from "@/components/home/LaunchVideoSection";
import { UseCasesSection } from "@/components/home/UseCasesSection";
import { WispPayShowcaseSection } from "@/components/home/WispPayShowcaseSection";
import { SdkSection } from "@/components/home/SdkSection";
import { DeploymentCTA } from "@/components/home/DeploymentCTA";
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
