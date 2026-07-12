import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import OnboardingPageClient from "./onboarding-content";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <OnboardingPageClient />
    </Suspense>
  );
}
