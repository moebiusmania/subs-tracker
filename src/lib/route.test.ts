import { assert, test } from "vitest";
import { parseRoute, routeUrl } from "./route.ts";

test("parseRoute - finds the page under the base path", () => {
  for (const base of ["/", "/subs-tracker/"]) {
    assert.deepEqual(parseRoute(base, "", base), { name: "home" });
    assert.deepEqual(parseRoute(`${base}index.html`, "", base), {
      name: "home",
    });
    assert.deepEqual(parseRoute(`${base}add/`, "", base), { name: "add" });
    assert.deepEqual(parseRoute(`${base}add`, "", base), { name: "add" });
    assert.deepEqual(parseRoute(`${base}add/index.html`, "", base), {
      name: "add",
    });
    assert.deepEqual(parseRoute(`${base}edit/`, "?item=2", base), {
      name: "edit",
      index: 2,
    });
  }
});

test("parseRoute - a bad or missing item gives NaN", () => {
  for (const search of ["", "?item=", "?item=-1", "?item=1.5", "?item=x"]) {
    assert.deepEqual(parseRoute("/edit/", search, "/"), {
      name: "edit",
      index: NaN,
    });
  }
});

test("parseRoute - anything else is home", () => {
  assert.deepEqual(parseRoute("/other/", "", "/"), { name: "home" });
  assert.deepEqual(parseRoute("/add/", "", "/subs-tracker/"), { name: "home" });
});

test("routeUrl - builds the URL parseRoute reads back", () => {
  const base = "/subs-tracker/";
  for (const route of [
    { name: "home" },
    { name: "add" },
    { name: "edit", index: 3 },
  ] as const) {
    const url = new URL(routeUrl(route, base), "https://example.com");
    assert.deepEqual(parseRoute(url.pathname, url.search, base), route);
  }
});
