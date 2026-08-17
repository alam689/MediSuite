import{c as l,r as y,f as u,j as a,X as h}from"./index-Doh3tCqf.js";/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=l("Bell",[["path",{d:"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",key:"1qo2s2"}],["path",{d:"M10.3 21a1.94 1.94 0 0 0 3.4 0",key:"qgo35s"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=l("LogOut",[["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}],["polyline",{points:"16 17 21 12 16 7",key:"1gabdz"}],["line",{x1:"21",x2:"9",y1:"12",y2:"12",key:"1uyos4"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=l("Plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);function j({open:d,title:r,subtitle:t,onClose:e,children:n,footer:o,side:i=!1,width:c}){return y.useEffect(()=>{if(!d)return;const s=m=>m.key==="Escape"&&(e==null?void 0:e());return window.addEventListener("keydown",s),document.body.style.overflow="hidden",()=>{window.removeEventListener("keydown",s),document.body.style.overflow=""}},[d,e]),d?u.createPortal(a.jsx("div",{className:`modal-scrim ${i?"is-side":""}`,onClick:e,children:a.jsxs("div",{className:`modal ${i?"modal-side":""}`,style:c?{maxWidth:c}:void 0,onClick:s=>s.stopPropagation(),role:"dialog","aria-modal":"true",children:[a.jsxs("div",{className:"modal-head",children:[a.jsxs("div",{children:[a.jsx("h3",{className:"modal-title",children:r}),t&&a.jsx("p",{className:"modal-sub",children:t})]}),a.jsx("button",{className:"icon-btn",onClick:e,"aria-label":"Close",children:a.jsx(h,{size:18})})]}),a.jsx("div",{className:"modal-body",children:n}),o&&a.jsx("div",{className:"modal-foot",children:o})]})}),document.body):null}export{p as B,k as L,j as M,v as P};
