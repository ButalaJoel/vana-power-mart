import { createHmac, timingSafeEqual } from "node:crypto";
import PDFDocument from "pdfkit";
import { prisma } from "./prisma.js";
import { getSettings, type StoreSettings } from "./settings.js";

// Order documents: an invoice (a receipt once paid) and a delivery note the
// rider takes along for the customer to sign. Both are built from the saved
// order, so the shop's copy is always the order record itself.

export type DocumentType = "invoice" | "delivery-note";

export function readDocumentType(value: unknown): DocumentType {
  return value === "delivery-note" ? "delivery-note" : "invoice";
}

// ---------- Share links ----------

// A share link carries a signature of the order number, so it can be sent
// by SMS or WhatsApp without guessing other customers' documents.
export function documentToken(orderNumber: string) {
  const secret = process.env.JWT_SECRET ?? "dev-secret";
  return createHmac("sha256", secret).update(`order-document:${orderNumber}`).digest("hex").slice(0, 20);
}

export function documentTokenValid(orderNumber: string, token: unknown) {
  if (typeof token !== "string" || token.length !== 20) return false;
  const expected = Buffer.from(documentToken(orderNumber));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function documentUrl(orderNumber: string, type: DocumentType = "invoice") {
  const api = (process.env.PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return `${api}/api/orders/document/${encodeURIComponent(orderNumber)}?type=${type}&t=${documentToken(orderNumber)}`;
}

// ---------- Loading ----------

export const documentOrderInclude = {
  customer: true,
  deliveryZone: true,
  items: { include: { variant: { select: { sku: true, modelNumber: true } } }, orderBy: { createdAt: "asc" as const } },
  payments: { orderBy: { createdAt: "desc" as const } },
};

export async function loadDocumentOrder(where: { id: string } | { orderNumber: string }) {
  return prisma.order.findUnique({ where, include: documentOrderInclude });
}

type DocumentOrder = NonNullable<Awaited<ReturnType<typeof loadDocumentOrder>>>;

// ---------- Drawing ----------

const GREEN = "#0b4a2c";
const TEXT = "#1d2b23";
const MUTED = "#66756c";
const LINE = "#d9e2dc";
const LIGHT = "#f2f6f3";

function money(value: unknown) {
  const amount = Math.round(Number(value ?? 0));
  return `UGX ${amount.toLocaleString("en-US")}`;
}

function date(value: Date | null | undefined) {
  if (!value) return "-";
  return value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kampala" });
}

function dateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
  });
}

const PAYMENT_LABELS: Record<string, string> = {
  "cash-on-delivery": "Cash on delivery",
  "mobile-money": "Mobile money",
  "bank-transfer": "Bank transfer",
};

const STATUS_LABELS: Record<string, string> = {
  UNPAID: "Not paid",
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
};

function label(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return "-";
  return map[value] ?? value.replace(/[-_]/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  const scale = size / 64;
  doc.save().translate(x, y).scale(scale);
  doc.roundedRect(0, 0, 64, 64, 14).fill(GREEN);
  doc.path("M15 16h9.5L32 38.5 39.5 16H49L37 48H27z").fill("#ffffff");
  doc.path("M41 12l-5 9h5l-3 7 8-10h-5l3-6z").fill("#f5c542");
  doc.restore();
}

function header(doc: PDFKit.PDFDocument, settings: StoreSettings, title: string, order: DocumentOrder, documentNumber: string) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  drawLogo(doc, left, 44, 42);
  doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(17).text(settings.storeName, left + 54, 46);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
  const contact = [settings.collectionAddress, settings.storePhone, settings.storeEmail].filter(Boolean).join("  |  ");
  doc.text(contact || "Uganda", left + 54, 67, { width: 280 });
  if (settings.taxId) doc.text(`TIN: ${settings.taxId}`, left + 54, doc.y + 1);

  doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(20).text(title.toUpperCase(), left, 46, { width: right - left, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  doc.text(`No. ${documentNumber}`, left, 72, { width: right - left, align: "right" });
  doc.text(`Order ${order.orderNumber}`, left, 84, { width: right - left, align: "right" });
  doc.text(`Order date ${date(order.createdAt)}`, left, 96, { width: right - left, align: "right" });

  doc.moveTo(left, 122).lineTo(right, 122).lineWidth(1).strokeColor(LINE).stroke();
  doc.y = 136;
}

function infoColumns(doc: PDFKit.PDFDocument, columns: Array<{ heading: string; lines: string[] }>) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = width / columns.length;
  const top = doc.y;
  let bottom = top;

  columns.forEach((column, index) => {
    const x = left + index * columnWidth;
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text(column.heading.toUpperCase(), x, top, { width: columnWidth - 14, characterSpacing: 0.6 });
    doc.fillColor(TEXT).font("Helvetica").fontSize(9.5);
    let y = doc.y + 4;
    for (const line of column.lines.filter(Boolean)) {
      doc.text(line, x, y, { width: columnWidth - 14 });
      y = doc.y + 1;
    }
    bottom = Math.max(bottom, y);
  });

  doc.y = bottom + 16;
}

function itemsTable(doc: PDFKit.PDFDocument, order: DocumentOrder, withPrices: boolean) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const cols = withPrices
    ? { item: left + 8, qty: right - 250, unit: right - 190, total: right - 90 }
    : { item: left + 8, qty: right - 120, check: right - 60 };

  const drawHead = () => {
    const y = doc.y;
    doc.rect(left, y, right - left, 22).fill(LIGHT);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8);
    doc.text("ITEM", cols.item, y + 7);
    if (withPrices && "unit" in cols) {
      doc.text("QTY", cols.qty, y + 7, { width: 40, align: "right" });
      doc.text("UNIT PRICE", cols.unit, y + 7, { width: 90, align: "right" });
      doc.text("AMOUNT", cols.total, y + 7, { width: 82, align: "right" });
    } else if ("check" in cols) {
      doc.text("QTY", cols.qty, y + 7, { width: 40, align: "right" });
      doc.text("RECEIVED", cols.check, y + 7, { width: 52, align: "right" });
    }
    doc.y = y + 28;
  };

  drawHead();

  order.items.forEach((item, index) => {
    const itemWidth = (withPrices ? right - 260 : right - 130) - cols.item;
    doc.font("Helvetica").fontSize(9.5);
    const nameHeight = doc.heightOfString(item.productName, { width: itemWidth });
    const reference = item.variant?.modelNumber || item.variant?.sku;
    const rowHeight = nameHeight + (reference ? 12 : 0) + 12;

    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawHead();
    }

    const y = doc.y;
    doc.fillColor(TEXT).font("Helvetica").fontSize(9.5).text(`${index + 1}. ${item.productName}`, cols.item, y, { width: itemWidth });
    if (reference) doc.fillColor(MUTED).fontSize(8).text(`Ref: ${reference}`, cols.item + 12, doc.y + 1, { width: itemWidth });

    doc.fillColor(TEXT).fontSize(9.5);
    if (withPrices && "unit" in cols) {
      doc.text(String(item.quantity), cols.qty, y, { width: 40, align: "right" });
      doc.text(money(item.unitPrice), cols.unit, y, { width: 90, align: "right" });
      doc.text(money(Number(item.unitPrice) * item.quantity), cols.total, y, { width: 82, align: "right" });
    } else if ("check" in cols) {
      doc.text(String(item.quantity), cols.qty, y, { width: 40, align: "right" });
      doc.rect((cols.check ?? 0) + 38, y - 1, 12, 12).lineWidth(0.8).strokeColor(MUTED).stroke();
    }

    doc.y = y + rowHeight;
    doc.moveTo(left, doc.y - 6).lineTo(right, doc.y - 6).lineWidth(0.5).strokeColor(LINE).stroke();
  });
}

function totals(doc: PDFKit.PDFDocument, order: DocumentOrder) {
  const right = doc.page.width - doc.page.margins.right;
  const x = right - 230;
  const rows: Array<[string, string, boolean?]> = [["Subtotal", money(order.subtotal)]];
  if (Number(order.discountAmount) > 0) rows.push(["Discount", `- ${money(order.discountAmount)}`]);
  rows.push([order.deliveryMethod === "collection" ? "Collection" : "Delivery", Number(order.deliveryFee) > 0 ? money(order.deliveryFee) : "Free"]);
  rows.push(["Total", money(order.total), true]);

  if (doc.y + rows.length * 18 + 20 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }

  doc.y += 4;
  for (const [name, value, strong] of rows) {
    const y = doc.y;
    if (strong) {
      doc.rect(x - 8, y - 5, 238, 24).fill(GREEN);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11);
    } else {
      doc.fillColor(MUTED).font("Helvetica").fontSize(9.5);
    }
    doc.text(name, x, y, { width: 110 });
    doc.text(value, x + 100, y, { width: 122, align: "right" });
    doc.y = y + (strong ? 26 : 17);
  }
}

function paymentSummary(order: DocumentOrder) {
  const paid = order.payments.find((payment) => payment.status === "PAID" && Number(payment.amount) > 0);
  const lines = [
    `Method: ${label(PAYMENT_LABELS, order.paymentMethod)}`,
    `Status: ${label(STATUS_LABELS, order.paymentStatus)}`,
  ];
  if (paid) {
    lines.push(`Paid: ${dateTime(paid.verifiedAt ?? paid.createdAt)}`);
    lines.push(`Reference: ${paid.providerReference ?? paid.merchantReference}`);
  }
  return lines;
}

function localPhone(value: string | null | undefined) {
  if (!value) return "";
  const match = /^\+256(\d{3})(\d{3})(\d{3})$/.exec(value);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : value;
}

function customerLines(order: DocumentOrder) {
  const name = order.customerName ?? `${order.customer.firstName} ${order.customer.lastName}`.trim();
  return [name, localPhone(order.customerPhone ?? order.customer.phone), order.customerEmail ?? order.customer.email ?? ""];
}

function deliveryLines(order: DocumentOrder, settings: StoreSettings) {
  if (order.deliveryMethod === "collection") {
    return ["Store collection", settings.collectionAddress];
  }
  return [order.deliveryAddress, order.deliveryArea ?? "", order.deliveryZone?.name ? `Zone: ${order.deliveryZone.name}` : ""];
}

function footer(doc: PDFKit.PDFDocument, settings: StoreSettings, text: string) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would otherwise start a new page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 58;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5);
    doc.text(text, left, y + 8, { width: width - 60, lineBreak: true, height: 30 });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, left, y + 8, { width, align: "right" });
    doc.page.margins.bottom = bottomMargin;
  }
  void settings;
}

function render(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 44, bottom: 64, left: 44, right: 44 }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

export async function buildOrderDocument(order: DocumentOrder, type: DocumentType) {
  const settings = await getSettings();
  const isReceipt = order.paymentStatus === "PAID";
  const title = type === "delivery-note" ? "Delivery note" : isReceipt ? "Receipt" : "Invoice";
  // Receipts are only for paid orders; refunds keep the invoice title with a note.
  const prefix = type === "delivery-note" ? "DN" : isReceipt ? "RCT" : "INV";
  const documentNumber = `${prefix}-${order.orderNumber.replace(/^VPM-/, "")}`;
  const fileName = `${title.replace(/\s/g, "-")}-${order.orderNumber}.pdf`;

  const buffer = await render((doc) => {
    doc.info.Title = `${title} ${order.orderNumber}`;
    doc.info.Author = settings.storeName;

    header(doc, settings, title, order, documentNumber);

    if (order.status === "CANCELLED") {
      doc.fillColor("#b42318").font("Helvetica-Bold").fontSize(11).text("THIS ORDER WAS CANCELLED", { align: "center" });
      doc.moveDown(0.8);
    }

    if (type === "invoice") {
      infoColumns(doc, [
        { heading: "Billed to", lines: customerLines(order) },
        { heading: order.deliveryMethod === "collection" ? "Collection" : "Deliver to", lines: deliveryLines(order, settings) },
        { heading: "Payment", lines: paymentSummary(order) },
      ]);
      itemsTable(doc, order, true);
      totals(doc, order);

      if (order.paymentStatus === "REFUNDED") {
        doc.moveDown(0.6);
        doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(10).text("This order was refunded.", doc.page.margins.left, doc.y);
      } else if (!isReceipt && order.status !== "CANCELLED") {
        doc.moveDown(0.6);
        doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(10)
          .text(`Amount due: ${money(order.total)}`, doc.page.margins.left, doc.y);
        doc.font("Helvetica").fontSize(9).fillColor(MUTED)
          .text(order.paymentMethod === "cash-on-delivery" ? "Payable to our rider on delivery." : "Payable by mobile money.");
      }
    } else {
      infoColumns(doc, [
        { heading: "Customer", lines: customerLines(order) },
        { heading: order.deliveryMethod === "collection" ? "Collection" : "Deliver to", lines: deliveryLines(order, settings) },
        {
          heading: "Delivery",
          lines: [
            order.deliveryAssignee ? `Rider: ${order.deliveryAssignee}` : "Rider: ____________________",
            order.deliveryAssigneePhone ? `Rider phone: ${localPhone(order.deliveryAssigneePhone)}` : "",
            `Dispatched: ${dateTime(order.dispatchedAt)}`,
            order.deliveredAt ? `Delivered: ${dateTime(order.deliveredAt)}` : "",
          ],
        },
      ]);

      if (order.customerNotes) {
        doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("INSTRUCTIONS", doc.page.margins.left, doc.y);
        doc.fillColor(TEXT).font("Helvetica").fontSize(9.5).text(order.customerNotes, { width: 480 });
        doc.moveDown(0.8);
      }

      itemsTable(doc, order, false);

      // What the rider must collect.
      const left = doc.page.margins.left;
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const due = order.paymentStatus === "PAID" ? "Nothing to collect: this order is already paid." : `Collect on delivery: ${money(order.total)}`;
      if (doc.y + 190 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        doc.y = doc.page.margins.top;
      }
      doc.y += 6;
      doc.rect(left, doc.y, width, 30).fill(LIGHT);
      doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(11).text(due, left + 12, doc.y + 10);
      doc.y += 44;

      // Signatures.
      doc.fillColor(TEXT).font("Helvetica").fontSize(9)
        .text("I confirm I received the items above in good condition.", left, doc.y);
      const y = doc.y + 34;
      const half = (width - 30) / 2;
      for (const [index, caption] of ["Customer name and signature", "Date and time received"].entries()) {
        const x = left + index * (half + 30);
        doc.moveTo(x, y).lineTo(x + half, y).lineWidth(0.8).strokeColor(MUTED).stroke();
        doc.fillColor(MUTED).fontSize(8).text(caption, x, y + 4, { width: half });
      }
      const y2 = y + 44;
      doc.moveTo(left, y2).lineTo(left + half, y2).strokeColor(MUTED).stroke();
      doc.fillColor(MUTED).fontSize(8).text("Delivered by (rider signature)", left, y2 + 4, { width: half });
      if (order.deliveryProof) {
        doc.fillColor(TEXT).fontSize(9).text(`Recorded proof: ${order.deliveryProof}`, left + half + 30, y2 - 14, { width: half });
      }
      doc.y = y2 + 24;
    }

    const note =
      settings.documentNote ||
      `Thank you for shopping with ${settings.storeName}. Returns are accepted within ${settings.returnWindowDays} days of delivery for unused items in their original packaging. Keep this document for warranty and returns.`;
    footer(doc, settings, `${note}  Issued ${dateTime(new Date())}.`);
  });

  return { buffer, fileName };
}
