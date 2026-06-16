import { Hero } from "@/components/home/Hero";
import { ParadoxSection } from "@/components/home/ParadoxSection";
import { WhatItProvesSection } from "@/components/home/WhatItProvesSection";
import { EngineSection } from "@/components/home/EngineSection";
import { UseCasesSection } from "@/components/home/UseCasesSection";
import { ComplianceCardSection } from "@/components/home/ComplianceCardSection";
import { SdkSection } from "@/components/home/SdkSection";
import { DeploymentCTA } from "@/components/home/DeploymentCTA";
// import { CinematicFooter } from "@/components/home/CinematicFooter";

export function HomePage() {
  return (
    <div className="bg-background">
      <Hero />
      <ParadoxSection />
      <WhatItProvesSection />
      <EngineSection />
      <ComplianceCardSection />
      <UseCasesSection />
      <SdkSection />
      <DeploymentCTA />
      {/* <CinematicFooter /> */}
    </div>
  );
}
