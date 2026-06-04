import { jsPDF } from "jspdf";

import { apiClient } from "@/lib/api/client";
import type { EvidenceListItem, IncidentDetail } from "@/lib/api/types";

const PAGE = {
  margin: 42,
  width: 595.28,
  height: 841.89,
};

type PdfContext = {
  doc: jsPDF;
  y: number;
  pageNumber: number;
};

type IncidentReportInput = {
  incident: IncidentDetail;
  evidence: EvidenceListItem[];
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function addFooter(ctx: PdfContext) {
  const { doc, pageNumber } = ctx;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("SakhiSafe-SakhaVasudev Incident Report", PAGE.margin, PAGE.height - 24);
  doc.text(`Page ${pageNumber}`, PAGE.width - PAGE.margin, PAGE.height - 24, { align: "right" });
}

function addPage(ctx: PdfContext) {
  addFooter(ctx);
  ctx.doc.addPage();
  ctx.pageNumber += 1;
  ctx.y = PAGE.margin;
}

function ensureSpace(ctx: PdfContext, needed: number) {
  if (ctx.y + needed > PAGE.height - 52) {
    addPage(ctx);
  }
}

function textLines(doc: jsPDF, text: string, maxWidth = PAGE.width - PAGE.margin * 2) {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function writeText(ctx: PdfContext, text: string, options?: { size?: number; bold?: boolean; color?: [number, number, number]; lineGap?: number }) {
  const { doc } = ctx;
  const size = options?.size ?? 10;
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...(options?.color ?? [15, 23, 42]));
  const lines = textLines(doc, text || "-", PAGE.width - PAGE.margin * 2);
  const lineHeight = size * 1.35;
  ensureSpace(ctx, lines.length * lineHeight + 8);
  doc.text(lines, PAGE.margin, ctx.y);
  ctx.y += lines.length * lineHeight + (options?.lineGap ?? 8);
}

function sectionTitle(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 34);
  ctx.doc.setDrawColor(226, 232, 240);
  ctx.doc.line(PAGE.margin, ctx.y, PAGE.width - PAGE.margin, ctx.y);
  ctx.y += 18;
  writeText(ctx, title, { size: 13, bold: true, color: [30, 41, 59], lineGap: 10 });
}

function keyValues(ctx: PdfContext, rows: Array<[string, unknown]>) {
  const { doc } = ctx;
  const labelWidth = 150;

  rows.forEach(([label, value]) => {
    const printable = formatValue(value);
    const valueLines = textLines(doc, printable, PAGE.width - PAGE.margin * 2 - labelWidth);
    const height = Math.max(18, valueLines.length * 13 + 4);
    ensureSpace(ctx, height + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(label, PAGE.margin, ctx.y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(valueLines, PAGE.margin + labelWidth, ctx.y);
    ctx.y += height;
  });

  ctx.y += 4;
}

function paragraphBlock(ctx: PdfContext, title: string, text?: string | null) {
  ensureSpace(ctx, 38);
  writeText(ctx, title, { size: 10, bold: true, color: [51, 65, 85], lineGap: 4 });
  writeText(ctx, text || "-", { size: 10, color: [15, 23, 42], lineGap: 8 });
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchEvidenceImage(evidenceId: string) {
  const response = await apiClient.get(`/admin/v1/evidence/${evidenceId}/file`, { responseType: "blob" });
  return blobToDataUrl(response.data);
}

function imageFormat(mimeType: string) {
  return mimeType.toLowerCase().includes("png") ? "PNG" : "JPEG";
}

async function addEvidenceImage(ctx: PdfContext, evidence: EvidenceListItem, index: number) {
  sectionTitle(ctx, `Image Evidence ${index + 1}`);
  keyValues(ctx, [
    ["Evidence ID", evidence.id],
    ["Uploaded By", evidence.uploadedBy],
    ["Created At", formatDate(evidence.createdAt)],
    ["MIME Type", evidence.mimeType],
    ["File Size", `${evidence.fileSize} bytes`],
    ["AI Status", evidence.aiAnalysisStatus],
    ["AI Confidence", typeof evidence.aiConfidence === "number" ? `${(evidence.aiConfidence * 100).toFixed(1)}%` : "-"],
  ]);

  try {
    const image = await fetchEvidenceImage(evidence.id);
    ensureSpace(ctx, 290);
    const maxWidth = PAGE.width - PAGE.margin * 2;
    const maxHeight = 250;
    const props = ctx.doc.getImageProperties(image);
    const ratio = Math.min(maxWidth / props.width, maxHeight / props.height);
    const width = props.width * ratio;
    const height = props.height * ratio;
    const x = PAGE.margin + (maxWidth - width) / 2;
    ctx.doc.addImage(image, imageFormat(evidence.mimeType), x, ctx.y, width, height);
    ctx.y += height + 14;
  } catch {
    writeText(ctx, "Image file could not be embedded in this generated report.", { size: 9, color: [185, 28, 28] });
  }

  paragraphBlock(ctx, "Image Observation / Summary", evidence.aiSummary || evidence.caption);
  paragraphBlock(ctx, "Description / Additional Note", evidence.description);
}

export async function downloadIncidentReportPdf({ incident, evidence }: IncidentReportInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const ctx: PdfContext = { doc, y: PAGE.margin, pageNumber: 1 };
  const generatedAt = new Date().toLocaleString();
  const messages = incident.conversationMessagesTimeline ?? [];

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, PAGE.width, 112, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("Incident Report", PAGE.margin, 50);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("SakhiSafe-SakhaVasudev", PAGE.margin, 72);
  doc.text(`Generated: ${generatedAt}`, PAGE.margin, 92);
  ctx.y = 136;

  writeText(ctx, "Confidential case document prepared from recorded incident, conversation, and evidence data. AI-derived observations are included as stored and should be reviewed by an authorized human before legal filing.", {
    size: 9,
    color: [71, 85, 105],
  });

  sectionTitle(ctx, "Incident Summary");
  keyValues(ctx, [
    ["Incident ID", incident.id],
    ["Title", incident.title],
    ["Status", incident.status],
    ["Source", incident.source],
    ["Category", incident.category],
    ["Severity", incident.severity],
    ["Urgency", incident.urgency],
    ["Needs Human Review", incident.needsHumanReview],
    ["AI Generated", incident.aiGenerated],
    ["AI Confidence", incident.aiConfidence],
    ["Created At", formatDate(incident.createdAt)],
    ["Updated At", formatDate(incident.updatedAt)],
  ]);
  paragraphBlock(ctx, "Summary", incident.summary);
  paragraphBlock(ctx, "Detailed Description", incident.description);
  paragraphBlock(ctx, "Case Note", incident.caseNote);

  sectionTitle(ctx, "Care Seeker and Linked Records");
  keyValues(ctx, [
    ["Care Seeker ID", incident.careSeekerId],
    ["Display Name", incident.careSeeker?.displayName],
    ["Phone Number", incident.careSeeker?.phoneNumber],
    ["WhatsApp Phone", incident.careSeeker?.whatsappPhoneNumber],
    ["Care Seeker Source", incident.careSeeker?.source],
    ["Care Seeker Status", incident.careSeeker?.status],
    ["Session ID", incident.sessionId],
    ["Conversation Channel", incident.conversationSession?.channel],
    ["Session Status", incident.conversationSession?.status],
    ["Session Started At", formatDate(incident.conversationSession?.startedAt)],
    ["Last Message At", formatDate(incident.conversationSession?.lastMessageAt)],
  ]);

  sectionTitle(ctx, "Incident Context");
  keyValues(ctx, [
    ["Incident Date Text", incident.incidentDateText],
    ["Location", incident.locationText],
    ["Perpetrator Relation", incident.perpetratorRelation],
    ["Risk Signals", incident.riskSignals],
    ["Missing Fields", incident.missingFields],
  ]);

  sectionTitle(ctx, "Conversation Timeline");
  if (!messages.length) {
    writeText(ctx, "No conversation messages are linked to this incident.");
  } else {
    messages.forEach((message, index) => {
      ensureSpace(ctx, 60);
      writeText(ctx, `Message ${index + 1}`, { size: 10, bold: true, color: [51, 65, 85], lineGap: 2 });
      keyValues(ctx, [
        ["Message ID", message.id],
        ["Direction", message.direction],
        ["Type", message.messageType],
        ["Created At", formatDate(message.createdAt)],
        ["Media ID", message.mediaId],
        ["Evidence ID", message.evidenceId],
      ]);
      paragraphBlock(ctx, "Message Text", message.messageText);
    });
  }

  sectionTitle(ctx, "Evidence Index");
  if (!evidence.length) {
    writeText(ctx, "No image evidence is linked to this incident.");
  } else {
    keyValues(
      ctx,
      evidence.map((item, index) => [
        `Evidence ${index + 1}`,
        `${item.id} | ${item.uploadedBy} | ${formatDate(item.createdAt)} | ${item.mimeType}`,
      ]),
    );
  }

  for (const [index, item] of evidence.entries()) {
    await addEvidenceImage(ctx, item, index);
  }

  sectionTitle(ctx, "Review Notes");
  writeText(ctx, "This report is generated from system records and should be validated by authorized personnel. Attachments, descriptions, and AI observations should be checked against original evidence before submission to any court, authority, or legal representative.", {
    size: 10,
    color: [71, 85, 105],
  });

  addFooter(ctx);
  doc.save(`incident-report-${safeFileName(incident.id)}.pdf`);
}
