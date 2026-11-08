// Shared request-validation helpers for the API routes.

// Thrown for invalid client input. Routes convert it to HTTP 400.
export class ValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

// Turn a name into a URL-safe slug ("Phones & Electronics" -> "phones-electronics").
export function createSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Read an optional/required trimmed string with a maximum length.
export function readText(
  value: unknown,
  field: string,
  { required = false, max = 500 }: { required?: boolean; max?: number } = {},
): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be text.`);
  }

  const result = value.trim();

  if (!result) {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }

  if (result.length > max) {
    throw new ValidationError(`${field} must not exceed ${max} characters.`);
  }

  return result;
}

// Read a whole number within a range.
export function readInteger(
  value: unknown,
  field: string,
  { min = 0, max = 1_000_000 }: { min?: number; max?: number } = {},
): number {
  const number = typeof value === "string" ? Number(value) : value;

  if (typeof number !== "number" || !Number.isInteger(number)) {
    throw new ValidationError(`${field} must be a whole number.`);
  }

  if (number < min || number > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}.`);
  }

  return number;
}

export function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} must be true or false.`);
  }

  return value;
}

export function readHttpsUrl(value: unknown, field: string): string | null {
  const text = readText(value, field, { max: 2000 });
  if (!text) return null;

  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new ValidationError(`${field} must be a valid URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new ValidationError(`${field} must use HTTPS.`);
  }

  return text;
}
