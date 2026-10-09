// The terminal version of the app: screens, focus, scrolling and input. It
// reuses the web app's store and component logic (src/js/lib), so both
// versions compute and change the data the same way. Nothing here touches the
// terminal: main.ts feeds it keys, mouse events and the screen size, and
// draws the nodes it returns.
import type { Store } from "../src/js/lib/store.ts";
import type { I18n, Locale } from "../src/js/lib/types.ts";
import { createComponents, type Deps } from "../src/js/lib/components.ts";
import { getTranslation } from "../src/js/lib/index.ts";
import { translations } from "../src/js/lib/i18n.ts";
import { encodeShare, shareLink, SITE_URL } from "../src/js/lib/transfer.ts";
import { qrMatrix } from "../src/js/lib/qr.ts";
import {
  contains,
  encloses,
  type Key,
  Painter,
  type PlacedHit,
} from "./painter.ts";
import type { Node, Rect } from "./scene.ts";
import { mix, type Palette, palettes, type StyleOptions } from "./palette.ts";
import {
  backspace,
  deleteForward,
  type Errors,
  type Field,
  field,
  type FieldName,
  type FormValues,
  initialValues,
  insert,
  moveCursor,
  stepDate,
  stepPrice,
  toSubscription,
  validate,
} from "./form.ts";
import {
  bigText,
  button,
  buttonWidth,
  type Ctx,
  frame,
  input,
  segmented,
  toggle,
} from "./widgets.ts";
import {
  center,
  parseStrong,
  textWidth,
  truncate,
  wrap,
  wrapSpans,
} from "./text.ts";

export type AppDeps = {
  store: Store;
  // Saves the store, may throw
  persist: () => void;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => void;
  // Turns what's typed in the file dialogs into a full path, and back
  resolvePath: (path: string) => string;
  displayPath: (path: string) => string;
  // Where the data is saved, shown in the footer
  dataFile: string;
  quit: () => void;
  // setTimeout that returns its own cancel function (faked in tests)
  schedule: (callback: () => void, ms: number) => () => void;
  // Asks for a new frame after something changed outside an event
  changed: () => void;
  // The empty state's coins bounce; off in tests
  animate?: boolean;
};

// "edit" is the add form filled with one card, like the web /edit/ page
type Screen = "home" | "add" | "edit";

// Export and import pick a file or a QR code, like the web dialog: a share
// link's QR code to show, or a link to paste (a terminal can't scan)
type Modal =
  | { kind: "export"; via: "file" | "qr"; path: Field; error?: string }
  | {
    kind: "import";
    via: "file" | "link";
    path: Field;
    link: Field;
    error?: string;
  }
  // The share link's QR code, drawn with half blocks
  | { kind: "qr"; matrix: boolean[][] }
  | { kind: "delete" }
  // One card's ✕, or Delete on a focused card: focus goes back there
  | { kind: "deleteItem"; index: number; from: string };

type Toast = { kind: "success" | "error"; text: string };

type Form = {
  values: FormValues;
  errors: Errors;
  submitted: boolean;
  // The card being edited, null when adding
  index: number | null;
  // Can't be changed yet: € when adding, the card's own when editing
  currency: string;
};

// Layers, bottom to top
const Z = { page: 10, chrome: 50, toast: 80, modal: 100 };

// Smallest usable terminal
export const MIN_SIZE = { columns: 44, rows: 14 };

// Content never gets wider than this, like the web app's .container
const MAX_WIDTH = 104;

const LOCALES = Object.keys(translations) as Locale[];

export class App {
  #deps: AppDeps;
  #components: ReturnType<typeof createComponents>;

  #size = { columns: 80, rows: 24 };
  #screen: Screen = "home";
  #scroll = 0;
  #pageHeight = 0;
  #focus: string | null = null;
  #hover: string | null = null;
  #pointer: { x: number; y: number } | null = null;
  // Scroll the focused element into view on the next render
  #reveal = false;
  #modal: Modal | null = null;
  #toast: Toast | null = null;
  #cancelToast: (() => void) | null = null;
  #form: Form | null = null;
  #frame = 0;
  #hits: PlacedHit[] = [];

  // Handed to the shared components through their Deps
  #exportTarget = "";
  #importContent: string | null = null;

  constructor(deps: AppDeps) {
    this.#deps = deps;
    const componentDeps: Deps = {
      app: () => deps.store,
      persist: () => this.#persist(),
      // The TUI asks with its own dialog before calling deleteAll()
      confirm: () => true,
      closeForm: () => this.#go("home"),
      // Every render already reads the theme from the store
      setThemeAttribute: () => {},
      transition: (update) => update(),
      // No exit animation in the terminal
      removeItem: (_index, remove) => {
        remove();
        return Promise.resolve();
      },
      download: (_filename, content) =>
        deps.writeFile(this.#exportTarget, content),
      pickFile: () => Promise.resolve(this.#importContent),
      // Updates come with a new binary, not while running
      updater: { onUpdate: () => {}, reload: () => {} },
      // Links point to the web app; the QR code is drawn here (#showQr)
      shareBase: () => SITE_URL,
      qrSvg: () => Promise.reject(new Error("Not in a terminal")),
      copy: () => Promise.resolve(false),
      // There's nothing to install in a terminal
      installer: {
        installed: () => true,
        manual: () => false,
        dismissed: () => true,
        dismiss: () => {},
        onPrompt: () => {},
        onInstalled: () => {},
        prompt: () => Promise.resolve(false),
      },
    };
    this.#components = createComponents(componentDeps);

    if (deps.animate) this.#animate();
  }

  get #store(): Store {
    return this.#deps.store;
  }

  get #t(): I18n {
    return this.#store.i18n;
  }

  get #p(): Palette {
    return palettes[this.#store.theme];
  }

  get #ctx(): Ctx {
    return { p: this.#p, focus: this.#focus, hover: this.#hover };
  }

  // State the tests look at
  get screen(): Screen {
    return this.#screen;
  }
  get focus(): string | null {
    return this.#focus;
  }
  get scroll(): number {
    return this.#scroll;
  }
  get modal(): Modal["kind"] | null {
    return this.#modal?.kind ?? null;
  }
  get toast(): Toast | null {
    return this.#toast;
  }
  get form(): Form | null {
    return this.#form;
  }

  #persist(): void {
    try {
      this.#deps.persist();
    } catch (error) {
      this.#notify("error", (error as Error).message);
    }
  }

  #notify(kind: Toast["kind"], text: string): void {
    this.#cancelToast?.();
    this.#toast = { kind, text };
    this.#cancelToast = this.#deps.schedule(() => {
      this.#toast = null;
      this.#cancelToast = null;
      this.#deps.changed();
    }, kind === "error" ? 6000 : 4000);
  }

  #animate(): void {
    this.#deps.schedule(() => {
      this.#frame++;
      // Only the empty state moves
      if (this.#screen === "home" && this.#store.data.length === 0) {
        this.#deps.changed();
      }
      this.#animate();
    }, 700);
  }

  // Navigation ------------------------------------------------------------

  #go(screen: Screen, index: number | null = null): void {
    // The list is full: say so instead, like the web app's notice
    if (screen === "add" && !this.#store.canAdd) {
      this.#notify("error", this.#components.list().limitText);
      return;
    }
    const edited = this.#form?.index ?? null;
    this.#screen = screen;
    this.#scroll = 0;
    this.#modal = null;
    if (screen !== "home") {
      const { item } = screen === "edit"
        ? this.#components.editForm(index!)
        : this.#components.addForm();
      this.#form = {
        values: initialValues(item),
        errors: {},
        submitted: false,
        index: screen === "edit" ? index : null,
        currency: item.currency,
      };
      // The web form autofocuses the name
      this.#focus = "add.name";
    } else {
      this.#form = null;
      // Back from editing: on the card's ✎, like after a dialog
      this.#focus = edited === null ? null : `card.${edited}.edit`;
      this.#reveal = edited !== null;
    }
  }

  #openModal(modal: Modal): void {
    this.#modal = modal;
    this.#focus = modal.kind === "export" || modal.kind === "import"
      ? "modal.path"
      : "modal.cancel";
  }

  #openExport(): void {
    this.#openModal({
      kind: "export",
      via: "file",
      path: field("subscriptions.json"),
    });
  }

  #openImport(): void {
    this.#openModal({
      kind: "import",
      via: "file",
      path: field("subscriptions.json"),
      link: field(),
    });
  }

  #closeModal(): void {
    const modal = this.#modal;
    const kind = modal?.kind;
    this.#modal = null;
    // Back on the button that opened it
    this.#focus = modal?.kind === "deleteItem"
      ? modal.from
      : kind === "export" || kind === "qr"
      ? "backup.export"
      : kind === "import"
      ? (this.#store.data.length ? "backup.import" : "empty.import")
      : kind === "delete"
      ? "list.delete"
      : null;
    this.#reveal = true;
  }

  // Actions ---------------------------------------------------------------

  #toggleTheme(): void {
    this.#components.header().toggleTheme();
  }

  #setLocale(locale: Locale): void {
    this.#components.header().setLocale(locale);
  }

  #nextLocale(): void {
    const index = LOCALES.indexOf(this.#store.locale);
    this.#setLocale(LOCALES[(index + 1) % LOCALES.length]);
  }

  #exportData(): void {
    if (this.#modal?.kind !== "export") return;
    const target = this.#deps.resolvePath(this.#modal.path.value);
    this.#exportTarget = target;
    try {
      this.#components.backup().exportData();
    } catch {
      this.#modal.error = getTranslation(
        this.#t.tui.writeError,
        this.#deps.displayPath(target),
      );
      return;
    }
    this.#closeModal();
    this.#notify(
      "success",
      getTranslation(this.#t.tui.exported, this.#deps.displayPath(target)),
    );
  }

  async #importData(): Promise<void> {
    const modal = this.#modal;
    if (modal?.kind !== "import") return;
    const source = this.#deps.resolvePath(modal.path.value);
    const shown = this.#deps.displayPath(source);

    let content: string;
    try {
      content = await this.#deps.readFile(source);
    } catch {
      modal.error = getTranslation(this.#t.tui.readError, shown);
      return this.#deps.changed();
    }
    this.#importContent = content;
    const outcome = await this.#components.backup().importData();
    this.#importContent = null;
    if (outcome !== "imported") {
      modal.error = this.#components.transfer().importError(
        outcome === "tooMany" ? outcome : "invalid",
        "file",
      );
      return this.#deps.changed();
    }
    this.#closeModal();
    this.#focus = null;
    this.#scroll = 0;
    this.#notify("success", getTranslation(this.#t.tui.imported, shown));
    this.#deps.changed();
  }

  // Same rules as the web dialog's pasted link
  async #importLink(): Promise<void> {
    const modal = this.#modal;
    if (modal?.kind !== "import") return;
    const transfer = this.#components.transfer();
    transfer.pasted = modal.link.value;
    await transfer.importPasted();
    if (transfer.error) {
      modal.error = transfer.error;
      return this.#deps.changed();
    }
    this.#closeModal();
    this.#focus = null;
    this.#scroll = 0;
    this.#notify("success", this.#t.tui.linkImported);
    this.#deps.changed();
  }

  // The share link the web app's QR code holds, pointing to the web app
  async #showQr(): Promise<void> {
    const modal = this.#modal;
    if (modal?.kind !== "export") return;
    try {
      const link = shareLink(SITE_URL, await encodeShare(this.#store.data));
      this.#openModal({ kind: "qr", matrix: qrMatrix(link) });
    } catch {
      modal.error = this.#t.transfer.qrFailed;
    }
    this.#deps.changed();
  }

  #deleteItem(index: number): void {
    this.#components.list().deleteItem(index);
    this.#modal = null;
    // On the card that took its place, or the new last one
    const count = this.#store.data.length;
    this.#focus = count ? `card.${Math.min(index, count - 1)}` : null;
    this.#reveal = true;
    if (!count) this.#scroll = 0;
  }

  #deleteAll(): void {
    this.#components.list().deleteAll();
    this.#modal = null;
    this.#focus = null;
    this.#scroll = 0;
  }

  #submit(): void {
    const form = this.#form;
    if (!form) return;
    form.submitted = true;
    form.errors = validate(form.values);
    const invalid = (["name", "price", "expiration"] as FieldName[])
      .find((name) => form.errors[name]);
    if (invalid) {
      // Like the browser does with a required field
      this.#focus = `add.${invalid}`;
      this.#reveal = true;
      return;
    }
    const target = form.index === null
      ? this.#components.addForm()
      : this.#components.editForm(form.index);
    target.item = toSubscription(form.values, target.item.currency);
    target.submit();
  }

  #updateField(name: FieldName, update: (f: Field) => Field): void {
    const form = this.#form;
    if (!form) return;
    form.values[name] = update(form.values[name]);
    // Errors show up on submit, then follow the typing
    if (form.submitted) form.errors = validate(form.values);
  }

  // Input -----------------------------------------------------------------

  resize(columns: number, rows: number): void {
    this.#size = { columns, rows };
    this.#reveal = true;
  }

  key(key: Key): void {
    if (key.ctrl && key.key === "c") return this.#deps.quit();

    const focused = this.#hits.find((hit) => hit.id === this.#focus);
    if (focused?.onKey?.(key)) return;

    if (key.key === "tab") return this.#moveFocus(key.shift ? -1 : 1);
    if (["up", "down", "left", "right"].includes(key.key)) {
      return this.#moveFocusTowards(
        key.key as "up" | "down" | "left" | "right",
      );
    }

    if (key.key === "escape") {
      if (this.#modal) return this.#closeModal();
      if (this.#screen !== "home") return this.#go("home");
      this.#focus = null;
      return;
    }

    const page = this.#size.rows - 2;
    switch (key.key) {
      case "pageup":
        return this.#scrollBy(-page + 2);
      case "pagedown":
        return this.#scrollBy(page - 2);
      case "home":
        return this.#scrollBy(-Infinity);
      case "end":
        return this.#scrollBy(Infinity);
    }

    // Shortcuts, only outside dialogs and text fields
    if (this.#modal || focused?.input || key.ctrl || key.meta) return;
    switch (key.key.toLowerCase()) {
      case "q":
        return this.#deps.quit();
      case "t":
        return this.#toggleTheme();
      case "l":
        return this.#nextLocale();
      case "a":
        if (this.#screen === "home") this.#go("add");
        return;
      case "e":
        if (this.#screen === "home" && this.#store.data.length) {
          this.#openExport();
        }
        return;
      // The empty state has an import button too
      case "i":
        if (this.#screen === "home") this.#openImport();
        return;
    }
  }

  // Hits that take input right now: only the dialog's while one is open
  #activeHits(): PlacedHit[] {
    return this.#modal
      ? this.#hits.filter((hit) => hit.layer === "modal")
      : this.#hits;
  }

  #hitAt(x: number, y: number): PlacedHit[] {
    const hits = this.#activeHits().filter((hit) =>
      hit.screen && contains(hit.screen, x, y)
    );
    // Topmost layer first, then in drawing order: small controls are
    // registered before the field they sit on (the sort is stable)
    return hits.sort((a, b) => b.z - a.z);
  }

  click(x: number, y: number): void {
    this.#pointer = { x, y };
    const hits = this.#hitAt(x, y);
    const target = hits[0];
    const focusable = hits.find((hit) => hit.focusable);
    // Clicking on nothing blurs, like on a web page
    if (focusable) this.#focus = focusable.id;
    else if (!target) this.#focus = null;
    target?.onClick?.(x - target.screen!.column, y - target.screen!.row);
  }

  wheel(x: number, y: number, direction: 1 | -1): void {
    const target = this.#hitAt(x, y).find((hit) => hit.onWheel);
    if (target) return target.onWheel!(direction);
    if (!this.#modal) this.#scrollBy(direction * 3);
  }

  // Returns true when the hovered element changed and needs a new frame
  move(x: number, y: number): boolean {
    this.#pointer = { x, y };
    const hover = this.#hitAt(x, y)[0]?.id ?? null;
    if (hover === this.#hover) return false;
    this.#hover = hover;
    return true;
  }

  #scrollBy(rows: number): void {
    const max = Math.max(0, this.#pageHeight - (this.#size.rows - 2));
    this.#scroll = Math.max(0, Math.min(max, this.#scroll + rows));
  }

  // In reading order: the header (drawn right to left) comes before the
  // page, although the page is drawn first. The sort is stable.
  #focusables(): PlacedHit[] {
    const header = (hit: PlacedHit) => hit.layer === "header";
    return this.#activeHits()
      .filter((hit) => hit.focusable)
      .sort((a, b) =>
        header(a) && header(b)
          ? a.unclipped.column - b.unclipped.column
          : Number(header(b)) - Number(header(a))
      );
  }

  #moveFocus(direction: 1 | -1): void {
    const focusables = this.#focusables();
    if (!focusables.length) return;
    const index = focusables.findIndex((hit) => hit.id === this.#focus);
    const next = index < 0
      ? (direction === 1 ? 0 : focusables.length - 1)
      : (index + direction + focusables.length) % focusables.length;
    this.#focus = focusables[next].id;
    this.#reveal = true;
  }

  // Arrow keys move to the nearest element in that direction
  #moveFocusTowards(direction: "up" | "down" | "left" | "right"): void {
    const focusables = this.#focusables();
    const current = focusables.find((hit) => hit.id === this.#focus);
    if (!current) {
      // Start from the page, not the header
      const first = focusables.find((hit) => hit.layer !== "header") ??
        focusables[0];
      this.#focus = first?.id ?? null;
      this.#reveal = true;
      return;
    }

    const middle = (rect: Rect) => ({
      x: rect.column + rect.width / 2,
      y: rect.row + rect.height / 2,
    });
    // Controls set inside another one (a card's ✕) are skipped: arrows move
    // between cards, Tab and the mouse reach the ✕, and moving from it
    // starts from its card
    const containerOf = (hit: PlacedHit) =>
      focusables.find((other) =>
        other !== hit && encloses(other.unclipped, hit.unclipped)
      );
    const from = (containerOf(current) ?? current).unclipped;
    const origin = middle(from);
    let best: PlacedHit | null = null;
    let bestScore = Infinity;

    for (const hit of focusables) {
      if (hit === current || containerOf(hit)) continue;
      const rect = hit.unclipped;
      const target = middle(rect);
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      // Entirely on that side, not just a bit shifted
      const ahead = direction === "up"
        ? rect.row + rect.height <= from.row
        : direction === "down"
        ? rect.row >= from.row + from.height
        : direction === "left"
        ? rect.column + rect.width <= from.column
        : rect.column >= from.column + from.width;
      if (!ahead) continue;

      const vertical = direction === "up" || direction === "down";
      // Rows are about twice as tall as columns are wide
      const along = vertical ? Math.abs(dy) * 2 : Math.abs(dx);
      const across = vertical ? Math.abs(dx) : Math.abs(dy) * 2;
      const score = along + across * 2;
      if (score < bestScore) {
        best = hit;
        bestScore = score;
      }
    }

    if (best) {
      this.#focus = best.id;
      this.#reveal = true;
    }
  }

  // Keys for a text field; filter drops characters the field doesn't take
  #fieldKeys(
    name: FieldName,
    options: {
      filter?: RegExp;
      step?: (value: string, direction: 1 | -1, big: boolean) => string;
    } = {},
  ) {
    return (key: Key): boolean => {
      const edit = (update: (f: Field) => Field) => {
        this.#updateField(name, update);
        return true;
      };
      switch (key.key) {
        case "backspace":
          return edit(backspace);
        case "delete":
          return edit(deleteForward);
        case "left":
        case "right":
        case "home":
        case "end":
          return edit((f) => moveCursor(f, key.key as "left"));
        case "return":
          this.#submit();
          return true;
      }
      const { step } = options;
      if (step) {
        const direction = key.key === "up" || key.key === "pageup"
          ? 1
          : key.key === "down" || key.key === "pagedown"
          ? -1
          : 0;
        if (direction) {
          const big = key.key === "pageup" || key.key === "pagedown";
          return edit((f) => field(step(f.value, direction, big)));
        }
      }
      if (key.typed && !key.ctrl && !key.meta) {
        const text = options.filter
          ? [...key.typed].filter((char) => options.filter!.test(char)).join(
            "",
          )
          : key.typed;
        if (text) edit((f) => insert(f, text));
        return true;
      }
      return false;
    };
  }

  // Rendering -------------------------------------------------------------

  render(): { nodes: Node[]; hits: PlacedHit[] } {
    let output = this.#build();
    this.#hits = output.hits;
    if (this.#reveal) {
      this.#reveal = false;
      if (this.#revealFocus()) {
        output = this.#build();
        this.#hits = output.hits;
      }
    }
    // Elements move under a still pointer when the page changes
    if (this.#pointer) {
      this.#hover = this.#hitAt(this.#pointer.x, this.#pointer.y)[0]?.id ??
        null;
    }
    return output;
  }

  // Scrolls the page so the focused element is visible
  #revealFocus(): boolean {
    const hit = this.#hits.find((h) =>
      h.id === this.#focus && h.layer === "page"
    );
    if (!hit) return false;
    const top = 1;
    const bottom = this.#size.rows - 1;
    const rect = hit.unclipped;
    const before = this.#scroll;
    // Keep a row of context around it
    if (rect.row - 1 < top) this.#scrollBy(rect.row - 1 - top);
    else if (rect.row + rect.height + 1 > bottom) {
      this.#scrollBy(rect.row + rect.height + 1 - bottom);
    }
    return this.#scroll !== before;
  }

  #build(): { nodes: Node[]; hits: PlacedHit[] } {
    const { columns, rows } = this.#size;
    const p = this.#p;
    const screen = { column: 0, row: 0, width: columns, height: rows };
    const root = new Painter({ layer: "root", z: 0, clip: screen });
    root.box("bg", screen, { bg: p.bg });

    if (columns < MIN_SIZE.columns || rows < MIN_SIZE.rows) {
      const message = wrap(
        `${this.#t.header.brand}: ${MIN_SIZE.columns}×${MIN_SIZE.rows}+`,
        columns,
      );
      message.forEach((line, index) =>
        root.text(
          `small.${index}`,
          0,
          Math.floor(rows / 2) + index,
          center(line, columns),
          { fg: p.muted, bg: p.bg },
        )
      );
      return { nodes: root.nodes, hits: root.hits };
    }

    // The empty state carries the header's controls itself, like the web
    // app: no header row then, the page starts at the top
    const header = !this.#isEmpty();
    const top = header ? 1 : 0;
    const viewport = {
      column: 0,
      row: top,
      width: columns,
      height: rows - 1 - top,
    };
    const page = root.sub({
      layer: "page",
      z: Z.page,
      clip: viewport,
      dy: top - this.#scroll,
    });
    this.#pageHeight = this.#screen !== "home"
      ? this.#drawAdd(page)
      : this.#store.data.length
      ? this.#drawDashboard(page)
      : this.#drawEmpty(page);
    // The page may have got shorter (e.g. after deleting everything)
    const max = Math.max(0, this.#pageHeight - viewport.height);
    if (this.#scroll > max) {
      this.#scroll = max;
      return this.#build();
    }

    this.#drawScrollbar(root, viewport);
    if (header) {
      const painter = root.sub({ layer: "header", z: Z.chrome, clip: screen });
      painter.box("bar", { column: 0, row: 0, width: columns, height: 1 }, {
        bg: p.surface,
      });
      this.#drawHeader(painter, { ...this.#container(), row: 0 });
    }
    this.#drawStatus(root.sub({ layer: "status", z: Z.chrome, clip: screen }));
    if (this.#toast) {
      this.#drawToast(root.sub({ layer: "toast", z: Z.toast, clip: screen }));
    }
    if (this.#modal) {
      this.#drawModal(root.sub({ layer: "modal", z: Z.modal, clip: screen }));
    }
    return { nodes: root.nodes, hits: root.hits };
  }

  // Centered content column, like .container
  #container(): { left: number; width: number } {
    const width = Math.min(MAX_WIDTH, this.#size.columns - 4);
    return { left: Math.floor((this.#size.columns - width) / 2), width };
  }

  // The home page with no subscriptions yet
  #isEmpty(): boolean {
    return this.#screen === "home" && this.#store.data.length === 0;
  }

  // Brand on the left, language and theme buttons on the right, on one row
  // on a surface background: the header bar, or the top of the empty state
  #drawHeader(
    painter: Painter,
    { left, width, row }: { left: number; width: number; row: number },
  ): void {
    const p = this.#p;
    const t = this.#t;
    const ctx = this.#ctx;
    const bar = { bg: p.surface };

    // Right side first, so the brand knows how much room it has
    let x = left + width;
    const themeLabel = this.#store.theme === "dark" ? "☼" : "☾";
    x -= buttonWidth(themeLabel);
    button(painter, ctx, {
      id: "theme",
      column: x,
      row,
      label: themeLabel,
      bg: p.surface,
      onPress: () => this.#toggleTheme(),
    });

    x -= 1;
    const languages = [...LOCALES].reverse();
    for (const code of languages) {
      const label = code.toUpperCase();
      x -= buttonWidth(label);
      const selected = this.#store.locale === code;
      button(painter, ctx, {
        id: `lang.${code}`,
        column: x,
        row,
        label,
        // The picked language looks pressed, like aria-pressed on the web
        variant: selected ? "primary" : "ghost",
        bg: p.surface,
        onPress: () => this.#setLocale(code),
      });
    }

    const brandFocus = ctx.focus === "brand" || ctx.hover === "brand";
    const logo = " ◈ ";
    const name = truncate(t.header.brand, x - left - textWidth(logo) - 3);
    const brandWidth = painter.line("brand", left, row, [
      { text: logo, style: { fg: p.onAccent, bg: p.accent, bold: true } },
      { text: " ", style: bar },
      {
        text: name,
        style: {
          fg: brandFocus ? p.accentStrong : p.text,
          bg: p.surface,
          bold: true,
          underline: ctx.focus === "brand",
        },
      },
    ]);
    painter.hit({
      id: "brand",
      rect: { column: left, row, width: brandWidth, height: 1 },
      focusable: true,
      onClick: () => this.#go("home"),
      onKey: (key) => {
        if (key.key !== "return" && key.key !== "space") return false;
        this.#go("home");
        return true;
      },
    });
  }

  #drawStatus(painter: Painter): void {
    const p = this.#p;
    const h = this.#t.tui.hints;
    const { columns, rows } = this.#size;
    const row = rows - 1;
    painter.box("bar", { column: 0, row, width: columns, height: 1 }, {
      bg: p.surface2,
    });

    // The page is drawn already: its hits are in this frame's output
    const focused = painter.hits.find((hit) => hit.id === this.#focus);
    const stepper = this.#focus === "add.price" ||
      this.#focus === "add.expiration";
    const hints: [string, string][] = this.#modal
      ? [["Tab", h.move], ["Enter", h.select], ["Esc", h.back]]
      : [
        ["Tab", h.move],
        ...(stepper ? [["↑↓", h.adjust] as [string, string]] : []),
        ["Enter", h.select],
        ...(/^card\.\d+$/.test(this.#focus ?? "")
          ? [["Del", h.delete] as [string, string]]
          : []),
        ...(this.#screen !== "home"
          ? [["Esc", h.back] as [string, string]]
          : [["a", h.add] as [string, string]]),
        ...(focused?.input ? [] : [
          ["t", h.theme] as [string, string],
          ["l", h.language] as [string, string],
        ]),
        [focused?.input ? "Ctrl+C" : "q", h.quit],
        ["PgUp/PgDn", h.scroll],
      ];

    let x = 1;
    hints.forEach(([key, label], index) => {
      const width = textWidth(key) + textWidth(label) + 4;
      if (x + width > columns) return;
      painter.line(`hint${index}`, x, row, [
        {
          text: ` ${key} `,
          style: { fg: p.accentStrong, bg: p.accentSoft, bold: true },
        },
        { text: ` ${label} `, style: { fg: p.muted, bg: p.surface2 } },
      ]);
      x += width;
    });
  }

  #drawScrollbar(painter: Painter, viewport: Rect): void {
    const total = this.#pageHeight;
    const visible = viewport.height;
    if (total <= visible) return;
    const p = this.#p;
    const bar = painter.sub({
      layer: "scrollbar",
      z: Z.chrome,
      clip: viewport,
    });
    const column = viewport.column + viewport.width - 1;
    const size = Math.max(1, Math.round(visible * visible / total));
    const max = total - visible;
    const top = viewport.row +
      Math.round((visible - size) * (this.#scroll / max));
    bar.box("track", { ...viewport, column, width: 1 }, {
      fg: p.border,
      bg: p.bg,
    }, { filler: "│" });
    bar.box("thumb", { column, row: top, width: 1, height: size }, {
      fg: this.#hover === "scrollbar" ? p.accentStrong : p.fieldBorder,
      bg: p.bg,
    }, { z: 1, filler: "┃" });
    bar.hit({
      id: "scrollbar",
      rect: { ...viewport, column, width: 1 },
      onClick: (_x, y) => {
        this.#scroll = Math.round(max * y / Math.max(1, visible - 1));
      },
    });
  }

  #drawToast(painter: Painter): void {
    const toast = this.#toast!;
    const p = this.#p;
    const { columns, rows } = this.#size;
    const success = toast.kind === "success";
    const icon = success ? "✓" : "✕";
    const width = Math.min(columns - 4, textWidth(toast.text) + 6);
    const column = columns - width - 2;
    const row = rows - 4;
    const fg = success ? p.success : p.danger;
    const bg = success ? p.successSoft : p.dangerSoft;
    frame(painter, "frame", { column, row, width, height: 3 }, {
      border: fg,
      fill: bg,
      outside: p.bg,
    });
    painter.line("text", column + 2, row + 1, [
      { text: `${icon} `, style: { fg, bg, bold: true } },
      { text: truncate(toast.text, width - 6), style: { fg: p.text, bg } },
    ]);
    painter.hit({
      id: "toast",
      rect: { column, row, width, height: 3 },
      onClick: () => {
        this.#cancelToast?.();
        this.#toast = null;
      },
    });
  }

  // The web panels have a shadow too: a line needs a bit more contrast
  #panelBorder(): string {
    return mix(this.#p.border, this.#p.text, 0.12);
  }

  // Section title, like .section-title
  #title(
    painter: Painter,
    key: string,
    column: number,
    row: number,
    text: string,
    width: number,
  ) {
    const p = this.#p;
    painter.text(key, column, row, truncate(text, width), {
      fg: p.text,
      bg: p.bg,
      bold: true,
    });
  }

  // Empty state -------------------------------------------------------------

  #drawEmpty(painter: Painter): number {
    const p = this.#p;
    const t = this.#t;
    const ctx = this.#ctx;
    const { left, width } = this.#container();
    const panelWidth = Math.min(width, 72);
    const column = left + Math.floor((width - panelWidth) / 2);
    const inner = panelWidth - 6;
    const cta = `${t.empty.cta}`;
    const example = t.empty.default;
    const inline = buttonWidth(cta, "+") + buttonWidth(example, "✦") +
        textWidth(t.empty.or) + 4 <= inner;
    const message = wrap(t.empty.message, inner);
    const row = 1;

    // The header's controls, in a bar across the top of the panel
    this.#drawHeader(painter, { left: column + 3, width: inner, row: row + 1 });
    painter.text(
      "bar.rule",
      column,
      row + 2,
      `├${"─".repeat(panelWidth - 2)}┤`,
      // Over the frame's sides, so its ends join them
      { fg: this.#panelBorder(), bg: p.surface },
      0,
    );

    this.#drawIllustration(
      painter,
      column + Math.floor((panelWidth - 34) / 2),
      row + 3,
    );

    let y = row + 14;
    painter.text(
      "title",
      column + 3,
      y,
      center(truncate(t.empty.title, inner), inner),
      {
        fg: p.text,
        bg: p.surface,
        bold: true,
      },
    );
    y += 2;
    message.forEach((line, index) => {
      painter.text(
        `message.${index}`,
        column + 3,
        y + index,
        center(line, inner),
        {
          fg: p.muted,
          bg: p.surface,
        },
      );
    });
    y += message.length + 1;

    const addButton = (x: number, yy: number) =>
      button(painter, ctx, {
        id: "empty.add",
        column: x,
        row: yy,
        label: cta,
        icon: "+",
        variant: "primary",
        bg: p.surface,
        onPress: () => this.#go("add"),
      });
    const mockButton = (x: number, yy: number) =>
      button(painter, ctx, {
        id: "empty.mock",
        column: x,
        row: yy,
        label: example,
        icon: "✦",
        bg: p.surface,
        onPress: () => {
          this.#components.empty().useMock();
          this.#focus = null;
        },
      });

    if (inline) {
      const total = buttonWidth(cta, "+") + buttonWidth(example, "✦") +
        textWidth(t.empty.or) + 4;
      let x = column + Math.floor((panelWidth - total) / 2);
      x += addButton(x, y) + 2;
      x +=
        painter.text("or", x, y, t.empty.or, { fg: p.muted, bg: p.surface }) +
        2;
      mockButton(x, y);
    } else {
      addButton(
        column + Math.floor((panelWidth - buttonWidth(cta, "+")) / 2),
        y,
      );
      painter.text("or", column + 3, y + 2, center(t.empty.or, inner), {
        fg: p.muted,
        bg: p.surface,
      });
      mockButton(
        column + Math.floor((panelWidth - buttonWidth(example, "✦")) / 2),
        y + 4,
      );
    }
    y += inline ? 2 : 6;

    // Import, as the panel's bottom row (the header's bar mirrors it)
    painter.text(
      "import.rule",
      column,
      y,
      `├${"─".repeat(panelWidth - 2)}┤`,
      { fg: this.#panelBorder(), bg: p.surface },
      0,
    );
    y += 2;
    const importLabel = t.backup.import;
    button(painter, ctx, {
      id: "empty.import",
      column: column +
        Math.floor((panelWidth - buttonWidth(importLabel, "↑")) / 2),
      row: y,
      label: importLabel,
      icon: "↑",
      bg: p.surface,
      onPress: () => this.#openImport(),
    });
    y += 2;

    const height = y - row + 1;
    frame(painter, "panel", { column, row, width: panelWidth, height }, {
      border: this.#panelBorder(),
      fill: p.surface,
      outside: p.bg,
      z: -2,
    });

    return this.#drawFooter(painter, row + height + 1);
  }

  // Fanned subscription cards and bouncing coins, after the web app's
  // empty-illustration (34×10)
  #drawIllustration(painter: Painter, column: number, row: number): void {
    const { illo } = this.#p;
    const p = this.#p;
    const bounce = this.#frame % 2;
    const blob = { column: column + 2, row, width: 30, height: 10 };
    frame(painter, "illo.blob", blob, {
      border: illo.blob,
      fill: illo.blob,
      outside: p.surface,
      z: 1,
    });

    const card = (
      key: string,
      x: number,
      y: number,
      tint: string,
      z: number,
    ) => {
      frame(painter, key, { column: x, row: y, width: 18, height: 5 }, {
        border: illo.stroke,
        fill: illo.card,
        outside: illo.blob,
        z,
      });
      painter.box(`${key}.avatar`, {
        column: x + 2,
        row: y + 1,
        width: 4,
        height: 2,
      }, {
        bg: tint,
      }, { z: z + 2 });
      painter.text(`${key}.line1`, x + 7, y + 1, "▆▆▆▆▆▆▆", {
        fg: illo.line,
        bg: illo.card,
      }, z + 2);
      painter.text(`${key}.line2`, x + 7, y + 2, "▆▆▆▆", {
        fg: illo.line,
        bg: illo.card,
      }, z + 2);
      painter.text(`${key}.price`, x + 2, y + 3, "▆▆▆▆▆▆▆▆▆▆▆", {
        fg: illo.lav,
        bg: illo.card,
      }, z + 2);
    };
    card("illo.back", column + 5, row + 1, illo.mint, 3);
    card("illo.front", column + 11, row + 4, illo.peach, 6);

    const coin = (
      key: string,
      x: number,
      y: number,
      symbol: string,
      bg: string,
    ) => {
      painter.line(key, x, y, [
        { text: "▐", style: { fg: bg, bg: illo.blob } },
        { text: symbol, style: { fg: illo.stroke, bg, bold: true } },
        { text: "▌", style: { fg: bg, bg: illo.blob } },
      ], 10);
    };
    coin("illo.euro", column + 27, row + 1 + bounce, "€", illo.butter);
    coin("illo.dollar", column + 5, row + 7 - bounce, "$", illo.pink);
    painter.text("illo.spark", column + 25, row + 6, "✦", {
      fg: illo.lav,
      bg: illo.blob,
    }, 10);
  }

  // Dashboard and list ----------------------------------------------------

  #drawDashboard(painter: Painter): number {
    const p = this.#p;
    const t = this.#t;
    const ctx = this.#ctx;
    const { left, width } = this.#container();
    const dashboard = this.#components.dashboard();
    const list = this.#components.list();
    let y = 1;

    this.#title(painter, "stats.title", left, y, t.main.title, width);
    y += 2;

    const tiles = [
      {
        key: "total",
        label: t.main.total,
        value: dashboard.total.toString(),
        description: dashboard.inactives,
        tint: p.tint.lav,
      },
      {
        key: "monthly",
        label: t.main.monthly,
        value: dashboard.monthly,
        description: t.main.detail,
        tint: p.tint.mint,
      },
      {
        key: "yearly",
        label: t.main.yearly,
        value: dashboard.yearly,
        description: t.main.detail,
        tint: p.tint.peach,
      },
    ];
    const inRow = width >= 3 * 24 + 4;
    const tileWidth = inRow ? Math.floor((width - 4) / 3) : width;
    // Room for two lines of description when one isn't enough
    const lines = Math.min(
      2,
      Math.max(
        ...tiles.map((tile) => wrap(tile.description, tileWidth - 4).length),
      ),
    );
    const tileHeight = 6 + lines;
    tiles.forEach((tile, index) => {
      const column = inRow ? left + index * (tileWidth + 2) : left;
      const row = inRow ? y : y + index * (tileHeight + 1);
      this.#drawStat(painter, tile, {
        column,
        row,
        width: tileWidth,
        height: tileHeight,
      });
    });
    y += inRow ? tileHeight + 1 : 3 * (tileHeight + 1);

    y += 1;
    const cta = t.main.cta;
    const ctaWidth = buttonWidth(cta, "+");
    this.#title(
      painter,
      "list.title",
      left,
      y,
      t.main.list,
      width - ctaWidth - 2,
    );
    const full = !this.#store.canAdd;
    button(painter, ctx, {
      id: "list.add",
      column: left + width - ctaWidth,
      row: y,
      label: cta,
      icon: "+",
      variant: "primary",
      bg: p.bg,
      disabled: full,
      onPress: () => this.#go("add"),
    });
    y += 2;

    // Why the button is disabled, like the web app's .subs__limit
    if (full) {
      wrap(`▲ ${list.limitText}`, width).forEach((line, index) => {
        painter.text(`list.limit.${index}`, left, y, line, {
          fg: p.accentStrong,
          bg: p.bg,
          bold: true,
        });
        y += 1;
      });
      y += 1;
    }

    const minCard = 30;
    const columns = Math.max(1, Math.floor((width + 2) / (minCard + 2)));
    const cardWidth = Math.floor((width - 2 * (columns - 1)) / columns);
    this.#store.data.forEach((item, index) => {
      const column = left + (index % columns) * (cardWidth + 2);
      const row = y + Math.floor(index / columns) * 8;
      const id = `card.${index}`;
      const focused = ctx.focus === id;
      const hover = ctx.hover === id;
      const active = item.isActive;
      const due = list.expiresThisMonth(item);
      const fill = active ? p.surface : p.surface2;
      frame(painter, id, { column, row, width: cardWidth, height: 7 }, {
        border: focused
          ? p.accentStrong
          : hover
          ? p.fieldBorder
          : due
          ? p.accent
          : this.#panelBorder(),
        fill,
        outside: p.bg,
        dashed: !active,
        bold: focused,
      });

      const tint = active ? p.tints[index % p.tints.length] : p.border;
      const letter = item.name.trim().charAt(0).toUpperCase() || "?";
      painter.box(`${id}.avatar`, {
        column: column + 2,
        row: row + 1,
        width: 5,
        height: 2,
      }, {
        bg: tint,
      }, { z: 2 });
      painter.text(`${id}.letter`, column + 4, row + 1, letter, {
        fg: active ? p.text : p.muted,
        bg: tint,
        bold: true,
      }, 3);
      const textColumn = column + 9;
      // Room for the ✕ in the top right corner
      const textWidthLeft = cardWidth - 14;
      painter.text(
        `${id}.name`,
        textColumn,
        row + 1,
        truncate(item.name, textWidthLeft),
        {
          fg: p.text,
          bg: fill,
          bold: true,
        },
        2,
      );

      const status = list.status(item);
      const pill = active
        ? { fg: p.success, bg: p.successSoft }
        : { fg: p.muted, bg: p.surface };
      painter.line(`${id}.status`, textColumn - 1, row + 2, [
        { text: "▐", style: { fg: pill.bg, bg: fill } },
        {
          text: `${active ? "●" : "○"} ${status}`,
          style: { ...pill, bold: true, underline: hover || focused },
        },
        { text: "▌", style: { fg: pill.bg, bg: fill } },
      ], 2);

      const price = `${item.price}${item.currency}`;
      painter.line(`${id}.price`, column + 2, row + 4, [
        { text: price, style: { fg: p.text, bg: fill, bold: true } },
        { text: " ", style: { bg: fill } },
        {
          text: truncate(
            list.recurrence(item),
            cardWidth - 5 - textWidth(price),
          ),
          style: { fg: p.muted, bg: fill },
        },
      ], 2);
      painter.text(
        `${id}.expires`,
        column + 2,
        row + 5,
        truncate(`▦ ${t.main.expires} ${list.expiration(item)}`, cardWidth - 4),
        due
          ? { fg: p.accentStrong, bg: fill, bold: true }
          : { fg: p.muted, bg: fill },
        2,
      );
      // Expiring this month: a badge set into the top border
      const badge = ` ${t.main.thisMonth} `;
      if (due && textWidth(badge) <= cardWidth - 4) {
        painter.text(
          `${id}.due`,
          column + cardWidth - 2 - textWidth(badge),
          row,
          badge,
          { fg: p.accentStrong, bg: p.accentSoft, bold: true },
          2,
        );
      }

      // Delete icon, registered before the card so clicks on it win
      const deleteId = `${id}.delete`;
      const askDelete = (from: string) =>
        this.#openModal({ kind: "deleteItem", index, from });
      painter.text(
        deleteId,
        column + cardWidth - 5,
        row + 1,
        " ✕ ",
        ctx.focus === deleteId
          ? { fg: p.bg, bg: p.accentStrong, bold: true }
          : ctx.hover === deleteId
          ? { fg: p.danger, bg: p.dangerSoft, bold: true }
          : { fg: p.muted, bg: fill },
        2,
      );
      painter.hit({
        id: deleteId,
        rect: {
          column: column + cardWidth - 5,
          row: row + 1,
          width: 3,
          height: 1,
        },
        focusable: true,
        onClick: () => askDelete(deleteId),
        onKey: (key) => {
          if (key.key !== "return" && key.key !== "space") return false;
          askDelete(deleteId);
          return true;
        },
      });

      // Edit icon under the ✕, registered before the card too
      const editId = `${id}.edit`;
      painter.text(
        editId,
        column + cardWidth - 5,
        row + 2,
        " ✎ ",
        ctx.focus === editId
          ? { fg: p.bg, bg: p.accentStrong, bold: true }
          : ctx.hover === editId
          ? { fg: p.accentStrong, bg: p.accentSoft, bold: true }
          : { fg: p.muted, bg: fill },
        2,
      );
      painter.hit({
        id: editId,
        rect: {
          column: column + cardWidth - 5,
          row: row + 2,
          width: 3,
          height: 1,
        },
        focusable: true,
        onClick: () => this.#go("edit", index),
        onKey: (key) => {
          if (key.key !== "return" && key.key !== "space") return false;
          this.#go("edit", index);
          return true;
        },
      });

      // The whole card toggles, the pill shows the state
      const toggle = () => list.toggleActive(index);
      painter.hit({
        id,
        rect: { column, row, width: cardWidth, height: 7 },
        focusable: true,
        onClick: toggle,
        onKey: (key) => {
          if (key.key === "delete" || key.key === "backspace") {
            askDelete(id);
            return true;
          }
          if (key.key !== "return" && key.key !== "space") return false;
          toggle();
          return true;
        },
      });
    });
    y += Math.ceil(this.#store.data.length / columns) * 8;

    // Backup on the left, delete on the right, wrapping when narrow
    const exportLabel = t.backup.export;
    const importLabel = t.backup.import;
    const deleteLabel = t.main.delete;
    const backupWidth = buttonWidth(exportLabel, "↓") + 1 +
      buttonWidth(importLabel, "↑");
    const deleteWidth = buttonWidth(deleteLabel, "✕");
    const oneRow = backupWidth + deleteWidth + 2 <= width;
    let x = left;
    x += button(painter, ctx, {
      id: "backup.export",
      column: x,
      row: y,
      label: exportLabel,
      icon: "↓",
      bg: p.bg,
      onPress: () => this.#openExport(),
    }) + 1;
    button(painter, ctx, {
      id: "backup.import",
      column: x,
      row: y,
      label: importLabel,
      icon: "↑",
      bg: p.bg,
      onPress: () => this.#openImport(),
    });
    button(painter, ctx, {
      id: "list.delete",
      column: oneRow ? left + width - deleteWidth : left,
      row: oneRow ? y : y + 2,
      label: deleteLabel,
      icon: "✕",
      variant: "danger",
      bg: p.bg,
      onPress: () => this.#openModal({ kind: "delete" }),
    });
    y += oneRow ? 2 : 4;

    return this.#drawFooter(painter, y + 1);
  }

  #drawStat(
    painter: Painter,
    tile: {
      key: string;
      label: string;
      value: string;
      description: string;
      tint: string;
    },
    rect: Rect,
  ): void {
    const p = this.#p;
    const { column, row, width } = rect;
    const key = `stat.${tile.key}`;
    const inner = width - 4;
    frame(painter, key, rect, {
      border: tile.tint,
      fill: tile.tint,
      outside: p.bg,
    });
    const style = { fg: p.text, bg: tile.tint };
    painter.text(
      `${key}.label`,
      column + 2,
      row + 1,
      truncate(tile.label, inner),
      {
        ...style,
        fg: p.muted,
        bold: true,
      },
      2,
    );

    // Big digits when they fit, spaced out if there's room
    let big = bigText(tile.value);
    if (big && textWidth(big[0]) > inner) {
      const tight = [...tile.value].map((char) => bigText(char)!);
      big = [0, 1, 2].map((line) =>
        tight.map((glyph) => glyph[line]).join("")
      ) as [
        string,
        string,
        string,
      ];
    }
    if (big && textWidth(big[0]) <= inner) {
      big.forEach((line, index) =>
        painter.text(
          `${key}.value${index}`,
          column + 2,
          row + 2 + index,
          line,
          {
            ...style,
            bold: true,
          },
          2,
        )
      );
    } else {
      painter.text(
        `${key}.value`,
        column + 2,
        row + 3,
        truncate(tile.value, inner),
        {
          ...style,
          bold: true,
        },
        2,
      );
    }
    const lines = wrap(tile.description, inner);
    const room = rect.height - 6;
    lines.slice(0, room).forEach((line, index) => {
      const last = index === room - 1 && lines.length > room;
      painter.text(
        `${key}.description${index}`,
        column + 2,
        row + 5 + index,
        last ? truncate(lines.slice(index).join(" "), inner) : line,
        { ...style, fg: p.muted },
        2,
      );
    });
  }

  // Footer, like partials/footer.vto. Returns the page height.
  #drawFooter(painter: Painter, row: number): number {
    const p = this.#p;
    const t = this.#t;
    const { left, width } = this.#container();
    const muted: StyleOptions = { fg: p.muted, bg: p.bg };
    const parts = [
      {
        text: `${t.footer.license} ${new Date().getFullYear()} · `,
        style: muted,
      },
      { text: t.footer.project, style: { ...muted, underline: true } },
      { text: ` ${t.footer.madeBy} Salvatore Laisa`, style: muted },
    ];
    const total = parts.reduce((sum, part) => sum + textWidth(part.text), 0);
    let y = row;
    if (total <= width) {
      painter.line("footer", left + Math.floor((width - total) / 2), y, parts);
      y += 1;
    } else {
      const text = parts.map((part) => part.text).join("");
      wrap(text, width).forEach((line, index) => {
        painter.text(`footer.${index}`, left, y, center(line, width), muted);
        y += 1;
      });
    }
    const storage = getTranslation(this.#t.tui.storage, this.#deps.dataFile);
    painter.text("storage", left, y, center(truncate(storage, width), width), {
      ...muted,
      italic: true,
    });
    return y + 2;
  }

  // Add form ----------------------------------------------------------------

  #drawAdd(painter: Painter): number {
    const p = this.#p;
    const t = this.#t;
    const ctx = this.#ctx;
    const form = this.#form!;
    const { values, errors } = form;
    const { left, width } = this.#container();
    const panelWidth = Math.min(width, 84);
    const column = left + Math.floor((width - panelWidth) / 2);
    const inner = panelWidth - 6;
    const x0 = column + 3;
    const bg = p.surface;
    const message = (name: FieldName) =>
      errors[name] ? t.tui[errors[name]!] as string : undefined;

    // The panel is drawn last, around what the fields needed
    let y = 2;

    const back = `← ${t.add.back}`;
    const backActive = ctx.focus === "add.back" || ctx.hover === "add.back";
    painter.text("back", x0, y, truncate(back, inner), {
      fg: p.accentStrong,
      bg,
      bold: true,
      underline: backActive,
    }, 2);
    painter.hit({
      id: "add.back",
      rect: {
        column: x0,
        row: y,
        width: Math.min(textWidth(back), inner),
        height: 1,
      },
      focusable: true,
      onClick: () => this.#go("home"),
      onKey: (key) => {
        if (key.key !== "return" && key.key !== "space") return false;
        this.#go("home");
        return true;
      },
    });
    y += 2;

    const editing = form.index !== null;
    painter.text(
      "title",
      x0,
      y,
      truncate((editing ? t.edit : t.add).title, inner),
      {
        fg: p.text,
        bg,
        bold: true,
      },
      2,
    );
    y += 2;

    // Like the web /edit/ page, editing has no intro
    const intro = editing ? [] : wrapSpans(parseStrong(t.add.intro), inner);
    intro.forEach((line, index) => {
      painter.line(
        `intro.${index}`,
        x0,
        y,
        line.map((span) => ({
          text: span.text,
          style: { fg: span.bold ? p.text : p.muted, bg, bold: span.bold },
        })),
        2,
      );
      y += 1;
    });
    if (!editing) y += 1;

    const twoColumns = inner >= 50;
    const half = twoColumns ? Math.floor((inner - 3) / 2) : inner;
    const second = twoColumns ? x0 + half + 3 : x0;
    const place = (index: number) =>
      twoColumns
        ? {
          column: index ? second : x0,
          width: index ? inner - half - 3 : half,
        }
        : { column: x0, width: inner };

    const nameHeight = input(painter, ctx, {
      id: "add.name",
      column: x0,
      row: y,
      width: inner,
      label: t.add.name,
      field: values.name,
      placeholder: t.add.namePlaceholder,
      error: message("name"),
      bg,
      onKey: this.#fieldKeys("name"),
      onClick: (offset) => this.#clickField("name", offset),
    });
    y += nameHeight + 1;

    const priceField = () =>
      input(painter, ctx, {
        id: "add.price",
        ...place(0),
        row: y,
        label: t.add.price,
        field: values.price,
        placeholder: "10.00",
        error: message("price"),
        bg,
        controls: [
          { label: "−", onPress: () => this.#step("price", -1) },
          { label: "+", onPress: () => this.#step("price", 1) },
        ],
        onKey: this.#fieldKeys("price", {
          filter: /[\d.,]/,
          step: (value, direction) => stepPrice(value, direction),
        }),
        onWheel: (direction) => this.#step("price", direction === 1 ? -1 : 1),
        onClick: (offset) => this.#clickField("price", offset),
      });
    // Disabled on the web too: new items are in euros, edited ones keep theirs
    const currencyName = form.currency === "$" ? t.add.dollar : t.add.euro;
    const currencyField = (row: number) =>
      input(painter, ctx, {
        id: "add.currency",
        ...place(1),
        row,
        label: t.add.currency,
        field: field(),
        display: `${form.currency} ${currencyName}`,
        disabled: true,
        bg,
      });

    const rowHeight = (a: number, b: number) => Math.max(a, b) + 1;
    if (twoColumns) {
      y += rowHeight(priceField(), currencyField(y));
    } else {
      y += priceField() + 1;
      y += currencyField(y) + 1;
    }

    const date = values.expiration.value;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00`)
      : null;
    const readable = parsed && !isNaN(parsed.getTime())
      ? parsed.toLocaleDateString(this.#store.locale, { dateStyle: "medium" })
      : undefined;
    const expirationField = () =>
      input(painter, ctx, {
        id: "add.expiration",
        ...place(0),
        row: y,
        label: t.add.expiration,
        field: values.expiration,
        placeholder: "YYYY-MM-DD",
        error: message("expiration"),
        note: readable,
        bg,
        controls: [
          { label: "‹", onPress: () => this.#step("expiration", -1) },
          { label: "›", onPress: () => this.#step("expiration", 1) },
        ],
        onKey: this.#fieldKeys("expiration", {
          filter: /[\d-]/,
          step: (value, direction, big) =>
            big ? stepDate(value, 0, direction) : stepDate(value, direction),
        }),
        onWheel: (direction) =>
          this.#step("expiration", direction === 1 ? -1 : 1),
        onClick: (offset) => this.#clickField("expiration", offset),
      });
    const recurrenceField = (row: number) =>
      segmented(painter, ctx, {
        id: "add.recurrence",
        ...place(1),
        row,
        label: t.add.recurrence,
        value: values.recurrence,
        choices: [
          { value: "monthly", label: t.recurrence.monthly },
          { value: "yearly", label: t.recurrence.yearly },
        ],
        bg,
        onChange: (value) => {
          values.recurrence = value;
        },
      });
    if (twoColumns) {
      y += rowHeight(expirationField(), recurrenceField(y));
    } else {
      y += expirationField() + 1;
      y += recurrenceField(y) + 1;
    }

    toggle(painter, ctx, {
      id: "add.active",
      column: x0,
      row: y,
      label: t.add.active,
      on: values.isActive,
      bg,
      onToggle: () => {
        values.isActive = !values.isActive;
      },
    });
    y += 2;

    const submitWidth = button(painter, ctx, {
      id: "add.submit",
      column: x0,
      row: y,
      label: (editing ? t.edit : t.add).submit,
      icon: editing ? "✓" : "+",
      variant: "primary",
      bg,
      onPress: () => this.#submit(),
    });
    const cancelFits = submitWidth + 2 + buttonWidth(t.add.cancel) <= inner;
    button(painter, ctx, {
      id: "add.cancel",
      column: cancelFits ? x0 + submitWidth + 2 : x0,
      row: cancelFits ? y : y + 2,
      label: t.add.cancel,
      variant: "ghost",
      bg,
      onPress: () => this.#go("home"),
    });
    y += cancelFits ? 2 : 4;

    // Under the fields: they're drawn first, so they'd lose a tie
    frame(painter, "panel", { column, row: 1, width: panelWidth, height: y }, {
      border: this.#panelBorder(),
      fill: bg,
      outside: p.bg,
      z: -2,
    });

    return this.#drawFooter(painter, y + 2);
  }

  #step(name: "price" | "expiration", direction: 1 | -1): void {
    this.#focus = `add.${name}`;
    this.#updateField(name, (f) =>
      field(
        name === "price"
          ? stepPrice(f.value, direction)
          : stepDate(f.value, direction),
      ));
  }

  // Puts the cursor where the field was clicked
  #clickField(name: FieldName, offset: number): void {
    this.#updateField(name, (f) => {
      let width = 0;
      for (const { index, segment } of new Intl.Segmenter().segment(f.value)) {
        if (width >= offset) return { ...f, cursor: index };
        width += textWidth(segment);
      }
      return { ...f, cursor: f.value.length };
    });
  }

  // Dialogs -------------------------------------------------------------------

  #drawModal(painter: Painter): void {
    const modal = this.#modal!;
    if (modal.kind === "qr") return this.#drawQr(painter, modal.matrix);
    const p = this.#p;
    const t = this.#t;
    const ctx = this.#ctx;
    const { columns, rows } = this.#size;
    const width = Math.min(64, columns - 4);
    const inner = width - 6;
    const column = Math.floor((columns - width) / 2);
    const bg = p.surface;

    const isDelete = modal.kind === "delete" || modal.kind === "deleteItem";
    const name = modal.kind === "deleteItem"
      ? this.#store.data[modal.index]?.name ?? ""
      : "";
    const title = modal.kind === "export"
      ? t.backup.export
      : modal.kind === "import"
      ? t.backup.import
      : modal.kind === "deleteItem"
      ? getTranslation(t.main.deleteItem, name)
      : t.main.delete;
    const message = wrap(
      modal.kind === "export"
        ? modal.via === "file" ? t.tui.exportMessage : t.transfer.qrExport
        : modal.kind === "import"
        ? modal.via === "file" ? t.tui.importMessage : t.tui.linkMessage
        : modal.kind === "deleteItem"
        ? getTranslation(t.main.confirmDeleteItem, name)
        : t.main.confirmDelete,
      inner,
    );
    const transfer = modal.kind === "export" || modal.kind === "import"
      ? modal
      : null;
    const error = transfer?.error;
    // The QR code needs no field; its errors get their own lines
    const field = transfer && transfer.via !== "qr";
    const errorLines = error && !field ? wrap(error, inner) : [];
    const height = 2 + 2 + (transfer ? 5 : 0) + message.length + 1 +
      (field ? (error ? 5 : 4) + 1 : 0) +
      (errorLines.length ? errorLines.length + 1 : 0) + 1 + 1;
    const row = Math.max(1, Math.floor((rows - height) / 2));

    // Shadow
    painter.box("shadow", { column: column + 1, row: row + 1, width, height }, {
      bg: p.border,
    });
    frame(painter, "frame", { column, row, width, height }, {
      border: isDelete ? p.danger : p.fieldBorder,
      fill: bg,
      outside: p.bg,
      z: 1,
    });
    // Clicks inside do nothing, outside close it (like <dialog> with a
    // backdrop): the body is registered first so it wins
    painter.hit({ id: "modal.body", rect: { column, row, width, height } });
    painter.hit({
      id: "modal.backdrop",
      rect: { column: 0, row: 0, width: columns, height: rows },
      onClick: () => this.#closeModal(),
    });

    const x = column + 3;
    let y = row + 2;
    painter.text("title", x, y, truncate(title, inner), {
      fg: isDelete ? p.danger : p.text,
      bg,
      bold: true,
    }, 3);
    y += 2;
    const controls = painter.sub({
      layer: "modal",
      z: Z.modal + 2,
      clip: painter.clip,
    });

    // A file, or the QR code / a link, like the web dialog's two choices
    if (transfer) {
      const choose = (via: "file" | "qr" | "link") => {
        if (transfer.kind === "export") transfer.via = via as "file" | "qr";
        else transfer.via = via as "file" | "link";
        transfer.error = undefined;
      };
      y += segmented(controls, ctx, {
        id: "modal.via",
        column: x,
        row: y,
        width: inner,
        label: transfer.kind === "export"
          ? t.transfer.exportIntro
          : t.transfer.importIntro,
        value: transfer.via as "file" | "qr" | "link",
        choices: [
          { value: "file", label: t.transfer.file },
          transfer.kind === "export"
            ? { value: "qr", label: t.transfer.qr }
            : { value: "link", label: t.tui.linkTitle },
        ],
        bg,
        onChange: choose,
      }) + 1;
    }

    message.forEach((line, index) => {
      painter.text(
        `message.${index}`,
        x,
        y + index,
        line,
        { fg: p.muted, bg },
        3,
      );
    });
    y += message.length + 1;

    if (transfer && field) {
      const key = transfer.kind === "import" && transfer.via === "link"
        ? "link"
        : "path";
      const current = () =>
        key === "link" && transfer.kind === "import"
          ? transfer.link
          : transfer.path;
      y += input(controls, ctx, {
        id: "modal.path",
        column: x,
        row: y,
        width: inner,
        label: key === "link" ? t.tui.linkTitle : t.tui.fileTitle,
        field: current(),
        placeholder: key === "link" ? "https://…#d=…" : undefined,
        error,
        bg,
        onKey: (pressed) => {
          const set = (update: (f: Field) => Field) => {
            const next = update(current());
            if (key === "link" && transfer.kind === "import") {
              transfer.link = next;
            } else transfer.path = next;
            transfer.error = undefined;
            return true;
          };
          switch (pressed.key) {
            case "backspace":
              return set(backspace);
            case "delete":
              return set(deleteForward);
            case "left":
            case "right":
            case "home":
            case "end":
              return set((f) => moveCursor(f, pressed.key as "left"));
            case "return":
              this.#confirmModal();
              return true;
          }
          if (pressed.typed && !pressed.ctrl && !pressed.meta) {
            return set((f) => insert(f, pressed.typed));
          }
          return false;
        },
      }) + 1;
    }
    errorLines.forEach((line, index) => {
      painter.text(`error.${index}`, x, y + index, line, {
        fg: p.danger,
        bg,
        bold: true,
      }, 3);
    });
    if (errorLines.length) y += errorLines.length + 1;

    // Buttons at the bottom right: cancel, then the action
    const confirmLabel = modal.kind === "export"
      ? modal.via === "qr" ? t.tui.show : t.tui.save
      : modal.kind === "import"
      ? t.tui.open
      : modal.kind === "deleteItem"
      ? t.tui.delete
      : t.main.delete;
    const confirmWidth = buttonWidth(confirmLabel, isDelete ? "✕" : undefined);
    const cancelWidth = buttonWidth(t.add.cancel);
    const confirmColumn = x + inner - confirmWidth;
    // Cancel first, so Tab goes field → cancel → confirm
    button(controls, ctx, {
      id: "modal.cancel",
      column: confirmColumn - cancelWidth - 1,
      row: y,
      label: t.add.cancel,
      variant: "ghost",
      bg,
      onPress: () => this.#closeModal(),
    });
    button(controls, ctx, {
      id: "modal.confirm",
      column: confirmColumn,
      row: y,
      label: confirmLabel,
      icon: isDelete ? "✕" : undefined,
      variant: isDelete ? "danger" : "primary",
      bg,
      onPress: () => this.#confirmModal(),
    });
  }

  // The share link's QR code over the whole screen, two modules per cell
  // (▀ with the top one as foreground, the bottom one as background). Dark
  // on white whatever the theme, for the scanners, with a 2 module quiet
  // zone. The title, hint and close button only show if there's room.
  #drawQr(painter: Painter, matrix: boolean[][]): void {
    const p = this.#p;
    const t = this.#t;
    const ctx = this.#ctx;
    const { columns, rows } = this.#size;
    const quiet = 2;
    const size = matrix.length + quiet * 2;
    const qrRows = Math.ceil(size / 2);
    const screen = { column: 0, row: 0, width: columns, height: rows };
    painter.box("qr.bg", screen, { bg: p.bg });
    painter.hit({
      id: "modal.backdrop",
      rect: screen,
      onClick: () => this.#closeModal(),
    });

    const close = (row: number) => {
      const label = t.transfer.close;
      button(
        painter.sub({ layer: "modal", z: Z.modal + 2, clip: screen }),
        ctx,
        {
          id: "modal.cancel",
          column: Math.floor((columns - buttonWidth(label)) / 2),
          row,
          label,
          bg: p.bg,
          onPress: () => this.#closeModal(),
        },
      );
    };

    if (size > columns || qrRows > rows) {
      const lines = wrap(
        getTranslation(t.tui.qrTooSmall, `${size}×${qrRows}`),
        columns - 4,
      );
      const top = Math.max(0, Math.floor((rows - lines.length - 2) / 2));
      lines.forEach((line, index) =>
        painter.text(
          `qr.small.${index}`,
          2,
          top + index,
          center(line, columns - 4),
          {
            fg: p.text,
            bg: p.bg,
          },
          1,
        )
      );
      close(top + lines.length + 1);
      return;
    }

    const hint = wrap(t.transfer.qrHint, Math.min(columns - 4, 72));
    // Title and a blank line above, hint, close button and blank lines below
    const full = qrRows + 2 + 1 + hint.length + 1 + 1 <= rows;
    const titled = full || qrRows + 3 <= rows;
    const block = full
      ? qrRows + 2 + 1 + hint.length + 2
      : titled
      ? qrRows + 3
      : qrRows;
    let y = Math.floor((rows - block) / 2);
    if (titled) {
      painter.text(
        "qr.title",
        0,
        y,
        center(truncate(t.backup.export, columns), columns),
        {
          fg: p.text,
          bg: p.bg,
          bold: true,
        },
        1,
      );
      y += 2;
    }

    const dark = "#000000";
    const light = "#ffffff";
    const module = (x: number, y: number) =>
      matrix[y - quiet]?.[x - quiet] ?? false;
    const left = Math.floor((columns - size) / 2);
    for (let line = 0; line < qrRows; line++) {
      const spans: { text: string; style: StyleOptions }[] = [];
      for (let x = 0; x < size; x++) {
        const top = module(x, line * 2);
        const bottom = line * 2 + 1 < size && module(x, line * 2 + 1);
        const style = {
          fg: top ? dark : light,
          // Past the last module row, the cell's lower half is the page
          bg: line * 2 + 1 < size ? (bottom ? dark : light) : p.bg,
        };
        const last = spans.at(-1);
        if (last && last.style.fg === style.fg && last.style.bg === style.bg) {
          last.text += "▀";
        } else spans.push({ text: "▀", style });
      }
      painter.line(`qr.${line}`, left, y + line, spans, 1);
    }
    y += qrRows;

    if (full) {
      y += 1;
      hint.forEach((line, index) =>
        painter.text(`qr.hint.${index}`, 0, y + index, center(line, columns), {
          fg: p.muted,
          bg: p.bg,
        }, 1)
      );
      y += hint.length;
      close(y);
    } else if (titled) close(y);
  }

  #confirmModal(): void {
    const modal = this.#modal;
    switch (modal?.kind) {
      case "export":
        if (modal.via === "qr") {
          this.#showQr();
          return;
        }
        return this.#exportData();
      case "import":
        if (modal.via === "link") this.#importLink();
        else this.#importData();
        return;
      case "qr":
        return this.#closeModal();
      case "delete":
        return this.#deleteAll();
      case "deleteItem":
        return this.#deleteItem(modal.index);
    }
  }
}
