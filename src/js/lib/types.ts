export type Subscription = {
  name: string;
  price: number;
  currency: string;
  isActive: boolean;
  expiration: Date;
  recurrence: "monthly" | "yearly";
};

export type Locale = "en" | "it";

export type I18n = {
  meta: {
    language: string;
    title: string;
    shareTitle: string;
    description: string;
    imageAlt: string;
  };
  header: {
    skip: string;
    brand: string;
    language: string;
    darkMode: string;
  };
  main: {
    title: string;
    total: string;
    inactives: string;
    monthly: string;
    yearly: string;
    detail: string;
    list: string;
    cta: string;
    active: string;
    inactive: string;
    toggle: string;
    expires: string;
    thisMonth: string;
    delete: string;
    confirmDelete: string;
    deleteItem: string;
    confirmDeleteItem: string;
    editItem: string;
    limit: string;
  };
  recurrence: {
    monthly: string;
    yearly: string;
  };
  empty: {
    title: string;
    message: string;
    cta: string;
    or: string;
    default: string;
  };
  backup: {
    export: string;
    import: string;
  };
  // The export and import dialog (partials/transfer.vto)
  transfer: {
    close: string;
    exportIntro: string;
    importIntro: string;
    file: string;
    fileExport: string;
    fileImport: string;
    qr: string;
    qrExport: string;
    qrImport: string;
    replaces: string;
    qrHint: string;
    qrAlt: string;
    copy: string;
    copied: string;
    back: string;
    scanHow: string;
    link: string;
    importLink: string;
    confirmTitle: string;
    confirmNew: string;
    confirmReplace: string;
    accept: string;
    cancel: string;
    loading: string;
    invalidFile: string;
    invalidLink: string;
    tooMany: string;
    qrFailed: string;
  };
  add: {
    back: string;
    title: string;
    intro: string;
    name: string;
    namePlaceholder: string;
    price: string;
    currency: string;
    euro: string;
    dollar: string;
    expiration: string;
    recurrence: string;
    active: string;
    submit: string;
    cancel: string;
  };
  edit: {
    title: string;
    submit: string;
  };
  install: {
    title: string;
    message: string;
    manualTap: string;
    share: string;
    manualAdd: string;
    cta: string;
    dismiss: string;
  };
  // The "how it works" animation (js/tour.ts), opened from the empty state
  tour: {
    link: string;
    title: string;
    close: string;
    play: string;
    pause: string;
    replay: string;
    scene: string;
    loading: string;
    failed: string;
    cta: string;
    music: string;
    video: string;
    cloud: string;
    addButton: string;
    // One caption per scene, in order
    scenes: {
      nibble: string;
      add: string;
      totals: string;
      due: string;
      inactive: string;
      local: string;
      end: string;
    };
  };
  update: {
    title: string;
    message: string;
    reload: string;
    dismiss: string;
  };
  footer: {
    license: string;
    project: string;
    madeBy: string;
  };
  // Only used by the terminal version (tui/)
  tui: {
    hints: {
      move: string;
      select: string;
      back: string;
      add: string;
      theme: string;
      language: string;
      quit: string;
      adjust: string;
      scroll: string;
      delete: string;
    };
    fileTitle: string;
    exportMessage: string;
    importMessage: string;
    save: string;
    open: string;
    delete: string;
    exported: string;
    imported: string;
    readError: string;
    writeError: string;
    required: string;
    invalidPrice: string;
    invalidDate: string;
    storage: string;
    linkTitle: string;
    linkMessage: string;
    show: string;
    qrTooSmall: string;
    linkImported: string;
  };
};

export type AppState = {
  // Picked with the language switcher, null to follow the system language
  language: Locale | null;
  theme: "dark" | "light";
  currency: string;
  data: Subscription[];
};
