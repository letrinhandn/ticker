import type { Metadata } from "next";
import { TutorialView } from "@/components/tutorial/TutorialView";

export const metadata: Metadata = {
  title: "How to play | TICKER",
  description:
    "Newcomer tutorial for TICKER with real in-game cards and the full rule flow.",
};

export default function TutorialPage() {
  return <TutorialView />;
}
