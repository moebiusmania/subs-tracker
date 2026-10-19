// The add and edit forms open in a dialog over the home page, but keep their
// own URLs (/add/, /edit/?item=<index>) so they can be linked, reloaded and
// left with the browser's back button. base is the home URL's path, with the
// GitHub Pages prefix ("/" or "/subs-tracker/").
export type Route =
  | { name: "home" }
  | { name: "add" }
  // A missing or bad ?item= gives NaN: editForm sends that home
  | { name: "edit"; index: number };

export const parseRoute = (
  pathname: string,
  search: string,
  base: string,
): Route => {
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const page = path.replace(/\/?(index\.html)?$/, "");
  if (page === "add") return { name: "add" };
  if (page === "edit") {
    const item = new URLSearchParams(search).get("item") ?? "";
    return { name: "edit", index: /^\d+$/.test(item) ? Number(item) : NaN };
  }
  return { name: "home" };
};

export const routeUrl = (route: Route, base: string): string => {
  switch (route.name) {
    case "home":
      return base;
    case "add":
      return `${base}add/`;
    case "edit":
      return `${base}edit/?item=${route.index}`;
  }
};
