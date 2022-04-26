import{C as l}from"./Container.a416983a.js";import{d as i,f as u,o as a,b as _,k as o,g as s,j as p,c as n,p as m,F as g,l as r,q as b,t}from"./index.6dfbd1e2.js";const f={class:"md:flex md:gap-7 md:justify-between mb-4"},h=s("h2",{class:"font-sans text-2xl font-bold"},"Your subscriptions:",-1),x=r(" Add a new subscription "),k={class:"md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-7"},w={class:"card rounded-none bg-base-100 shadow-xl my-7 md:my-0"},y={class:"card-body"},C={class:"card-title"},j=i({props:{data:null},setup(c){return(B,v)=>{const d=u("router-link");return a(),_(l,null,{default:o(()=>[s("header",f,[h,p(d,{to:"/add",class:"btn btn-accent w-full md:w-max"},{default:o(()=>[x]),_:1})]),s("section",k,[(a(!0),n(g,null,m(c.data,e=>(a(),n("article",w,[s("div",y,[s("h2",C,[s("span",{class:b(`badge ${e.isActive?"badge-success":"badge-error"}`)},null,2),r(" "+t(e.name),1)]),s("p",null,t(e.price+e.currency)+", "+t(e.recurrence)+" - Expires on "+t(e.expiration.toLocaleDateString()),1)])]))),256))])]),_:1})}}});export{j as default};
