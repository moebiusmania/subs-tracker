import { Subscription } from "./types";

export const subs: Subscription[] = [
  {
    name: "Movies streaming",
    price: 9.99,
    currency: "€",
    isActive: true,
    recurrence: "monthly",
    expiration: new Date("2022-05-23T19:31:26.925Z"),
  },
  {
    name: "Music streaming",
    price: 49.99,
    currency: "€",
    isActive: true,
    recurrence: "yearly",
    expiration: new Date("2022-06-23T19:31:26.925Z"),
  },
  {
    name: "App hosting",
    price: 5,
    currency: "$",
    isActive: false,
    recurrence: "monthly",
    expiration: new Date("2022-06-12T19:31:26.925Z"),
  },
  {
    name: "Gaming bundles",
    price: 5,
    currency: "€",
    isActive: true,
    recurrence: "monthly",
    expiration: new Date("2022-07-12T19:31:26.925Z"),
  },
];
