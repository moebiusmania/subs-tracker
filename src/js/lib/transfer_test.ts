import { assert, assertEquals } from "@std/assert";

import type { Subscription } from "./types.ts";
import { mockSubs } from "./mocks.ts";
import { formatDate } from "./index.ts";
import { MAX_SUBSCRIPTIONS } from "./store.ts";
import { qrMatrix } from "./qr.ts";
import {
  decodeShare,
  encodeShare,
  isSubscriptionList,
  parseBackup,
  readShareLink,
  shareLink,
  SITE_URL,
} from "./transfer.ts";

const subs = mockSubs();

// What a subscription looks like once its date is just the day shown
const shown = (item: Subscription) => ({
  ...item,
  expiration: formatDate(new Date(item.expiration)),
});

Deno.test("isSubscriptionList - what the app exports", () => {
  const exported = JSON.parse(JSON.stringify(subs));
  assertEquals(isSubscriptionList(exported), true);
  assertEquals(isSubscriptionList([]), true);
  assertEquals(isSubscriptionList({ data: exported }), false);
  assertEquals(isSubscriptionList([{ ...exported[0], price: "9" }]), false);
  assertEquals(
    isSubscriptionList([{ ...exported[0], recurrence: "weekly" }]),
    false,
  );
  assertEquals(
    isSubscriptionList([{ ...exported[0], expiration: "someday" }]),
    false,
  );
});

Deno.test("parseBackup - valid, broken and too long", () => {
  const result = parseBackup(JSON.stringify(subs));
  assert(result.ok);
  assertEquals(result.data.length, subs.length);
  assertEquals(parseBackup("{"), { ok: false, error: "invalid" });
  assertEquals(parseBackup('{"a":1}'), { ok: false, error: "invalid" });
  const many = Array.from({ length: MAX_SUBSCRIPTIONS + 1 }, () => subs[0]);
  assertEquals(parseBackup(JSON.stringify(many)), {
    ok: false,
    error: "tooMany",
  });
});

Deno.test("encodeShare/decodeShare - round trip", async () => {
  const data: Subscription[] = [
    ...JSON.parse(JSON.stringify(subs)),
    {
      name: "Crème brûlée club 🍮",
      price: 1234.56,
      currency: "£",
      isActive: false,
      recurrence: "yearly",
      expiration: new Date(2030, 0, 31),
    },
  ];
  const payload = await encodeShare(data);
  assert(/^[\w-]+$/.test(payload));
  const result = await decodeShare(payload);
  assert(result.ok);
  assertEquals(result.data.map(shown), data.map(shown));
});

Deno.test("decodeShare - rejects garbage", async () => {
  assertEquals(await decodeShare("nope"), { ok: false, error: "invalid" });
  assertEquals(await decodeShare(""), { ok: false, error: "invalid" });
});

Deno.test("shareLink/readShareLink", () => {
  const link = shareLink(SITE_URL, "abc_-1");
  assertEquals(link, `${SITE_URL}#d=abc_-1`);
  assertEquals(readShareLink(link), "abc_-1");
  assertEquals(readShareLink(`  ${link}\n`), "abc_-1");
  assertEquals(readShareLink("#d=xyz"), "xyz");
  assertEquals(shareLink(`${SITE_URL}#old`, "x"), `${SITE_URL}#d=x`);
  assertEquals(readShareLink(SITE_URL), null);
  assertEquals(readShareLink(`${SITE_URL}#d=a b`), null);
});

Deno.test("a full list with long names still fits in a QR code", async () => {
  const words = ["Streaming", "Cloud", "Music", "Games", "News", "Fitness"];
  const data: Subscription[] = Array.from(
    { length: MAX_SUBSCRIPTIONS },
    (_, index) => ({
      name: `${words[index % words.length]} premium plan ${index} (family)`,
      price: 5 + index * 1.37,
      currency: index % 3 ? "€" : "$",
      isActive: index % 4 !== 0,
      recurrence: index % 2 ? "yearly" : "monthly",
      expiration: new Date(2026, index % 12, 1 + index),
    }),
  );
  const link = shareLink(SITE_URL, await encodeShare(data));
  // Version 18 (89 modules) today: well under the largest, version 40
  assert(qrMatrix(link).length <= 101);
  // The example data makes a small, easy code (version 7)
  const example = shareLink(SITE_URL, await encodeShare(subs));
  assert(qrMatrix(example).length <= 45);
});
