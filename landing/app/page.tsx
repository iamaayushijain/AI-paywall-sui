import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Problem } from "@/components/problem";
import { HowItWorks } from "@/components/how-it-works";
import { SDKs } from "@/components/sdks";
import { Features } from "@/components/features";
import { CodeInAction } from "@/components/code-in-action";
import { WhyBlockchain } from "@/components/why-blockchain";
import { Pricing } from "@/components/pricing";
import { FAQ } from "@/components/faq";
import { FinalCTA } from "@/components/final-cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <SDKs />
      <Features />
      <CodeInAction />
      <WhyBlockchain />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
