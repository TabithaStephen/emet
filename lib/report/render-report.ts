"use client";

import { readPalette, severityColour, type PdfPalette, type Rgb } from "@/lib/report/pdf-theme";
import { SEVERITY_ORDER } from "@/lib/types";
import type { ReportModel } from "@/lib/report/report-model";

/**
 * Draws the audit report as a PDF, in the Midnight Luxury identity.
 *
 * Everything it draws comes from the `ReportModel` it is handed, which is built
 * from a real audit — there is no sample content anywhere in this file, so a
 * report cannot show anything the audit did not produce.
 *
 * jsPDF is imported dynamically so roughly 350KB of library stays out of the
 * main bundle and is fetched only when someone actually exports a report.
 */

/* ---- page geometry (A4 portrait, millimetres) -------------------------- */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 14;

/**
 * jsPDF's built-in fonts use WinAnsi, which covers Latin-1 but not the
 * typographic characters that copy routinely contains. Left unmapped these
 * render as mojibake, so they are folded to their nearest WinAnsi equivalent.
 * Accented Latin-1 — the ê in êmet, £, § — passes through untouched.
 */
function winAnsiSafe(value: string): string {
  return value
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●]/g, "-")
    .replace(/ /g, " ")
    .replace(/[  ​ ]/g, "")
    .replace(/→/g, "->")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    // Anything still outside Latin-1 cannot be drawn by a standard font.
    .replace(/[^\u0000-ÿ]/g, "?");
}

type Doc = import("jspdf").jsPDF;

/** Drawing state carried between helpers. */
interface Ctx {
  doc: Doc;
  palette: PdfPalette;
  y: number;
  page: number;
  model: ReportModel;
}

function setFill(ctx: Ctx, [r, g, b]: Rgb) {
  ctx.doc.setFillColor(r, g, b);
}
function setText(ctx: Ctx, [r, g, b]: Rgb) {
  ctx.doc.setTextColor(r, g, b);
}
function setDraw(ctx: Ctx, [r, g, b]: Rgb) {
  ctx.doc.setDrawColor(r, g, b);
}

/** Paints the dark canvas and the footer. Called for every page. */
function paintPage(ctx: Ctx) {
  setFill(ctx, ctx.palette.background);
  ctx.doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Footer hairline and running text.
  setDraw(ctx, ctx.palette.border);
  ctx.doc.setLineWidth(0.2);
  ctx.doc.line(MARGIN, PAGE_H - FOOTER_H, PAGE_W - MARGIN, PAGE_H - FOOTER_H);

  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(7.5);
  setText(ctx, ctx.palette.foregroundMuted);
  ctx.doc.text(
    winAnsiSafe(`êmet · ${ctx.model.brandName} · ${ctx.model.title}`),
    MARGIN,
    PAGE_H - FOOTER_H + 5.5,
    { maxWidth: CONTENT_W - 30 },
  );
  ctx.doc.text(String(ctx.page), PAGE_W - MARGIN, PAGE_H - FOOTER_H + 5.5, {
    align: "right",
  });
}

function newPage(ctx: Ctx) {
  ctx.doc.addPage();
  ctx.page += 1;
  paintPage(ctx);
  ctx.y = MARGIN + 4;
}

/** Starts a new page when `needed` millimetres will not fit. */
function ensure(ctx: Ctx, needed: number) {
  if (ctx.y + needed > PAGE_H - FOOTER_H - 4) newPage(ctx);
}

/** Wrapped paragraph. Returns the height drawn. */
function paragraph(
  ctx: Ctx,
  text: string,
  options: {
    size?: number;
    style?: "normal" | "bold" | "italic";
    colour?: Rgb;
    lineHeight?: number;
    x?: number;
    width?: number;
  } = {},
): number {
  const {
    size = 9,
    style = "normal",
    colour = ctx.palette.foreground,
    lineHeight = 1.45,
    x = MARGIN,
    width = CONTENT_W,
  } = options;

  ctx.doc.setFont("helvetica", style);
  ctx.doc.setFontSize(size);
  setText(ctx, colour);

  const lines = ctx.doc.splitTextToSize(winAnsiSafe(text), width) as string[];
  const step = (size * lineHeight) / 2.835; // pt -> mm

  for (const line of lines) {
    ensure(ctx, step);
    ctx.doc.text(line, x, ctx.y + step * 0.75);
    ctx.y += step;
  }
  return lines.length * step;
}

/** Section heading with the gold eyebrow rule used throughout the app. */
function sectionHeading(ctx: Ctx, eyebrow: string, title: string) {
  ensure(ctx, 24);
  ctx.y += 8;

  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(6.5);
  setText(ctx, ctx.palette.accent);
  ctx.doc.text(winAnsiSafe(eyebrow.toUpperCase()), MARGIN, ctx.y, { charSpace: 0.5 });
  ctx.y += 4.5;

  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(14);
  setText(ctx, ctx.palette.foreground);
  ctx.doc.text(winAnsiSafe(title), MARGIN, ctx.y);
  ctx.y += 3;

  setDraw(ctx, ctx.palette.border);
  ctx.doc.setLineWidth(0.2);
  ctx.doc.line(MARGIN, ctx.y, PAGE_W - MARGIN, ctx.y);
  ctx.y += 5;
}

/** A filled panel behind a block of content, like the app's Panel surface. */
function panel(ctx: Ctx, height: number, tint: Rgb = ctx.palette.surface) {
  setFill(ctx, tint);
  setDraw(ctx, ctx.palette.border);
  ctx.doc.setLineWidth(0.2);
  ctx.doc.roundedRect(MARGIN, ctx.y, CONTENT_W, height, 1.5, 1.5, "FD");
}

/* ---- the masthead ------------------------------------------------------ */

function drawMasthead(ctx: Ctx) {
  const { model, palette } = ctx;

  setFill(ctx, palette.backgroundSecondary);
  ctx.doc.rect(0, 0, PAGE_W, 46, "F");

  // Champagne hairline under the band.
  setFill(ctx, palette.accent);
  ctx.doc.rect(0, 46, PAGE_W, 0.6, "F");

  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(24);
  setText(ctx, palette.foreground);
  ctx.doc.text(winAnsiSafe("êmet"), MARGIN, 22);

  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(7);
  setText(ctx, palette.accent);
  ctx.doc.text("BRAND COMPLIANCE AUDIT", MARGIN, 29, { charSpace: 1.2 });

  // Brand and date, right-aligned.
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(11);
  setText(ctx, palette.foreground);
  ctx.doc.text(winAnsiSafe(model.brandName), PAGE_W - MARGIN, 20, { align: "right" });

  ctx.doc.setFontSize(8);
  setText(ctx, palette.foregroundMuted);
  ctx.doc.text(winAnsiSafe(model.createdAtLabel), PAGE_W - MARGIN, 26, { align: "right" });
  ctx.doc.text(winAnsiSafe(model.engineLabel), PAGE_W - MARGIN, 31, { align: "right" });

  ctx.y = 56;

  // Submission title.
  paragraph(ctx, model.title, { size: 17, colour: palette.foreground });
  ctx.y += 1;
  paragraph(ctx, `${model.channel} · ${model.wordCount} words · ${model.statusLabel}`, {
    size: 8.5,
    colour: palette.foregroundMuted,
  });
  ctx.y += 4;
}

/* ---- score ------------------------------------------------------------- */

function drawScore(ctx: Ctx) {
  const { model, palette } = ctx;
  const H = 40;
  ensure(ctx, H + 4);
  panel(ctx, H);

  const top = ctx.y;
  const scoreColour =
    model.score >= 90 ? palette.positive : model.score >= 70 ? palette.gold : palette.critical;

  // The number.
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(34);
  setText(ctx, scoreColour);
  ctx.doc.text(String(model.score), MARGIN + 10, top + 22);

  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(7);
  setText(ctx, palette.foregroundMuted);
  ctx.doc.text("COMPLIANCE SCORE", MARGIN + 10, top + 29, { charSpace: 0.6 });

  // Verdict and meter.
  const x = MARGIN + 52;
  const w = CONTENT_W - 62;

  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(11);
  setText(ctx, palette.foreground);
  ctx.doc.text(winAnsiSafe(model.verdict), x, top + 12, { maxWidth: w });

  // Track and fill.
  setFill(ctx, palette.surfaceElevated);
  ctx.doc.roundedRect(x, top + 17, w, 2.4, 1.2, 1.2, "F");
  setFill(ctx, scoreColour);
  const filled = Math.max(2.4, (w * Math.min(100, Math.max(0, model.score))) / 100);
  ctx.doc.roundedRect(x, top + 17, filled, 2.4, 1.2, 1.2, "F");

  // Severity counts, always with their written labels — severity never
  // travels on colour alone.
  let cx = x;
  ctx.doc.setFontSize(7.5);
  for (const severity of SEVERITY_ORDER) {
    const count = model.counts[severity];
    const label = `${count} ${severity}`;
    setFill(ctx, severityColour(severity, palette));
    ctx.doc.circle(cx + 1.2, top + 26.5, 1.2, "F");
    setText(ctx, count > 0 ? palette.foreground : palette.foregroundMuted);
    ctx.doc.text(winAnsiSafe(label), cx + 4, top + 27.5);
    cx += ctx.doc.getTextWidth(winAnsiSafe(label)) + 11;
  }

  ctx.y = top + H + 6;
}

/* ---- findings ---------------------------------------------------------- */

function drawFinding(ctx: Ctx, finding: ReportModel["findings"][number]) {
  const { palette } = ctx;
  const colour = severityColour(finding.severity, palette);

  // Measure first so a card is never split across a page break mid-header.
  ensure(ctx, 34);

  const top = ctx.y;
  ctx.y += 5;

  // Severity chip, with its written label.
  const chipLabel = finding.severityLabel.toUpperCase();
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(6.5);
  const chipW = ctx.doc.getTextWidth(chipLabel) + 6;
  setFill(ctx, colour);
  ctx.doc.roundedRect(MARGIN + 4, ctx.y - 3.2, chipW, 4.6, 0.8, 0.8, "F");
  setText(ctx, palette.background);
  ctx.doc.text(chipLabel, MARGIN + 7, ctx.y, { charSpace: 0.4 });

  // Number and title.
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(10);
  setText(ctx, palette.foreground);
  ctx.doc.text(
    winAnsiSafe(`${finding.number}. ${finding.title}`),
    MARGIN + 8 + chipW,
    ctx.y,
    { maxWidth: CONTENT_W - 16 - chipW },
  );
  ctx.y += 6;

  const inner = { x: MARGIN + 6, width: CONTENT_W - 12 };

  // The offending text, quoted exactly as submitted.
  if (finding.phrase) {
    paragraph(ctx, `"${finding.phrase}"`, {
      size: 9,
      style: "italic",
      colour,
      ...inner,
    });
    if (!finding.located) {
      paragraph(ctx, "(not located verbatim in the draft, so not highlighted)", {
        size: 7,
        colour: palette.foregroundMuted,
        ...inner,
      });
    }
    ctx.y += 1.5;
  }

  paragraph(ctx, finding.explanation, { size: 8.5, colour: palette.foreground, ...inner });
  ctx.y += 1.5;

  paragraph(ctx, `Guideline breached: ${finding.guideline}`, {
    size: 8,
    colour: palette.silver,
    ...inner,
  });
  ctx.y += 1;

  paragraph(ctx, `Suggested correction: ${finding.suggestion}`, {
    size: 8.5,
    colour: palette.positive,
    ...inner,
  });

  ctx.y += 4;

  // Severity rule down the left edge, drawn last now the height is known.
  setFill(ctx, colour);
  ctx.doc.rect(MARGIN, top, 0.9, ctx.y - top - 2, "F");
  ctx.y += 2;
}

function drawFindings(ctx: Ctx) {
  const { model, palette } = ctx;
  sectionHeading(
    ctx,
    "Findings",
    model.findings.length === 0
      ? "No findings"
      : `${model.findings.length} finding${model.findings.length === 1 ? "" : "s"}`,
  );

  if (model.findings.length === 0) {
    ensure(ctx, 20);
    panel(ctx, 16, ctx.palette.backgroundSecondary);
    ctx.y += 6;
    paragraph(ctx, "This submission raised no findings against the brand rules in force at the time of the audit.", {
      size: 9,
      colour: palette.positive,
      x: MARGIN + 6,
      width: CONTENT_W - 12,
    });
    ctx.y += 6;
    return;
  }

  for (const finding of model.findings) drawFinding(ctx, finding);

  if (model.unlocated > 0) {
    ctx.y += 2;
    paragraph(
      ctx,
      `${model.unlocated} finding${model.unlocated === 1 ? "" : "s"} could not be matched to exact text in the draft, so ${model.unlocated === 1 ? "it is" : "they are"} listed above without a verbatim quotation.`,
      { size: 7.5, colour: palette.foregroundMuted },
    );
  }
}

/* ---- the document ------------------------------------------------------ */

export async function renderAuditReport(model: ReportModel): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({
    title: `${model.brandName} - brand compliance audit`,
    subject: model.title,
    creator: "emet",
  });

  const ctx: Ctx = { doc, palette: readPalette(), y: MARGIN, page: 1, model };

  paintPage(ctx);
  drawMasthead(ctx);
  drawScore(ctx);

  // The reviewer's summary, when the engine produced one.
  if (model.summary) {
    sectionHeading(ctx, "Reviewer summary", "Overall assessment");
    paragraph(ctx, model.summary, { size: 9.5, colour: ctx.palette.foreground });
    ctx.y += 2;
  }

  drawFindings(ctx);

  /* Approval status — the human decision, where one has been made. */
  sectionHeading(ctx, "Approval", "Review status");
  paragraph(ctx, model.statusLabel, { size: 10, colour: ctx.palette.foreground });
  if (model.reviewedAtLabel) {
    paragraph(ctx, `Decided ${model.reviewedAtLabel}.`, {
      size: 8,
      colour: ctx.palette.foregroundMuted,
    });
  }
  if (model.reviewNote) {
    ctx.y += 2;
    paragraph(ctx, `Reviewer note: ${model.reviewNote}`, {
      size: 8.5,
      colour: ctx.palette.silver,
    });
  }
  ctx.y += 2;

  /* How the score was reached. Computed by êmet, never asked of the model. */
  sectionHeading(ctx, "Method", "How this score was calculated");
  paragraph(ctx, model.scoreRationale, { size: 8.5, colour: ctx.palette.foregroundMuted });
  ctx.y += 1;
  paragraph(
    ctx,
    model.isAi
      ? "The findings above were produced by a language model reviewing the content against the brand rules. The score itself is arithmetic applied by êmet to those findings, not a number supplied by the model, so it is reproducible."
      : "These findings come from êmet's built-in rule check, which matches the brand rules literally. This is NOT an AI review.",
    { size: 7.5, colour: ctx.palette.foregroundMuted },
  );

  /* The submitted content, in full, exactly as audited. */
  sectionHeading(ctx, "Appendix", "Content as submitted");
  paragraph(ctx, model.content || "(no content recorded)", {
    size: 8.5,
    colour: ctx.palette.silver,
    lineHeight: 1.5,
  });

  ctx.y += 4;
  paragraph(ctx, `Report generated ${model.generatedAtLabel}.`, {
    size: 7,
    colour: ctx.palette.foregroundMuted,
  });

  return doc.output("blob");
}

/** Renders the report and hands it to the browser as a download. */
export async function downloadAuditReport(model: ReportModel): Promise<void> {
  const blob = await renderAuditReport(model);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = model.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
