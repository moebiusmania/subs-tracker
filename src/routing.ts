import {
  createWebHashHistory,
  createRouter,
  RouteRecordRaw,
  RouteComponent,
  Router,
} from "vue-router";

const Home = (): Promise<RouteComponent> => import("./views/Home.vue");
const Add = (): Promise<RouteComponent> => import("./views/Add.vue");

const routes: RouteRecordRaw[] = [
  { path: "/", component: Home },
  { path: "/add", component: Add },
];

const router: Router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
