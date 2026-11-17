import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { markdownToHtml } from "@/lib/markdownLite";

export const metadata: Metadata = {
  title: "Rulebook | TICKER",
  description: "TICKER / Cờ chứng khoán. Luật chơi nhanh",
};

async function loadRulebookHtml() {
  "use cache";
  const md = await readFile(
    path.join(process.cwd(), "docs/rulebook/MARKETPOLY_RULEBOOK_V5.md"),
    "utf8",
  );
  return markdownToHtml(md);
}

export default async function RulesPage() {
  const html = await loadRulebookHtml();

  return (
    <main className="rb-page">
      <header className="rb-top">
        <a href="/" className="brand-link">
          TICKER
        </a>
        <a href="/" className="btn btn-ghost rb-back">
          ← Back
        </a>
      </header>
      <article
        className="rb-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
