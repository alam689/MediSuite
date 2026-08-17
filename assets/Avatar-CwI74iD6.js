import{c as u,j as l}from"./index-uxmbKybV.js";/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=u("ChevronDown",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=u("Eye",[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);function f(t){return new Promise((r,e)=>{const a=new FileReader;a.onload=()=>r(a.result),a.onerror=e,a.readAsDataURL(t)})}async function w(t,r=320,e=.82){const a=await f(t);return new Promise(i=>{const n=new Image;n.onload=()=>{const s=Math.min(1,r/Math.max(n.width,n.height)),c=Math.max(1,Math.round(n.width*s)),h=Math.max(1,Math.round(n.height*s)),o=document.createElement("canvas");o.width=c,o.height=h,o.getContext("2d").drawImage(n,0,0,c,h);try{i(o.toDataURL("image/jpeg",e))}catch{i(a)}},n.onerror=()=>i(a),n.src=a})}function M(t){return t==null?"":t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(0)} KB`:`${(t/(1024*1024)).toFixed(1)} MB`}function y(t){if(!t)return"";const r=Math.max(0,Math.floor((Date.now()-t)/1e3));if(r<45)return"just now";const e=Math.floor(r/60);if(e<60)return`${e}m ago`;const a=Math.floor(e/60);return a<24?`${a}h ago`:`${Math.floor(a/24)}d ago`}function j(t){const r=t.type||"";return r.startsWith("image/")?"image":r==="application/pdf"?"pdf":"file"}function d(t=""){return(t.split(/\s+/).filter(a=>a&&!/^dr\.?$/i.test(a)).map(a=>a[0]).join("")||t[0]||"?").slice(0,2).toUpperCase()}function D({src:t,name:r,size:e=34}){const a={width:e,height:e};return t?l.jsx("img",{className:"avatar-img",style:a,src:t,alt:r||""}):l.jsx("span",{className:"avatar-fallback",style:{...a,fontSize:Math.round(e*.4)},children:d(r)})}export{D as A,g as C,x as E,f as a,j as d,M as f,w as i,y as r};
