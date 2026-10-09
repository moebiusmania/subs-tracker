import { assertEquals } from "@std/assert";
import { parseRoute, routeUrl } from "./route.ts";

Deno.test("parseRoute - finds the page under the base path", () => {
  for (const base of ["/", "/subs-tracker/"]) {
    assertEquals(parseRoute(base, "", base), { name: "home" });
    assertEquals(parseRoute(`${base}index.html`, "", base), { name: "home" });
    assertEquals(parseRoute(`${base}add/`, "", base), { name: "add" });
    assertEquals(parseRoute(`${base}add`, "", base), { name: "add" });
    assertEquals(parseRoute(`${base}add/index.html`, "", base), {
      name: "add",
    });
    assertEquals(parseRoute(`${base}edit/`, "?item=2", base), {
      name: "edit",
      index: 2,
    });
  }
});

Deno.test("parseRoute - a bad or missing item gives NaN", () => {
  for (const search of ["", "?item=", "?item=-1", "?item=1.5", "?item=x"]) {
    assertEquals(parseRoute("/edit/", search, "/"), {
      name: "edit",
      index: NaN,
    });
  }
});

Deno.test("parseRoute - anything else is home", () => {
  assertEquals(parseRoute("/other/", "", "/"), { name: "home" });
  assertEquals(parseRoute("/add/", "", "/subs-tracker/"), { name: "home" });
});

Deno.test("routeUrl - builds the URL parseRoute reads back", () => {
  const base = "/subs-tracker/";
  for (
    const route of [
      { name: "home" },
      { name: "add" },
      { name: "edit", index: 3 },
    ] as const
  ) {
    const url = new URL(routeUrl(route, base), "https://example.com");
    assertEquals(parseRoute(url.pathname, url.search, base), route);
  }
});
