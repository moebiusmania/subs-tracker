function __vite__mapDeps(indexes) {
  if (!__vite__mapDeps.viteFileDeps) {
    __vite__mapDeps.viteFileDeps = ["assets/Empty-D3rrYtXq.js","assets/Container-DJNB_vEf.js","assets/index-CCl8ccVZ.js","assets/index-BJy_bINT.css","assets/List-CeCWiRZM.js","assets/Dashboard-DqfTr0iI.js","assets/index-DHFkM5cF.js"]
  }
  return indexes.map((i) => __vite__mapDeps.viteFileDeps[i])
}
import{d as u,u as l,c as m,a as t,b as o,e as n,F as p,o as a,f as _,_ as r}from"./index-CCl8ccVZ.js";const h=u({__name:"Home",setup(i){const s=_(()=>r(()=>import("./Empty-D3rrYtXq.js"),__vite__mapDeps([0,1,2,3]))),d=_(()=>r(()=>import("./List-CeCWiRZM.js"),__vite__mapDeps([4,2,3,1]))),c=_(()=>r(()=>import("./Dashboard-DqfTr0iI.js"),__vite__mapDeps([5,1,2,3,6]))),e=l();return(E,f)=>(a(),m(p,null,[t(e).data.length===0?(a(),o(t(s),{key:0})):n("",!0),t(e).data.length>0?(a(),o(t(c),{key:1,data:t(e).data},null,8,["data"])):n("",!0),t(e).data.length>0?(a(),o(t(d),{key:2,data:t(e).data},null,8,["data"])):n("",!0)],64))}});export{h as default};
