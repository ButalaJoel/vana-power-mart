import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

// Store-wide settings editable in Admin → Settings.
// Values are stored as JSON rows in the Setting table; anything not saved
// yet falls back to these defaults.
export interface StoreSettings {
  storeName: string;
  storePhone: string;
  // Phone numbers that receive an SMS for every new order.
  staffAlertPhones: string[];
  // Orders at or above this amount (after discount) get free delivery. null = off.
  freeDeliveryThreshold: number | null;
  // Supplier stock confirmations older than this are flagged as stale.
  stockConfirmationDays: number;
  // Where customers collect "store collection" orders.
  collectionAddress: string;
  // Days after delivery during which a customer can request a return.
  returnWindowDays: number;
  // Shown on invoices and delivery notes.
  storeEmail: string;
  // URA Taxpayer Identification Number, if registered.
  taxId: string;
  // Footer text on documents, e.g. warranty or return terms.
  documentNote: string;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Vana Power Mart",
  storePhone: "",
  staffAlertPhones: [],
  freeDeliveryThreshold: null,
  stockConfirmationDays: 7,
  collectionAddress: "",
  returnWindowDays: 7,
  storeEmail: "",
  taxId: "",
  documentNote: "",
};

let cache: { value: StoreSettings; at: number } | null = null;
const CACHE_MS = 30_000;

export async function getSettings(): Promise<StoreSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const rows = await prisma.setting.findMany();
  const value: StoreSettings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) {
      (value as unknown as Record<string, unknown>)[row.key] = row.value;
    }
  }

  cache = { value, at: Date.now() };
  return value;
}

export async function saveSettings(partial: Partial<StoreSettings>) {
  for (const [key, value] of Object.entries(partial)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;

    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
  }

  cache = null;
  return getSettings();
}
