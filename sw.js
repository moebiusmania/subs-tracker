if(!self.define){let e,s={};const i=(i,n)=>(i=new URL(i+".js",n).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(n,r)=>{const l=e||("document"in self?document.currentScript.src:"")||location.href;if(s[l])return;let t={};const o=e=>i(e,l),u={module:{uri:l},exports:t,require:o};s[l]=Promise.all(n.map((e=>u[e]||o(e)))).then((e=>(r(...e),t)))}}define(["./workbox-b3e22772"],(function(e){"use strict";self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"assets/Add.13299a3a.js",revision:null},{url:"assets/Container.e1e2e9dc.js",revision:null},{url:"assets/Dashboard.3011fa78.js",revision:null},{url:"assets/Empty.5be043dc.js",revision:null},{url:"assets/Home.89c7d398.js",revision:null},{url:"assets/index.089a68e6.js",revision:null},{url:"assets/index.3929f36d.js",revision:null},{url:"assets/index.46713b33.css",revision:null},{url:"assets/List.952433d4.js",revision:null},{url:"index.html",revision:"60eed7f64267992bdfca503431642127"},{url:"registerSW.js",revision:"6ea002825aec20da0b40397882586ebd"},{url:"favicon.svg",revision:"f9e68fa6c7b9235d4fe5e4b0dc54dd80"},{url:"manifest.webmanifest",revision:"53f629f5655eb4b52b1a508e72bce68c"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));