import { Subscription } from "./types";

export const subs: Subscription[] = [
  {
    name: "Netflix",
    price: 14.99,
    currency: "€",
    isActive: true,
    recurrence: "monthly",
    expiration: new Date("2022-05-23T19:31:26.925Z"),
  },
  {
    name: "Disney+",
    price: 89.99,
    currency: "€",
    isActive: true,
    recurrence: "yearly",
    expiration: new Date("2022-06-23T19:31:26.925Z"),
  },
  {
    name: "Digital Ocean",
    price: 5,
    currency: "$",
    isActive: false,
    recurrence: "monthly",
    expiration: new Date("2022-06-12T19:31:26.925Z"),
  },
  {
    name: "Xbox Game Pass",
    price: 13,
    currency: "€",
    isActive: true,
    recurrence: "monthly",
    expiration: new Date("2022-07-12T19:31:26.925Z"),
  },
];
