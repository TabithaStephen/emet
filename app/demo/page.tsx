import { GuidedDemo } from "@/components/demo/guided-demo";

export const metadata = {
  title: "Guided demo — êmet",
  description:
    "A simulated walkthrough of êmet's brand governance workflow, using a fictional sample brand. No account required.",
};

/** Public: reachable without a session. See PUBLIC_PATHS in proxy.ts. */
export default function DemoPage() {
  return <GuidedDemo />;
}
