// Moving the subscriptions to another device: the JSON backup file, and a
// link carrying them in its hash (#d=…) that a QR code can hold. The link
// packs each subscription into a few bytes, compresses them and writes them
// as base64url; the hash never leaves the browser, so no server sees it.
import type { Subscription } from "./types.ts";
import { MAX_SUBSCRIPTIONS } from "./store.ts";

// Where the TUI's links point; the web app uses its own address
export const SITE_URL = "https://moebiusmania.github.io/subs-tracker/";

const HASH_KEY = "d";
const VERSION = 1;

// Why a backup or a link can't be imported
export type ImportError = "invalid" | "tooMany";

export type ImportResult =
  | { ok: true; data: Subscription[] }
  | { ok: false; error: ImportError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isSubscriptionList = (value: unknown): value is Subscription[] =>
  Array.isArray(value) &&
  value.every((item) =>
    isRecord(item) &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    typeof item.currency === "string" &&
    typeof item.isActive === "boolean" &&
    (item.recurrence === "monthly" || item.recurrence === "yearly") &&
    (typeof item.expiration === "string" ||
      typeof item.expiration === "number") &&
    !isNaN(new Date(item.expiration).getTime())
  );

const checked = (data: Subscription[]): ImportResult =>
  data.length > MAX_SUBSCRIPTIONS
    ? { ok: false, error: "tooMany" }
    : { ok: true, data };

// The content of a JSON file exported from the app
export const parseBackup = (content: string): ImportResult => {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return { ok: false, error: "invalid" };
  }
  return isSubscriptionList(value)
    ? checked(value)
    : { ok: false, error: "invalid" };
};

// Binary format ---------------------------------------------------------------
// A version byte, then for each subscription: a flags byte (active, yearly,
// currency), the price in cents and the expiration as days since 1970 as
// varints, a custom currency if any and the name, both length-prefixed UTF-8.

const FLAG_ACTIVE = 1;
const FLAG_YEARLY = 2;
const CURRENCY_SHIFT = 2;
const CURRENCIES = ["€", "$"];
// Any other currency is written out after the flags
const CUSTOM_CURRENCY = 3;
const DAY = 86_400_000;

class Writer {
  bytes: number[] = [];
  varint(value: number): void {
    let rest = Math.max(0, Math.floor(value));
    while (rest >= 0x80) {
      this.bytes.push((rest % 0x80) | 0x80);
      rest = Math.floor(rest / 0x80);
    }
    this.bytes.push(rest);
  }
  string(value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.varint(encoded.length);
    this.bytes.push(...encoded);
  }
}

class Reader {
  #offset = 0;
  constructor(readonly bytes: Uint8Array) {}
  get done(): boolean {
    return this.#offset >= this.bytes.length;
  }
  byte(): number {
    if (this.done) throw new Error("Unexpected end of data");
    return this.bytes[this.#offset++];
  }
  varint(): number {
    let value = 0;
    for (let scale = 1;; scale *= 0x80) {
      if (scale > 2 ** 42) throw new Error("Varint too long");
      const byte = this.byte();
      value += (byte & 0x7f) * scale;
      if (byte < 0x80) return value;
    }
  }
  string(): string {
    const length = this.varint();
    if (this.#offset + length > this.bytes.length) {
      throw new Error("Unexpected end of data");
    }
    const slice = this.bytes.subarray(this.#offset, this.#offset + length);
    this.#offset += length;
    return new TextDecoder("utf-8", { fatal: true }).decode(slice);
  }
}

// The calendar day the app shows (local time), as days since 1970. Dates
// come back from localStorage as strings
const toDays = (expiration: Date | string): number => {
  const date = new Date(expiration);
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY,
  );
};

// That day at local noon, so time zones never move it to another day
const fromDays = (days: number): Date => {
  const utc = new Date(days * DAY);
  return new Date(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    12,
  );
};

const pack = (data: Subscription[]): Uint8Array => {
  const writer = new Writer();
  writer.bytes.push(VERSION);
  for (const item of data) {
    const known = CURRENCIES.indexOf(item.currency);
    const currency = known < 0 ? CUSTOM_CURRENCY : known;
    writer.bytes.push(
      (item.isActive ? FLAG_ACTIVE : 0) |
        (item.recurrence === "yearly" ? FLAG_YEARLY : 0) |
        (currency << CURRENCY_SHIFT),
    );
    writer.varint(Math.round(item.price * 100));
    writer.varint(toDays(item.expiration));
    if (currency === CUSTOM_CURRENCY) writer.string(item.currency);
    writer.string(item.name);
  }
  return new Uint8Array(writer.bytes);
};

const unpack = (bytes: Uint8Array): Subscription[] => {
  const reader = new Reader(bytes);
  if (reader.byte() !== VERSION) throw new Error("Unknown version");
  const data: Subscription[] = [];
  while (!reader.done) {
    const flags = reader.byte();
    if (flags >> (CURRENCY_SHIFT + 2)) throw new Error("Unknown flags");
    const currency = (flags >> CURRENCY_SHIFT) & 3;
    const price = reader.varint() / 100;
    const expiration = fromDays(reader.varint());
    data.push({
      currency: currency === CUSTOM_CURRENCY
        ? reader.string()
        : CURRENCIES[currency] ?? CURRENCIES[0],
      name: reader.string(),
      price,
      isActive: (flags & FLAG_ACTIVE) !== 0,
      recurrence: flags & FLAG_YEARLY ? "yearly" : "monthly",
      expiration,
    });
  }
  return data;
};

// Compression -----------------------------------------------------------------

const pipe = async (
  bytes: Uint8Array,
  stream: GenericTransformStream,
): Promise<Uint8Array> => {
  const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
};

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string): Uint8Array =>
  Uint8Array.from(
    atob(text.replaceAll("-", "+").replaceAll("_", "/")),
    (char) => char.charCodeAt(0),
  );

// The subscriptions as the text that goes after #d=
export const encodeShare = async (data: Subscription[]): Promise<string> =>
  toBase64Url(await pipe(pack(data), new CompressionStream("deflate-raw")));

export const decodeShare = async (payload: string): Promise<ImportResult> => {
  try {
    const bytes = await pipe(
      fromBase64Url(payload),
      new DecompressionStream("deflate-raw"),
    );
    return checked(unpack(bytes));
  } catch {
    return { ok: false, error: "invalid" };
  }
};

// The app's address (with its path prefix) with the data in the hash
export const shareLink = (base: string, payload: string): string =>
  `${base.replace(/#.*$/, "")}#${HASH_KEY}=${payload}`;

// The payload in a link, or in just its hash; null when there's none
export const readShareLink = (text: string): string | null => {
  const hash = text.trim().split("#")[1];
  if (!hash) return null;
  const payload = new URLSearchParams(hash).get(HASH_KEY)?.trim();
  return payload && /^[\w-]+$/.test(payload) ? payload : null;
};
