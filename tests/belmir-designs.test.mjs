import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../public/belmir-site/designs.js',import.meta.url),'utf8');
function setup(query='',saved='belmir'){
 const elements=new Map(),stored=new Map([['belmir-design',saved]]);
 const node=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',addEventListener(){},querySelector(){return{focus(){}}},contains(){return false}});return elements.get(s)};
 const location={href:'https://menuzqr.shop/belmir/menu?category=Fresh%20Juices&view=grid'+query};location.search=new URL(location.href).search;
 const window={Belmir:{}};
 const context={window,URL,URLSearchParams,location,document:{body:{dataset:{}},querySelector:node,addEventListener(){}},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},history:{replaceState(_s,_t,path){location.href=new URL(path,location.href).href;location.search=new URL(location.href).search}},navigator:{clipboard:{async writeText(){}}}};
 vm.createContext(context);vm.runInContext(script,context);return {context,elements,stored};
}
test('offers original Belmir plus the five existing design choices',()=>{const {context,elements}=setup();assert.equal(context.window.Belmir.designs.styles.length,6);assert.equal((elements.get('.design-options').innerHTML.match(/data-design-option=/g)||[]).length,6);assert.equal(context.document.body.dataset.design,'belmir');});
test('shared design overrides local preference and all six choices preserve category and grid',()=>{const {context,stored}=setup('&design=noir','modern');assert.equal(context.document.body.dataset.design,'noir');for(const s of context.window.Belmir.designs.styles){context.window.Belmir.designs.apply(s.id);const url=new URL(context.location.href);assert.equal(url.searchParams.get('design'),s.id);assert.equal(url.searchParams.get('category'),'Fresh Juices');assert.equal(url.searchParams.get('view'),'grid');assert.equal(stored.get('belmir-design'),s.id);}});
test('invalid design input falls back safely and does not enter the rendered markup',()=>{const {context,elements}=setup('&design=%3Cscript%3E');assert.equal(context.document.body.dataset.design,'belmir');assert.ok(!elements.get('.design-options').innerHTML.includes('<script>'));});
