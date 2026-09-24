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
    description: string;
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
    delete: string;
    confirmDelete: string;
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
  install: {
    title: string;
    message: string;
    manualTap: string;
    share: string;
    manualAdd: string;
    cta: string;
    dismiss: string;
  };
  footer: {
    license: string;
    project: string;
    madeWith: string;
    love: string;
    by: string;
  };
};

export type AppState = {
  // Picked with the language switcher, null to follow the system language
  language: Locale | null;
  theme: "dark" | "light";
  currency: string;
  data: Subscription[];
};
