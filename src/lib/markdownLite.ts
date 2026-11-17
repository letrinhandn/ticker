/** Minimal Markdown → HTML for the Marketpoly rulebook. */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(
    /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>',
  );
  return out;
}

function isTableSep(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(line.trim());
}

function parseTable(lines: string[], start: number): { html: string; next: number } {
  const rows: string[][] = [];
  let i = start;
  while (i < lines.length && lines[i]!.trim().startsWith("|")) {
    const raw = lines[i]!.trim();
    if (!isTableSep(raw)) {
      const cells = raw
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      rows.push(cells);
    }
    i += 1;
  }
  if (rows.length === 0) return { html: "", next: start + 1 };

  const [head, ...body] = rows;
  const thead = `<thead><tr>${head!
    .map((c) => `<th>${inline(c)}</th>`)
    .join("")}</tr></thead>`;
  const tbody =
    body.length > 0
      ? `<tbody>${body
          .map(
            (r) =>
              `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody>`
      : "";
  return { html: `<table>${thead}${tbody}</table>`, next: i };
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join(" ").replace(/ {2,}/g, " ").trim();
    if (text) parts.push(`<p>${inline(text)}</p>`);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === "") {
      flushPara();
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushPara();
      parts.push("<hr />");
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushPara();
      const level = heading[1]!.length;
      parts.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1]!)) {
      flushPara();
      const table = parseTable(lines, i);
      parts.push(table.html);
      i = table.next;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        quote.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i += 1;
      }
      parts.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      parts.push(
        `<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      parts.push(
        `<ol>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ol>`,
      );
      continue;
    }

    // Soft line break if line ends with two spaces
    if (line.endsWith("  ")) {
      para.push(`${trimmed}<br />`);
    } else {
      para.push(trimmed);
    }
    i += 1;
  }

  flushPara();
  return parts.join("\n");
}
