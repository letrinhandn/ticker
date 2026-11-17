"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DeedCard } from "@/components/cards/DeedCard";
import {
  DeckCardBackFace,
  MarketNewsDeckCard,
  PriceReactionDeckCard,
} from "@/components/cards/DeckCards";
import { CornerDeedCard } from "@/components/cards/CornerDeedCard";
import { TaxCard } from "@/components/cards/TaxCard";
import { LanguageSetting } from "@/components/shell/LanguageSetting";
import { REGIME_CARDS } from "@/lib/game/content/regimes";
import { PRICE_REACTIONS } from "@/lib/game/content/priceReactions";
import { BALANCE } from "@/lib/game/balance/knobs";
import { useLocale, useT } from "@/lib/i18n";
import {
  tutorialCopy,
  type TutorialSectionId,
} from "./copy";
import { TutorialCardStage } from "./TutorialCardStage";
import { TutorialBoard } from "./TutorialBoard";
import { TutorialSectorBoard } from "./TutorialSectorBoard";

const COMPANY_TILE = 1;
const ETF_TILE = 5;

function pickNews(regime: "bull" | "bear") {
  return REGIME_CARDS.find((c) => c.regime === regime) ?? REGIME_CARDS[0]!;
}

function pickPr() {
  return PRICE_REACTIONS.find((c) => c.id === "PR-01") ?? PRICE_REACTIONS[0]!;
}

function SectionCards({
  id,
  labels,
  faceFront,
  faceBack,
}: {
  id: TutorialSectionId;
  labels: ReturnType<typeof tutorialCopy>["labels"];
  faceFront: string;
  faceBack: string;
}) {
  const t = useT();

  switch (id) {
    case "board":
      return <TutorialBoard />;
    case "sectors":
      return <TutorialSectorBoard />;
    case "company":
      return (
        <div className="tut-gallery is-pair is-deed-pair">
          <TutorialCardStage
            size="deed"
            label={`${labels.company} · ${faceFront}`}
          >
            <DeedCard
              tileIndex={COMPANY_TILE}
              forceFace="front"
              interactive={false}
            />
          </TutorialCardStage>
          <TutorialCardStage
            size="deed"
            label={`${labels.company} · ${faceBack}`}
          >
            <DeedCard
              tileIndex={COMPANY_TILE}
              forceFace="back"
              interactive={false}
            />
          </TutorialCardStage>
        </div>
      );
    case "etf":
      return (
        <div className="tut-gallery">
          <TutorialCardStage size="deed" label={labels.etf}>
            <DeedCard
              tileIndex={ETF_TILE}
              forceFace="front"
              interactive={false}
            />
          </TutorialCardStage>
        </div>
      );
    case "news":
      return (
        <div className="tut-gallery is-deck is-faces">
          <div className="tut-face-block">
            <p className="tut-face-title">{labels.newsBull}</p>
            <div className="tut-gallery is-pair">
              <TutorialCardStage size="deck" label={faceBack}>
                <article className="pcard pcard-shell pcard-news is-event tut-pcard tut-pcard-back">
                  <div className="pcard-flipper is-static-back">
                    <div className="pcard-face pcard-face-back is-static">
                      <DeckCardBackFace
                        variant="news"
                        label={t("deck.newsLabel")}
                      />
                    </div>
                  </div>
                </article>
              </TutorialCardStage>
              <TutorialCardStage size="deck" label={faceFront}>
                <MarketNewsDeckCard
                  className="is-event tut-pcard"
                  card={pickNews("bull")}
                  interactive={false}
                />
              </TutorialCardStage>
            </div>
          </div>
          <div className="tut-face-block">
            <p className="tut-face-title">{labels.newsBear}</p>
            <div className="tut-gallery is-pair">
              <TutorialCardStage size="deck" label={faceBack}>
                <article className="pcard pcard-shell pcard-news is-event tut-pcard tut-pcard-back">
                  <div className="pcard-flipper is-static-back">
                    <div className="pcard-face pcard-face-back is-static">
                      <DeckCardBackFace
                        variant="news"
                        label={t("deck.newsLabel")}
                      />
                    </div>
                  </div>
                </article>
              </TutorialCardStage>
              <TutorialCardStage size="deck" label={faceFront}>
                <MarketNewsDeckCard
                  className="is-event tut-pcard"
                  card={pickNews("bear")}
                  interactive={false}
                />
              </TutorialCardStage>
            </div>
          </div>
        </div>
      );
    case "pr":
      return (
        <div className="tut-gallery is-deck is-pair">
          <TutorialCardStage size="deck" label={`${labels.pr} · ${faceBack}`}>
            <article className="pcard pcard-shell pcard-pr is-event tut-pcard tut-pcard-back">
              <div className="pcard-flipper is-static-back">
                <div className="pcard-face pcard-face-back is-static">
                  <DeckCardBackFace
                    variant="pr"
                    label={t("deck.prLabel")}
                  />
                </div>
              </div>
            </article>
          </TutorialCardStage>
          <TutorialCardStage size="deck" label={`${labels.pr} · ${faceFront}`}>
            <PriceReactionDeckCard
              className="is-event tut-pcard"
              card={pickPr()}
              interactive={false}
            />
          </TutorialCardStage>
        </div>
      );
    case "start":
      return (
        <div className="tut-gallery">
          <TutorialCardStage size="corner" label="START">
            <CornerDeedCard variant="go" />
          </TutorialCardStage>
        </div>
      );
    case "weekend":
      return (
        <div className="tut-gallery">
          <TutorialCardStage size="corner" label={labels.weekend}>
            <CornerDeedCard variant="free" />
          </TutorialCardStage>
        </div>
      );
    case "tax":
      return (
        <div className="tut-gallery is-pair">
          <TutorialCardStage size="corner" label={labels.incomeTax}>
            <TaxCard amount={BALANCE.incomeTax} kind="income" />
          </TutorialCardStage>
          <TutorialCardStage size="corner" label={labels.wealthTax}>
            <TaxCard amount={BALANCE.wealthTax} kind="wealth" />
          </TutorialCardStage>
        </div>
      );
    case "sec":
      return (
        <div className="tut-gallery is-pair">
          <TutorialCardStage size="corner" label={labels.gotoSec}>
            <CornerDeedCard variant="goto_halt" />
          </TutorialCardStage>
          <TutorialCardStage size="corner" label={labels.sec}>
            <CornerDeedCard variant="halt" />
          </TutorialCardStage>
        </div>
      );
    default:
      return null;
  }
}

export function TutorialView() {
  const { locale } = useLocale();
  const t = useT();
  const copy = tutorialCopy(locale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  return (
    <main className="tut-page">
      <header className="tut-top">
        <Link href="/" className="brand-link tut-brand">
          {t("brand.name")}
        </Link>
        <div className="tut-top-actions">
          <LanguageSetting compact />
          <Link href="/" className="btn btn-ghost rb-back">
            ← {copy.back}
          </Link>
        </div>
      </header>

      <div className="tut-shell">
        <aside className="tut-nav" aria-label={copy.title}>
          <p className="tut-nav-title">{copy.title}</p>
          <ol className="tut-nav-list">
            {copy.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.nav}</a>
              </li>
            ))}
          </ol>
          <Link href="/" className="btn btn-primary tut-play">
            {copy.play}
          </Link>
        </aside>

        <article className="tut-body">
          <header className="tut-hero">
            <h1>{copy.title}</h1>
            <p>{copy.lead}</p>
            <p className="tut-hint">{copy.cardHint}</p>
          </header>

          {copy.sections.map((section) => (
            <section key={section.id} id={section.id} className="tut-section">
              <h2>{section.title}</h2>
              {section.body.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {mounted ? (
                <SectionCards
                  id={section.id}
                  labels={copy.labels}
                  faceFront={copy.faceFront}
                  faceBack={copy.faceBack}
                />
              ) : (
                <div className="tut-gallery-slot" aria-hidden />
              )}
            </section>
          ))}

          <footer className="tut-foot">
            <Link href="/" className="btn btn-primary">
              {copy.play}
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}
