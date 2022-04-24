export type Subscription = {
  name: string;
  price: number;
  currency: string;
  isActive: boolean;
  expiration: Date;
  recurrence: "monthly" | "yearly";
};

export type AppState = {
  theme: "dark" | "light";
  currency: string;
  data: Subscription[];
};
