import { jsPDF } from "jspdf";

import { apiClient } from "@/lib/api/client";
import type { ConversationMessage, EvidenceListItem, IncidentDetail } from "@/lib/api/types";

const PAGE = {
  margin: 42,
  width: 595.28,
  height: 841.89,
  footerY: 818,
};

const COLORS = {
  ink: [15, 23, 42] as Color,
  muted: [100, 116, 139] as Color,
  softInk: [51, 65, 85] as Color,
  line: [226, 232, 240] as Color,
  panel: [248, 250, 252] as Color,
  warningPanel: [255, 247, 237] as Color,
  warningBorder: [251, 146, 60] as Color,
  danger: [185, 28, 28] as Color,
  brand: [43, 24, 83] as Color,
  teal: [0, 127, 142] as Color,
};

type Color = [number, number, number];

type PdfContext = {
  doc: jsPDF;
  y: number;
  pageNumber: number;
};

type IncidentReportInput = {
  incident: IncidentDetail;
  evidence: EvidenceListItem[];
  evidenceAccessCode?: string;
};

type TextOptions = {
  size?: number;
  bold?: boolean;
  color?: Color;
  width?: number;
  x?: number;
  lineGap?: number;
  align?: "left" | "center" | "right";
};

type AiObservationSummary = {
  visibleArea?: string;
  imageQuality?: string;
  visibleMarks?: string;
  colorPattern?: string;
  shapeDistribution?: string;
  concerningSigns?: string;
  recommendedFollowUp?: string;
  aiConfidence?: string;
  limitations?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function formatEnumLabel(value?: string | null) {
  if (!value) {
    return "";
  }
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConfidence(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  if (numeric <= 0) {
    return "Low / not reliable";
  }
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  if (percent < 35) {
    return `Low (${percent.toFixed(0)}%)`;
  }
  if (percent < 70) {
    return `Moderate (${percent.toFixed(0)}%)`;
  }
  return `High (${percent.toFixed(0)}%)`;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortenId(value?: string | null) {
  if (!value) {
    return "";
  }
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function safeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => safeText(item)).filter(Boolean).join(", ");
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function hideEmpty(value: unknown) {
  const text = safeText(value).toLowerCase();
  return !text || text === "unknown" || text === "n/a" || text === "null" || text === "undefined";
}

function dedupeRepeatedSentences(value?: string | null) {
  const text = safeText(value);
  if (!text) {
    return "";
  }
  const seen = new Set<string>();
  const parts: string[] = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part: string) => part.trim())
    .filter(Boolean);

  return parts
    .filter((part: string) => {
      const key = part.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(" ");
}

function normalizeAiObservation(evidence: EvidenceListItem): AiObservationSummary {
  const raw = dedupeRepeatedSentences([evidence.aiSummary, evidence.caption, evidence.description].filter(Boolean).join(". "));
  const confidence = typeof evidence.aiConfidence === "number" ? evidence.aiConfidence : null;
  const status = safeText(evidence.aiAnalysisStatus).toLowerCase();
  const lower = raw.toLowerCase();
  const failed =
    confidence === 0 ||
    status.includes("fail") ||
    status.includes("error") ||
    lower.includes("could not be analyzed") ||
    lower.includes("could not reliably analyze") ||
    lower.includes("cannot be determined");

  if (failed) {
    return {
      visibleArea: "Visible area could not be identified reliably.",
      recommendedFollowUp: "Urgency cannot be determined from image analysis alone.",
      aiConfidence: "Low / not reliable",
      limitations:
        "The AI system could not reliably analyze the image. A human reviewer should inspect the original evidence and ask the care seeker for context.",
    };
  }

  const summary: AiObservationSummary = {
    aiConfidence: formatConfidence(confidence),
  };

  const lines: string[] = raw
    .split(/(?:\n+|;\s+|\. (?=[A-Z]))/)
    .map((line: string) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  for (const line of lines) {
    const cleaned = line.replace(/^(visible area|body area|image quality|visible marks|marks|color|pattern|shape|distribution|concerning signs|recommended follow-up|limitations|urgent care recommended)\s*:\s*/i, "").trim();
    const key = line.toLowerCase();

    if (key.includes("body area") || key.includes("visible area")) {
      summary.visibleArea = fallbackDisplay(summary.visibleArea, cleaned);
    } else if (key.includes("quality") || key.includes("blur") || key.includes("lighting")) {
      summary.imageQuality = fallbackDisplay(summary.imageQuality, cleaned);
    } else if (key.includes("mark") || key.includes("injur") || key.includes("bruise") || key.includes("wound")) {
      summary.visibleMarks = fallbackDisplay(summary.visibleMarks, cleaned);
    } else if (key.includes("color") || key.includes("pattern")) {
      summary.colorPattern = fallbackDisplay(summary.colorPattern, cleaned);
    } else if (key.includes("shape") || key.includes("distribution")) {
      summary.shapeDistribution = fallbackDisplay(summary.shapeDistribution, cleaned);
    } else if (key.includes("concern") || key.includes("risk") || key.includes("red flag")) {
      summary.concerningSigns = fallbackDisplay(summary.concerningSigns, cleaned);
    } else if (key.includes("follow") || key.includes("medical") || key.includes("care") || key.includes("urgent")) {
      summary.recommendedFollowUp = fallbackDisplay(summary.recommendedFollowUp, cleaned);
    } else if (key.includes("limit") || key.includes("cannot") || key.includes("unable")) {
      summary.limitations = fallbackDisplay(summary.limitations, cleaned);
    }
  }

  if (!summary.visibleMarks && raw) {
    summary.visibleMarks = raw.length > 280 ? `${raw.slice(0, 277).trim()}...` : raw;
  }
  if (!summary.limitations) {
    summary.limitations = "AI observations are assistive only and must not replace professional review.";
  }

  return summary;
}

function fallbackDisplay(current: string | undefined, next: string) {
  if (hideEmpty(next)) {
    return current;
  }
  return current ? `${current}; ${next}` : next;
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function timestampForFileName() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function contentWidth() {
  return PAGE.width - PAGE.margin * 2;
}

function setColor(doc: jsPDF, color: Color) {
  doc.setTextColor(...color);
}

function addFooter(ctx: PdfContext) {
  const { doc, pageNumber } = ctx;
  doc.setDrawColor(...COLORS.line);
  doc.line(PAGE.margin, PAGE.footerY - 18, PAGE.width - PAGE.margin, PAGE.footerY - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(doc, COLORS.muted);
  doc.text("SakhiSafe Confidential Case Incident Report", PAGE.margin, PAGE.footerY);
  doc.text(`Page ${pageNumber}`, PAGE.width - PAGE.margin, PAGE.footerY, { align: "right" });
}

function addPage(ctx: PdfContext) {
  addFooter(ctx);
  ctx.doc.addPage();
  ctx.pageNumber += 1;
  ctx.y = PAGE.margin;
}

function ensureSpace(ctx: PdfContext, needed: number) {
  if (ctx.y + needed > PAGE.footerY - 28) {
    addPage(ctx);
  }
}

function textLines(doc: jsPDF, text: string, width = contentWidth()) {
  return doc.splitTextToSize(text || "-", width) as string[];
}

function measureTextHeight(ctx: PdfContext, text: string, options: TextOptions = {}) {
  const size = options.size ?? 10;
  const lines = textLines(ctx.doc, text, options.width ?? contentWidth());
  return lines.length * size * 1.35;
}

function writeText(ctx: PdfContext, text: string, options: TextOptions = {}) {
  const { doc } = ctx;
  const size = options.size ?? 10;
  const x = options.x ?? PAGE.margin;
  const width = options.width ?? contentWidth();
  const lines = textLines(doc, text, width);
  const lineHeight = size * 1.35;
  ensureSpace(ctx, lines.length * lineHeight + (options.lineGap ?? 8));
  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(size);
  setColor(doc, options.color ?? COLORS.ink);
  doc.text(lines, x, ctx.y, { align: options.align ?? "left" });
  ctx.y += lines.length * lineHeight + (options.lineGap ?? 8);
}

function sectionHeading(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 44);
  ctx.doc.setDrawColor(...COLORS.line);
  ctx.doc.line(PAGE.margin, ctx.y, PAGE.width - PAGE.margin, ctx.y);
  ctx.y += 18;
  writeText(ctx, title, { size: 14, bold: true, color: COLORS.brand, lineGap: 8 });
}

function drawBox(ctx: PdfContext, height: number, fill: Color, border: Color = COLORS.line) {
  const { doc } = ctx;
  ensureSpace(ctx, height);
  doc.setFillColor(...fill);
  doc.setDrawColor(...border);
  doc.roundedRect(PAGE.margin, ctx.y, contentWidth(), height, 6, 6, "FD");
}

function writeKeyValueGrid(ctx: PdfContext, rows: Array<[string, unknown]>, columns = 2) {
  const visibleRows = rows.filter(([, value]) => !hideEmpty(value));
  if (!visibleRows.length) {
    return;
  }
  const gap = 12;
  const colWidth = (contentWidth() - gap * (columns - 1)) / columns;
  const rowHeights: number[] = [];

  for (let i = 0; i < visibleRows.length; i += columns) {
    const row = visibleRows.slice(i, i + columns);
    rowHeights.push(Math.max(...row.map(([label, value]) => measureTextHeight(ctx, `${label}\n${safeText(value)}`, { width: colWidth - 18, size: 9 }))) + 20);
  }

  visibleRows.forEach((item, index) => {
    const rowIndex = Math.floor(index / columns);
    const colIndex = index % columns;
    const isNewRow = colIndex === 0;
    const rowHeight = rowHeights[rowIndex];

    if (isNewRow) {
      ensureSpace(ctx, rowHeight + 8);
    }

    const x = PAGE.margin + colIndex * (colWidth + gap);
    const y = ctx.y;
    ctx.doc.setFillColor(...COLORS.panel);
    ctx.doc.setDrawColor(...COLORS.line);
    ctx.doc.roundedRect(x, y, colWidth, rowHeight, 5, 5, "FD");
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setFontSize(8);
    setColor(ctx.doc, COLORS.muted);
    ctx.doc.text(item[0], x + 9, y + 15);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setFontSize(9.5);
    setColor(ctx.doc, COLORS.ink);
    ctx.doc.text(textLines(ctx.doc, safeText(item[1]), colWidth - 18), x + 9, y + 31);

    if (colIndex === columns - 1 || index === visibleRows.length - 1) {
      ctx.y += rowHeight + 8;
    }
  });
}

function writeParagraphBlock(ctx: PdfContext, title: string, text?: string | null) {
  if (hideEmpty(text)) {
    return;
  }
  ensureSpace(ctx, 42);
  writeText(ctx, title, { size: 10, bold: true, color: COLORS.softInk, lineGap: 3 });
  writeText(ctx, dedupeRepeatedSentences(text), { size: 10, color: COLORS.ink, lineGap: 10 });
}

function buildReportHeader(ctx: PdfContext, incident: IncidentDetail, generatedAt: string) {
  const { doc } = ctx;
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, PAGE.width, 138, "F");
  doc.setFillColor(...COLORS.teal);
  doc.rect(0, 132, PAGE.width, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("SakhiSafe", PAGE.margin, 40);
  doc.setFontSize(21);
  doc.text("Confidential Case Incident Report", PAGE.margin, 68);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Generated: ${generatedAt}`, PAGE.margin, 92);
  doc.text(`Incident reference: ${shortenId(incident.id)}`, PAGE.margin, 110);
  doc.setFont("helvetica", "bold");
  doc.text("CONFIDENTIAL - AUTHORIZED REVIEW ONLY", PAGE.width - PAGE.margin, 40, { align: "right" });
  ctx.y = 162;

  drawBox(ctx, 62, COLORS.warningPanel, COLORS.warningBorder);
  ctx.y += 18;
  writeText(
    ctx,
    "This report contains system-recorded and AI-assisted information. It must be reviewed by authorized personnel before legal, medical, or official use.",
    { x: PAGE.margin + 16, width: contentWidth() - 32, size: 9.5, color: COLORS.softInk, lineGap: 20 },
  );
}

function buildRiskSnapshot(ctx: PdfContext, incident: IncidentDetail) {
  sectionHeading(ctx, "Critical Risk Snapshot");
  const highRisk = incident.severity === "CRITICAL" || incident.urgency === "IMMEDIATE" || incident.needsHumanReview;
  drawBox(ctx, 126, highRisk ? COLORS.warningPanel : COLORS.panel, highRisk ? COLORS.warningBorder : COLORS.line);
  const startY = ctx.y + 18;
  ctx.y = startY;
  writeKeyValueGrid(
    ctx,
    [
      ["Severity", formatEnumLabel(incident.severity)],
      ["Urgency", formatEnumLabel(incident.urgency)],
      ["Current status", formatEnumLabel(incident.status)],
      ["Needs human review", incident.needsHumanReview ? "Yes" : "No"],
      ["Immediate safety concern", incident.urgency === "IMMEDIATE" || incident.severity === "CRITICAL" ? "Yes - prioritize human review" : "Not indicated by current record"],
      ["Category", formatEnumLabel(incident.category)],
      ["Source", formatEnumLabel(incident.source)],
    ],
    2,
  );
  ctx.y = Math.max(ctx.y, startY + 108);
}

function buildIncidentSummary(ctx: PdfContext, incident: IncidentDetail) {
  sectionHeading(ctx, "Incident Summary");
  writeKeyValueGrid(ctx, [
    ["Title", incident.title],
    ["Incident date/time", incident.incidentDateText],
    ["Location", incident.locationText],
    ["Perpetrator relation", incident.perpetratorRelation],
    ["Risk signals", incident.riskSignals],
  ]);
  writeParagraphBlock(ctx, "Short summary", incident.summary);
  writeParagraphBlock(ctx, "Detailed description", incident.description);
  writeParagraphBlock(ctx, "Case note", incident.caseNote);
}

function buildCareSeekerSection(ctx: PdfContext, incident: IncidentDetail) {
  sectionHeading(ctx, "Care Seeker Details");
  writeKeyValueGrid(ctx, [
    ["Display name", incident.careSeeker?.displayName],
    ["Phone number", incident.careSeeker?.phoneNumber],
    ["WhatsApp number", incident.careSeeker?.whatsappPhoneNumber],
    ["Care seeker status", formatEnumLabel(incident.careSeeker?.status)],
    ["Source", formatEnumLabel(incident.careSeeker?.source)],
    ["Session status", formatEnumLabel(incident.conversationSession?.status)],
    ["Session started", formatDateTime(incident.conversationSession?.startedAt)],
    ["Last message", formatDateTime(incident.conversationSession?.lastMessageAt)],
  ]);
}

function messageLabel(message: ConversationMessage) {
  if (message.direction === "OUTBOUND") {
    return "Assistant Response";
  }
  return "Care Seeker Message";
}

function buildConversationTimeline(ctx: PdfContext, messages: ConversationMessage[]) {
  sectionHeading(ctx, "Conversation Timeline");
  if (!messages.length) {
    writeText(ctx, "No conversation messages are linked to this incident.", { color: COLORS.muted });
    return;
  }

  messages.forEach((message, index) => {
    const messageText = safeText(message.messageText) || (message.messageType === "IMAGE" ? "Image evidence received." : "No message text recorded.");
    const cardHeight = Math.max(78, measureTextHeight(ctx, messageText, { width: contentWidth() - 28, size: 9.5 }) + 56);
    ensureSpace(ctx, cardHeight + 10);
    ctx.doc.setFillColor(255, 255, 255);
    ctx.doc.setDrawColor(...COLORS.line);
    ctx.doc.roundedRect(PAGE.margin, ctx.y, contentWidth(), cardHeight, 6, 6, "FD");
    const y = ctx.y + 16;
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setFontSize(10);
    setColor(ctx.doc, message.direction === "INBOUND" ? COLORS.teal : COLORS.brand);
    ctx.doc.text(`${index + 1}. ${messageLabel(message)}`, PAGE.margin + 12, y);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setFontSize(8.5);
    setColor(ctx.doc, COLORS.muted);
    ctx.doc.text(`${formatEnumLabel(message.messageType)} - ${formatDateTime(message.createdAt)}`, PAGE.width - PAGE.margin - 12, y, { align: "right" });
    ctx.doc.setFontSize(9.5);
    setColor(ctx.doc, COLORS.ink);
    ctx.doc.text(textLines(ctx.doc, messageText, contentWidth() - 28), PAGE.margin + 12, y + 22);
    const meta = [`Msg ${shortenId(message.id)}`, message.evidenceId ? `Evidence ${shortenId(message.evidenceId)}` : "", message.mediaId ? `Media ${shortenId(message.mediaId)}` : ""].filter(Boolean).join(" | ");
    if (meta) {
      ctx.doc.setFontSize(8);
      setColor(ctx.doc, COLORS.muted);
      ctx.doc.text(meta, PAGE.margin + 12, ctx.y + cardHeight - 12);
    }
    ctx.y += cardHeight + 10;
  });
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchEvidenceImage(evidenceId: string, evidenceAccessCode?: string) {
  const response = await apiClient.get(`/admin/v1/evidence/${evidenceId}/file`, {
    responseType: "blob",
    headers: evidenceAccessCode ? { "x-evidence-access-code": evidenceAccessCode } : undefined,
  });
  return blobToDataUrl(response.data);
}

function imageFormat(mimeType: string) {
  return mimeType.toLowerCase().includes("png") ? "PNG" : "JPEG";
}

function buildAiObservationSummary(ctx: PdfContext, evidence: EvidenceListItem) {
  const summary = normalizeAiObservation(evidence);
  const rows: Array<[string, unknown]> = [
    ["Visible area", summary.visibleArea],
    ["Image quality", summary.imageQuality],
    ["Visible marks", summary.visibleMarks],
    ["Color/pattern", summary.colorPattern],
    ["Shape/distribution", summary.shapeDistribution],
    ["Concerning signs", summary.concerningSigns],
    ["Recommended follow-up", summary.recommendedFollowUp],
    ["AI confidence", summary.aiConfidence],
    ["Limitations", summary.limitations],
  ];
  writeKeyValueGrid(ctx, rows, 1);
}

async function buildImageEvidenceBlock(ctx: PdfContext, evidence: EvidenceListItem, index: number, evidenceAccessCode?: string) {
  sectionHeading(ctx, `Evidence ${index + 1}`);
  writeKeyValueGrid(ctx, [
    ["Evidence type", formatEnumLabel(evidence.evidenceType)],
    ["Uploaded by", formatEnumLabel(evidence.uploadedBy)],
    ["Created at", formatDateTime(evidence.createdAt)],
    ["MIME type", evidence.mimeType],
    ["File size", formatFileSize(evidence.fileSize)],
    ["AI analysis status", formatEnumLabel(evidence.aiAnalysisStatus)],
    ["AI confidence", formatConfidence(evidence.aiConfidence)],
    ["Evidence reference", shortenId(evidence.id)],
  ]);

  try {
    const image = await fetchEvidenceImage(evidence.id, evidenceAccessCode);
    const maxWidth = contentWidth();
    const maxHeight = 210;
    const props = ctx.doc.getImageProperties(image);
    const ratio = Math.min(maxWidth / props.width, maxHeight / props.height, 1);
    const width = props.width * ratio;
    const height = props.height * ratio;
    ensureSpace(ctx, height + 116);
    const x = PAGE.margin + (maxWidth - width) / 2;
    ctx.doc.addImage(image, imageFormat(evidence.mimeType), x, ctx.y, width, height);
    ctx.y += height + 11;
    writeText(ctx, "Uploaded evidence image", { size: 8.5, color: COLORS.muted, align: "center", lineGap: 4 });
    writeText(ctx, "Image shown as uploaded evidence. Interpretation must be reviewed by authorized personnel.", {
      size: 8.5,
      color: COLORS.muted,
      align: "center",
      lineGap: 14,
    });
  } catch {
    drawBox(ctx, 54, COLORS.panel);
    ctx.y += 18;
    writeText(ctx, "Image preview unavailable. Original evidence file should be reviewed.", {
      x: PAGE.margin + 14,
      width: contentWidth() - 28,
      size: 9,
      color: COLORS.muted,
      lineGap: 20,
    });
  }

  writeText(ctx, "AI Image Observation Summary", { size: 11, bold: true, color: COLORS.softInk, lineGap: 6 });
  buildAiObservationSummary(ctx, evidence);
}

async function buildEvidenceSection(ctx: PdfContext, evidence: EvidenceListItem[], evidenceAccessCode?: string) {
  sectionHeading(ctx, "Evidence Section");
  if (!evidence.length) {
    writeText(ctx, "No image evidence is linked to this incident.", { color: COLORS.muted });
    return;
  }

  for (const [index, item] of evidence.entries()) {
    await buildImageEvidenceBlock(ctx, item, index, evidenceAccessCode);
  }
}

function buildMissingInfoSection(ctx: PdfContext, incident: IncidentDetail) {
  sectionHeading(ctx, "Missing Information / Follow-up Questions");
  const missing = incident.missingFields?.filter((item) => !hideEmpty(item)) ?? [];
  const standardFollowUps = [
    "Current safety status",
    "Exact location details",
    "Whether emergency help is needed",
    "Whether medical attention is needed",
    "Whether the perpetrator has current access to the care seeker",
  ];
  const rows = [...standardFollowUps, ...missing].filter((item, index, list) => list.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index);
  rows.forEach((item, index) => {
    writeText(ctx, `${index + 1}. ${formatEnumLabel(item) || item}`, { size: 10, color: COLORS.ink, lineGap: 4 });
  });
  ctx.y += 8;
}

function buildReviewNotes(ctx: PdfContext) {
  sectionHeading(ctx, "Review Notes");
  writeText(
    ctx,
    "Report generated from system records. Validate all AI observations, verify original evidence files before submission, and confirm key details with the care seeker or authorized case worker where appropriate.",
    { size: 10, color: COLORS.softInk },
  );
  writeText(ctx, "AI observations are assistive only and must not replace professional review.", {
    size: 9.5,
    bold: true,
    color: COLORS.danger,
  });
}

function buildAppendix(ctx: PdfContext, incident: IncidentDetail) {
  sectionHeading(ctx, "Appendix: Internal References");
  writeKeyValueGrid(ctx, [
    ["Incident ID", incident.id],
    ["Care seeker ID", incident.careSeekerId],
    ["Session ID", incident.sessionId],
    ["Created", formatDateTime(incident.createdAt)],
    ["Updated", formatDateTime(incident.updatedAt)],
    ["AI generated", incident.aiGenerated ? "Yes" : "No"],
    ["Incident AI confidence", formatConfidence(incident.aiConfidence)],
  ]);
}

export async function downloadIncidentReportPdf({ incident, evidence, evidenceAccessCode }: IncidentReportInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx: PdfContext = { doc, y: PAGE.margin, pageNumber: 1 };
  const generatedAt = formatDateTime(new Date().toISOString());
  const messages = incident.conversationMessagesTimeline ?? [];

  buildReportHeader(ctx, incident, generatedAt);
  buildRiskSnapshot(ctx, incident);
  buildIncidentSummary(ctx, incident);
  buildCareSeekerSection(ctx, incident);
  buildConversationTimeline(ctx, messages);
  await buildEvidenceSection(ctx, evidence, evidenceAccessCode);
  buildMissingInfoSection(ctx, incident);
  buildReviewNotes(ctx);
  buildAppendix(ctx, incident);

  addFooter(ctx);
  doc.save(`case-incident-report-${safeFileName(incident.id)}-${timestampForFileName()}.pdf`);
}
