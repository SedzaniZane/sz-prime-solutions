import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, PDFString, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { phoneIcon, whatsappIcon } from "./contact-icons";
import { billingContact } from "./billing-contact";

type BillingPdf = {
  title: "Quotation" | "Invoice";
  reference: string;
  unit: string;
  metadata: [string, string][];
  customer: string[];
  service: string[];
  items: { description: string; quantity: string; unitPrice: string; total: string }[];
  totals: [string, string][];
  note?: string;
  sandbox?: boolean;
};

export async function renderBillingPdf(doc: BillingPdf) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.reference);
  pdf.setAuthor("SZ Prime Solutions (Pty) Ltd");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const referenceLabel = doc.title + ' No: ' + doc.reference;
  const supported = new Set(regular.getCharacterSet());
  const logo = await pdf.embedPng(await readFile(join(process.cwd(), "public", "brand", "sz-shield-print.png")));
  const ink = rgb(0.09, 0.17, 0.23);
  const muted = rgb(0.31, 0.37, 0.41);
  const rule = rgb(0.81, 0.85, 0.87);
  const left = 44;
  const right = 551;
  let page = pdf.addPage([595, 842]);
  let y = 790;

  function clean(value: string) {
    return Array.from(value.normalize("NFC").replace(/\s+/gu, " "), (char) =>
      supported.has(char.codePointAt(0)!) ? char : "?").join("");
  }

  function draw(value: string, x: number, baseline: number, size = 10, strong = false, alignRight = false) {
    const font = strong ? bold : regular;
    const safe = clean(value);
    page.drawText(safe, {
      x: alignRight ? x - font.widthOfTextAtSize(safe, size) : x,
      y: baseline, size, font, color: strong ? ink : muted,
    });
  }

  function line() {
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.7, color: rule });
  }

  function wrap(value: string, width: number) {
    const lines: string[] = [];
    let current = "";
    for (const word of clean(value).trim().split(" ")) {
      const next = current ? current + " " + word : word;
      if (regular.widthOfTextAtSize(next, 10) <= width) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      for (const char of word) {
        if (regular.widthOfTextAtSize(current + char, 10) > width) {
          lines.push(current);
          current = "";
        }
        current += char;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function ensureSpace(height: number) {
    if (y - height >= 50) return;
    page = pdf.addPage([595, 842]);
    y = 790;
    draw(referenceLabel, left, y, 11, true);
    if (doc.sandbox) draw("SANDBOX INVOICE", right, y, 10, true, true);
    y -= 18;
    line();
    y -= 20;
  }

  function paragraph(value: string) {
    for (const row of wrap(value, right - left)) {
      ensureSpace(15);
      draw(row, left, y);
      y -= 15;
    }
  }

  page.drawImage(logo, { x: left, y: 745, width: 37, height: 40 });
  draw("SZ PRIME SOLUTIONS (PTY) LTD", 94, 778, 10, true);
  draw(doc.title, 94, 751, 24, true);
  draw(referenceLabel, right, 778, 11, true, true);
  if (doc.sandbox) draw("SANDBOX INVOICE", right, 757, 10, true, true);
  y = 722;
  line();
  y -= 19;
  paragraph(doc.unit);
  for (const [label, value] of doc.metadata) paragraph(label + ": " + value);

  y -= 14;
  ensureSpace(32);
  draw(doc.title === "Invoice" ? "BILL TO" : "PREPARED FOR", left, y, 10, true);
  y -= 17;
  doc.customer.forEach(paragraph);
  y -= 12;
  ensureSpace(32);
  draw("SERVICE", left, y, 10, true);
  y -= 17;
  doc.service.forEach(paragraph);

  function tableHeader() {
    line();
    y -= 17;
    draw("Description", left, y, 10, true);
    draw("Quantity", 360, y, 10, true, true);
    draw("Unit price", 452, y, 10, true, true);
    draw("Line total", right, y, 10, true, true);
    y -= 20;
  }

  y -= 17;
  ensureSpace(62);
  tableHeader();

  for (const item of doc.items) {
    const previousPage = page;
    ensureSpace(25);
    if (page !== previousPage) tableHeader();
    draw(item.quantity, 360, y, 10, false, true);
    draw(item.unitPrice, 452, y, 10, false, true);
    draw(item.total, right, y, 10, true, true);
    for (const row of wrap(item.description, 275)) {
      const descriptionPage = page;
      ensureSpace(15);
      if (page !== descriptionPage) tableHeader();
      draw(row, left, y);
      y -= 15;
    }
    y -= 7;
  }

  y -= 9;
  ensureSpace(doc.totals.length * 21 + 15);
  line();
  y -= 20;
  doc.totals.forEach(([label, value], index) => {
    const last = index === doc.totals.length - 1;
    draw(label, 312, y, last ? 13 : 10, last);
    draw(value, right, y, last ? 13 : 10, true, true);
    y -= 21;
  });
  if (doc.note) {
    y -= 12;
    paragraph(doc.note);
  }

  function linkedText(label: string, url: string, x: number, baseline: number) {
    const width = regular.widthOfTextAtSize(clean(label), 10);
    page.drawText(clean(label), { x, y: baseline, size: 10, font: regular, color: rgb(0.05, 0.35, 0.30) });
    page.drawLine({ start: { x, y: baseline - 2 }, end: { x: x + width, y: baseline - 2 }, thickness: 0.5, color: muted });
    const annotation = pdf.context.obj({
      Type: "Annot", Subtype: "Link", Rect: [x, baseline - 3, x + width, baseline + 11],
      Border: [0, 0, 0], A: { S: "URI", URI: PDFString.of(url) },
    });
    page.node.addAnnot(pdf.context.register(annotation));
  }

  const { email, whatsapp, whatsappUrl } = billingContact();
  y -= 15;
  ensureSpace(whatsappUrl ? 125 : 50);
  line();
  y -= 18;
  draw("QUERIES AND MORE INFORMATION", left, y, 10, true);
  linkedText("Email: " + email, "mailto:" + email, left, y - 17);

  if (whatsapp && whatsappUrl) {
    page.drawSvgPath(phoneIcon, { x: left, y: y - 24, scale: 0.53, borderWidth: 0.8, borderColor: muted });
    linkedText("Contact phone: " + whatsapp, "tel:" + whatsapp, left + 17, y - 34);
    page.drawSvgPath(whatsappIcon, { x: left, y: y - 41, scale: 0.53, borderWidth: 0.8, borderColor: rgb(0.05, 0.42, 0.29) });
    linkedText("WhatsApp: " + whatsappUrl, whatsappUrl, left + 17, y - 51);
    const qr = await pdf.embedPng(await QRCode.toBuffer(whatsappUrl, { margin: 4, scale: 6 }));
    page.drawRectangle({ x: right - 139, y: y - 98, width: 139, height: 110, borderColor: rule, borderWidth: 0.7 });
    page.drawImage(qr, { x: right - 109, y: y - 73, width: 79, height: 79 });
    draw("Scan to chat with support", right - 12, y - 88, 10, true, true);
  }

  const pages = pdf.getPages();
  pages.forEach((sheet, index) => sheet.drawText(`${index + 1} / ${pages.length}`, {
    x: right - 23, y: 28, size: 9, font: regular, color: muted,
  }));

  return pdf.save();
}

export async function billingPdfResponse(doc: BillingPdf) {
  const bytes = await renderBillingPdf(doc);
  const filename = doc.reference.replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";
  return new Response(Uint8Array.from(bytes).buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
