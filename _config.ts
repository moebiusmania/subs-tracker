import lume from "lume/mod.ts";
import esbuild from "lume/plugins/esbuild.ts";

const site = lume({ src: "./src" });

site.use(esbuild());

site.add("js/main.ts");
site.add("favicon.svg");
site.add("favicon.ico");
site.add("robots.txt");

export default site;
