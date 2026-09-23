export type Subscription = {
  name: string;
  price: number;
  currency: string;
  isActive: boolean;
  expiration: Date;
  recurrence: "monthly" | "yearly";
};

export type I18n = {
  main: {
    title: string;
    total: string;
    inactives: string;
    monthly: string;
    yearly: string;
    detail: string;
    list: string;
    cta: string;
    expires: string;
    delete: string;
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
};

export type AppState = {
  locale: string;
  i18n: I18n;
  theme: "dark" | "light";
  currency: string;
  data: Subscription[];
};
