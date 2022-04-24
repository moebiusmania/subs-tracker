import { Subscription } from "./types";

const KEY: string = "subs-tracker";

const hasData = (): boolean => {
  const check: string | null = localStorage.getItem(KEY);
  return typeof check === "string" && check?.length > 0;
};

const load = (): Subscription[] => {
  const str: string = localStorage.getItem(KEY) as string;
  return JSON.parse(str) as Subscription[];
};

const save = (data: Subscription[]): void => {
  const str: string = JSON.stringify(data);
  localStorage.setItem(KEY, str);
};

export { hasData, load, save };
