import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}

for(const file of ['index.html','admin.html']){
  const html=read(file);
  for(const m of html.matchAll(/<script\s+src="([^"]+)"/g)){
    assert(fs.existsSync(path.join(root,m[1])),`${file}: missing script ${m[1]}`);
  }
  for(const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)){
    assert(fs.existsSync(path.join(root,m[1])),`${file}: missing css ${m[1]}`);
  }
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const ref=m[1];
    if(!/^(?:[a-z]+:|#|\/\/)/i.test(ref)) assert(fs.existsSync(path.join(root,ref)),`${file}: missing local resource ${ref}`);
  }
}

function checkIds(htmlFile,jsFile){
  const html=read(htmlFile), js=read(jsFile);
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  const refs=[...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(x=>x[1]);
  for(const id of refs) assert(ids.has(id),`${jsFile}: #${id} missing in ${htmlFile}`);
}
checkIds('index.html','assets/app.js');
checkIds('admin.html','assets/admin.js');

const localStore=new Map();
const localStorage={getItem:k=>localStore.has(k)?localStore.get(k):null,setItem:(k,v)=>localStore.set(k,String(v)),removeItem:k=>localStore.delete(k)};
const context={window:{AB_CONFIG:{studyKey:'test',apiBase:'',freeShippingThreshold:53,shippingFee:6,allowPreviewOverride:false}},localStorage,crypto:webcrypto,location:{search:''},URLSearchParams,fetch:globalThis.fetch,console,Date,Math,Number,String,JSON,Array,Object,Promise,setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(read('assets/shared.js'),context);
const P=context.window.P2;
assert(P.cfg.freeShippingThreshold===53,'threshold must be 53');
assert(P.cfg.shippingFee===6,'shipping must be 6');
const session=P.createSession(true);
assert(Object.prototype.hasOwnProperty.call(session,'initialQuantity'),'session must record initial quantity');
assert(Object.prototype.hasOwnProperty.call(session,'finalQuantity'),'session must record final quantity');
assert(Object.prototype.hasOwnProperty.call(session,'continuedAdd'),'session must record continued add');
assert(Object.prototype.hasOwnProperty.call(session,'checkoutClicked'),'session must record checkout click');
assert(session.continuedAdd===false && session.checkoutClicked===false,'new session behavior flags must start false');
localStorage.setItem('p206_session_v1',JSON.stringify({studyKey:'test',participantId:'old12345',variant:'A',preview:false,startedAt:'2026-01-01T00:00:00.000Z',cartOpenedAt:'2026-01-01T00:00:01.000Z',baselineValue:39.9,finalValue:49.8,addonValue:9.9,status:'cart_opened',cart:{fan:1,cable:1}}));
const restored=P.createSession(false);
assert(restored.initialQuantity===1 && restored.finalQuantity===2,'existing sessions must gain quantity fields safely');
assert(restored.continuedAdd===true && restored.checkoutClicked===false,'existing sessions must gain behavior flags safely');
const previewStorage=new Map([['p206_session_v1',JSON.stringify({studyKey:'preview-test',participantId:'formal1234',variant:'B',preview:false,status:'started',cart:{}})]]);
const previewContext={window:{AB_CONFIG:{studyKey:'preview-test',apiBase:'',freeShippingThreshold:53,shippingFee:6,allowPreviewOverride:true}},localStorage:{getItem:k=>previewStorage.has(k)?previewStorage.get(k):null,setItem:(k,v)=>previewStorage.set(k,String(v)),removeItem:k=>previewStorage.delete(k)},crypto:webcrypto,location:{search:'?preview=A'},URLSearchParams,fetch:globalThis.fetch,console,Date,Math,Number,String,JSON,Array,Object,Promise,setTimeout,clearTimeout};
vm.createContext(previewContext);
vm.runInContext(read('assets/shared.js'),previewContext);
const previewSession=previewContext.window.P2.createSession(false);
assert(previewSession.preview===true && previewSession.variant==='A','preview query must override only the preview session');
assert(JSON.parse(previewStorage.get('p206_session_v1')).variant==='B','preview query must not overwrite formal session');
await previewContext.window.P2.pushRecord(previewSession);
assert(!previewStorage.has('p206_records_v1'),'preview record must not enter local formal records');
const sample=[
 {participantId:'a1',variant:'A',status:'completed',baselineValue:39.9,finalValue:39.9,addonValue:0,continuedAdd:false,checkoutClicked:true,freeShipping:false},
 {participantId:'a2',variant:'A',status:'completed',baselineValue:39.9,finalValue:39.9,addonValue:0,continuedAdd:true,checkoutClicked:true,freeShipping:false},
 {participantId:'b1',variant:'B',status:'completed',baselineValue:39.9,finalValue:56.7,addonValue:16.8,continuedAdd:true,checkoutClicked:true,freeShipping:true},
 {participantId:'b2',variant:'B',status:'completed',baselineValue:39.9,finalValue:53.7,addonValue:13.8,continuedAdd:true,checkoutClicked:true,freeShipping:true}
];
const s=P.summarize(sample);
assert(s.A.done===2 && s.B.done===2,'group counts wrong');
assert(s.B.mean>s.A.mean,'synthetic B mean should exceed A');
assert(s.B.freeRate===1,'B free-shipping rate should be 100%');
assert(s.A.addonRate===0.5,'continued add rate must use behavior flag even when final addon value returns to zero');
assert(P.round2(39.9+13.1)===53,'source threshold arithmetic mismatch');

let remoteCalls=0;
const remoteResolvers=[];
const remoteStorage=new Map();
const remoteFetch=()=>{
  remoteCalls++;
  return new Promise(resolve=>remoteResolvers.push(resolve));
};
const remoteContext={window:{AB_CONFIG:{studyKey:'test-remote',apiBase:'https://example.test',freeShippingThreshold:53,shippingFee:6,allowPreviewOverride:false}},localStorage:{getItem:k=>remoteStorage.has(k)?remoteStorage.get(k):null,setItem:(k,v)=>remoteStorage.set(k,String(v)),removeItem:k=>remoteStorage.delete(k)},crypto:webcrypto,location:{search:''},URLSearchParams,fetch:remoteFetch,console,Date,Math,Number,String,JSON,Array,Object,Promise,setTimeout,clearTimeout};
vm.createContext(remoteContext);
vm.runInContext(read('assets/shared.js'),remoteContext);
const remoteRecord={studyKey:'test-remote',participantId:'12345678',variant:'A',status:'cart_opened',cart:{fan:1}};
const firstPush=remoteContext.window.P2.pushRecord(remoteRecord);
const secondPush=remoteContext.window.P2.pushRecord(Object.assign({},remoteRecord,{status:'completed',checkoutClicked:true}));
await new Promise(resolve=>setTimeout(resolve,0));
assert(remoteCalls===1,'remote participant writes must be serialized');
remoteResolvers.shift()({ok:true,json:async()=>({ok:true})});
await firstPush;
await Promise.resolve();
assert(remoteCalls===2,'queued remote participant write must start after the first completes');
remoteResolvers.shift()({ok:true,json:async()=>({ok:true})});
await secondPush;
const offlineStorage=new Map();
const offlineContext={window:{AB_CONFIG:{studyKey:'offline-test',apiBase:'https://offline.test',freeShippingThreshold:53,shippingFee:6,allowPreviewOverride:false}},localStorage:{getItem:k=>offlineStorage.has(k)?offlineStorage.get(k):null,setItem:(k,v)=>offlineStorage.set(k,String(v)),removeItem:k=>offlineStorage.delete(k)},crypto:webcrypto,location:{search:''},URLSearchParams,fetch:()=>Promise.reject(new Error('offline')),console,Date,Math,Number,String,JSON,Array,Object,Promise,setTimeout,clearTimeout};
vm.createContext(offlineContext);
vm.runInContext(read('assets/shared.js'),offlineContext);
try { await offlineContext.window.P2.pushRecord({studyKey:'offline-test',participantId:'offline123',variant:'B',status:'cart_opened',cart:{fan:1}}); } catch {}
assert(JSON.parse(offlineStorage.get('p206_records_v1'))[0].participantId==='offline123','offline API failure must preserve local participant record');

const schema=read('worker/schema.sql');
const worker=read('worker/src/index.js');
const adminSource=read('assets/admin.js');
assert(schema.includes('initial_quantity'),'D1 schema must include initial quantity');
assert(schema.includes('continued_add'),'D1 schema must include continued add');
assert(worker.includes('checkout_clicked'),'Worker must persist checkout click');
assert(worker.includes('CASE participant_records.status'),'Worker must reject stale status updates');
assert(worker.includes('COALESCE(excluded.initial_quantity'),'Worker must preserve fields from newer payloads when old clients retry');
assert(worker.includes('participant_records.continued_add'),'Worker must preserve monotonic behavior flags');
assert(adminSource.includes('function quantity'),'Admin must derive legacy quantity fields');
const workerModule=await import(`data:text/javascript,${encodeURIComponent(worker)}`);
const workerCalls=[];
const fakeDB={
  prepare(sql){
    const query={
      bind(...args){workerCalls.push({sql,args});return query;},
      async run(){return {success:true};},
      async all(){return {results:[{study_key:'test-remote',participant_id:'12345678',variant:'A',status:'completed',started_at:'2026-01-01T00:00:00.000Z',cart_opened_at:'2026-01-01T00:00:01.000Z',baseline_value:39.9,final_value:53,addon_value:13.1,initial_quantity:1,final_quantity:2,continued_add:1,checkout_clicked:1,free_shipping:1,completed_at:'2026-01-01T00:00:02.000Z',cart_json:'{"fan":1,"cable":1}',updated_at:'2026-01-01T00:00:02.000Z'},{study_key:'test-remote',participant_id:'legacy1234',variant:'B',status:'completed',started_at:'2026-01-01T00:00:00.000Z',cart_opened_at:'2026-01-01T00:00:01.000Z',baseline_value:39.9,final_value:49.8,addon_value:9.9,initial_quantity:null,final_quantity:null,continued_add:0,checkout_clicked:0,free_shipping:0,completed_at:'2026-01-01T00:00:02.000Z',cart_json:'{"fan":1,"cable":1}',updated_at:'2026-01-01T00:00:02.000Z'}]};},
      async first(){return {n:1};}
    };
    return query;
  }
};
const workerEnv={DB:fakeDB,ADMIN_TOKEN:'secret',ALLOWED_ORIGIN:'http://localhost:8000'};
const postResponse=await workerModule.default.fetch(new Request('https://worker.test/api/participant',{method:'POST',headers:{Origin:'http://localhost:8000','Content-Type':'application/json'},body:JSON.stringify({studyKey:'test-remote',record:{participantId:'12345678',variant:'A',status:'completed',initialQuantity:1,finalQuantity:2,continuedAdd:true,checkoutClicked:true,cart:{fan:1,cable:1}}})}),workerEnv);
assert(postResponse.status===200,'Worker must accept a valid participant record');
const postCall=workerCalls[0];
assert(postCall.args.includes(1) && postCall.args.includes(2),'Worker must bind quantity fields');
const getResponse=await workerModule.default.fetch(new Request('https://worker.test/api/results?studyKey=test-remote',{headers:{Origin:'http://localhost:8000',Authorization:'Bearer secret'}}),workerEnv);
const getData=await getResponse.json();
assert(getResponse.status===200 && getData.items[0].initialQuantity===1 && getData.items[0].finalQuantity===2,'Worker must return quantity fields');
assert(getData.items[0].continuedAdd===true && getData.items[0].checkoutClicked===true,'Worker must return behavior flags');
const legacyItem=getData.items.find(x=>x.participantId==='legacy1234');
assert(legacyItem.continuedAdd===true && legacyItem.checkoutClicked===true,'Worker must preserve legacy behavior meaning after migration');
assert(legacyItem.initialQuantity===1 && legacyItem.finalQuantity===2,'Worker must derive legacy quantities from cart JSON');

console.log('smoke tests: PASS');
