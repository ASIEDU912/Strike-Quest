// Minimal DOM adapter for behavior tests. This is not a visual/browser test.
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),clear:()=>map.clear()};}
function element(value='',tagName='DIV') {
  const classes=new Set(),handlers={},attributes=new Map();
  return {value,tagName,textContent:'',innerHTML:'',disabled:false,style:{},dataset:{},
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,force)=>{const on=force??!classes.has(x);on?classes.add(x):classes.delete(x);return on;}},
    addEventListener:(name,handler)=>{(handlers[name]??=[]).push(handler)},dispatch:(name,event)=>Promise.all((handlers[name]||[]).map(fn=>fn(event))),
    querySelector:()=>element(),querySelectorAll:()=>[],setAttribute:(name,value)=>attributes.set(name,String(value)),getAttribute:name=>attributes.get(name)??null,scrollIntoView:()=>{},focus:()=>{}};
}
module.exports = html => {
  const elements=new Map();
  for(const match of html.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*[^>]*\bid="([^"]+)"[^>]*>/g)){
    const value=match[0].match(/\bvalue="([^"]*)"/)?.[1]||'',tagName=match[0].match(/^<([a-zA-Z][a-zA-Z0-9-]*)/)[1].toUpperCase();elements.set(match[1],element(value,tagName));
  }
  for(const match of html.matchAll(/<select[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
    const opts=[...match[2].matchAll(/<option([^>]*)>/g)];const chosen=opts.find(x=>/selected/.test(x[1]))||opts[0];elements.get(match[1]).value=chosen?.[1].match(/value="([^"]+)"/)?.[1]||'';
  }
  const document={getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}};
  for(const [id,el] of elements){el.id=id;el.focus=()=>{document.activeElement=el};}
  const context=vm.createContext({console,document,localStorage:storage(),sessionStorage:storage(),crypto:{randomUUID},
    navigator:{userAgent:'Test harness'},setTimeout:()=>0,clearTimeout:()=>{},URL,AbortController,Intl,Date,
    confirm:()=>true,fetch:()=>{throw new Error('Unexpected network request')},matchMedia:()=>({matches:false})});
  context.window=context;context.scrollTo=()=>{};context.window.matchMedia=()=>({matches:false});
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
  return {evaluate:async(fn,arg)=>{context.__arg=arg;return await vm.runInContext(`(${fn.toString()})(__arg)`,context);}};
};
