import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}

const platformPages=['index.html','project2.html','experiment.html','share.html','shop.html','aggregate.html','setup.html','admin.html'];
for(const file of platformPages){
  const html=read(file);
  for(const m of html.matchAll(/<script\s+src="([^"]+)"/g)){
    assert(fs.existsSync(path.join(root,m[1])),`${file}: missing script ${m[1]}`);
  }
  for(const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)){
    assert(fs.existsSync(path.join(root,m[1])),`${file}: missing css ${m[1]}`);
  }
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const ref=m[1];
    const localRef=ref.split(/[?#]/)[0];
    if(localRef && !/^(?:[a-z]+:|#|\/\/)/i.test(localRef)) assert(fs.existsSync(path.join(root,localRef)),`${file}: missing local resource ${ref}`);
  }
}

const homeHtml=read('index.html');
assert(/网络营销 A\/B 实验平台/.test(homeHtml),'home must be the reference-style experiment platform overview');
assert(/project2\.html/.test(homeHtml) && /experiment\.html\?id=P2-06/.test(homeHtml),'home must link to the P2 project and workbench');
assert(/share\.html\?e=P2-06/.test(homeHtml) && /aggregate\.html/.test(homeHtml),'home must expose participant and aggregate entry points');
const projectHtml=read('project2.html');
assert(/P2-06/.test(projectHtml) && /免运费门槛提示/.test(projectHtml),'project page must describe P2-06');
const workbenchHtml=read('experiment.html');
assert((workbenchHtml.match(/section-title/g)||[]).length>=5,'workbench must have five numbered modules');
assert(/¥53/.test(workbenchHtml) && /¥39\.90/.test(workbenchHtml) && /¥6/.test(workbenchHtml),'workbench must show the fixed P2-06 parameters');
assert(!/simulateDataUpdate|randInt\(/.test(workbenchHtml),'workbench must not fabricate random experiment samples');
const shareHtml=read('share.html');
assert(/studentId|学号/.test(shareHtml) && /name|姓名/.test(shareHtml) && /className|班级/.test(shareHtml),'participant entry must follow the reference identity-registration flow');
assert(/shop\.html/.test(shareHtml),'participant entry must lead to the real shopping page');
const aggregateHtml=read('aggregate.html');
assert(/CSV|csv/i.test(aggregateHtml) && /participant|参与者|学生/i.test(aggregateHtml),'aggregate page must provide participant detail and CSV export');
const setupHtml=read('setup.html');
assert(/api/i.test(setupHtml) && /健康|测试|Worker/i.test(setupHtml),'setup page must provide API configuration and health check');

function checkIds(htmlFile,jsFile){
  const html=read(htmlFile), js=read(jsFile);
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  const refs=[...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(x=>x[1]);
  for(const id of refs) assert(ids.has(id),`${jsFile}: #${id} missing in ${htmlFile}`);
}
checkIds('shop.html','assets/app.js');
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
assert(typeof P.setProfile==='function' && typeof P.getProfile==='function','shared store must expose participant profile helpers');
P.setProfile({studentId:'2024010101',name:'测试同学',className:'市场营销2024-1班'});
const profile=P.getProfile();
assert(profile.studentId==='2024010101' && profile.name==='测试同学' && profile.className==='市场营销2024-1班','profile must persist registration fields');
const profiledSession=P.createSession(true);
assert(profiledSession.studentId==='2024010101' && profiledSession.participantName==='测试同学' && profiledSession.className==='市场营销2024-1班','new sessions must carry participant profile fields');
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
assert(schema.includes('student_id') && schema.includes('participant_name') && schema.includes('class_name'),'D1 schema must include registration profile fields');
assert(worker.includes('checkout_clicked'),'Worker must persist checkout click');
assert(worker.includes('participant_name') && worker.includes('class_name'),'Worker must persist registration profile fields');
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
      async all(){return {results:[{study_key:'test-remote',participant_id:'12345678',student_id:'2024010101',participant_name:'测试同学',class_name:'市场营销2024-1班',variant:'A',status:'completed',started_at:'2026-01-01T00:00:00.000Z',cart_opened_at:'2026-01-01T00:00:01.000Z',baseline_value:39.9,final_value:53,addon_value:13.1,initial_quantity:1,final_quantity:2,continued_add:1,checkout_clicked:1,free_shipping:1,completed_at:'2026-01-01T00:00:02.000Z',cart_json:'{"fan":1,"cable":1}',updated_at:'2026-01-01T00:00:02.000Z'},{study_key:'test-remote',participant_id:'legacy1234',variant:'B',status:'completed',started_at:'2026-01-01T00:00:00.000Z',cart_opened_at:'2026-01-01T00:00:01.000Z',baseline_value:39.9,final_value:49.8,addon_value:9.9,initial_quantity:null,final_quantity:null,continued_add:0,checkout_clicked:0,free_shipping:0,completed_at:'2026-01-01T00:00:02.000Z',cart_json:'{"fan":1,"cable":1}',updated_at:'2026-01-01T00:00:02.000Z'}]};},
      async first(){return {n:1};}
    };
    return query;
  }
};
const workerEnv={DB:fakeDB,ADMIN_TOKEN:'secret',ALLOWED_ORIGIN:'http://localhost:8000'};
const postResponse=await workerModule.default.fetch(new Request('https://worker.test/api/participant',{method:'POST',headers:{Origin:'http://localhost:8000','Content-Type':'application/json'},body:JSON.stringify({studyKey:'test-remote',record:{participantId:'12345678',studentId:'2024010101',participantName:'测试同学',className:'市场营销2024-1班',variant:'A',status:'completed',initialQuantity:1,finalQuantity:2,continuedAdd:true,checkoutClicked:true,cart:{fan:1,cable:1}}})}),workerEnv);
assert(postResponse.status===200,'Worker must accept a valid participant record');
const postCall=workerCalls[0];
assert(postCall.args.includes(1) && postCall.args.includes(2),'Worker must bind quantity fields');
assert(postCall.args.includes('2024010101') && postCall.args.includes('测试同学') && postCall.args.includes('市场营销2024-1班'),'Worker must bind registration profile fields');
const getResponse=await workerModule.default.fetch(new Request('https://worker.test/api/results?studyKey=test-remote',{headers:{Origin:'http://localhost:8000',Authorization:'Bearer secret'}}),workerEnv);
const getData=await getResponse.json();
assert(getResponse.status===200 && getData.items[0].initialQuantity===1 && getData.items[0].finalQuantity===2,'Worker must return quantity fields');
assert(getData.items[0].studentId==='2024010101' && getData.items[0].participantName==='测试同学' && getData.items[0].className==='市场营销2024-1班','Worker must return registration profile fields');
assert(getData.items[0].continuedAdd===true && getData.items[0].checkoutClicked===true,'Worker must return behavior flags');
const legacyItem=getData.items.find(x=>x.participantId==='legacy1234');
assert(legacyItem.continuedAdd===true && legacyItem.checkoutClicked===true,'Worker must preserve legacy behavior meaning after migration');
assert(legacyItem.initialQuantity===1 && legacyItem.finalQuantity===2,'Worker must derive legacy quantities from cart JSON');

console.log('smoke tests: PASS');
