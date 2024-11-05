import { AppState } from "./types";

const KEY: string = "subs-tracker";

const hasData = (): boolean => {
  const check: string | null = localStorage.getItem(KEY);
  return typeof check === "string" && check?.length > 0;
};

const load = (): AppState => {
  const str: string = localStorage.getItem(KEY) as string;
  return JSON.parse(str) as AppState;
};

const save = (data: AppState): void => {
  const str: string = JSON.stringify(data);
  localStorage.setItem(KEY, str);
};

export { hasData, load, save };
