import { Hero } from "@/components/home/Hero";
import { ParadoxSection } from "@/components/home/ParadoxSection";
import { EngineSection } from "@/components/home/EngineSection";
import { UseCasesSection } from "@/components/home/UseCasesSection";
import { ComplianceCardSection } from "@/components/home/ComplianceCardSection";
import { SdkSection } from "@/components/home/SdkSection";
import { DeploymentCTA } from "@/components/home/DeploymentCTA";
import { FooterImageSection } from "@/components/home/FooterImageSection";

export function HomePage() {
  return (
    <div className="bg-background">
      <Hero />
      <ParadoxSection />
      <EngineSection />
      <ComplianceCardSection />
      <UseCasesSection />
      <SdkSection />
      <DeploymentCTA />
      <FooterImageSection />
    </div>
  );
}
