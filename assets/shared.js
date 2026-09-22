(function(){
  'use strict';
  var cfg = window.AB_CONFIG || {};
  var RECORDS_KEY = 'p206_records_v1';
  var SESSION_KEY = 'p206_session_v1';
  var PROFILE_KEY = 'p206_profile_v1';
  var remoteQueue = Promise.resolve();

  function money(v){ return '¥' + Number(v || 0).toFixed(2); }
  function round2(v){ return Math.round((Number(v) + Number.EPSILON) * 100) / 100; }
  function uid(){
    var a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a).map(function(x){ return x.toString(16).padStart(2,'0'); }).join('');
  }
  function nowISO(){ return new Date().toISOString(); }
  function getLocalRecords(){
    try {
      var rows=JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch(e){ return []; }
  }
  function saveLocalRecord(rec){
    var rows = getLocalRecords();
    if(!Array.isArray(rows)) rows=[];
    var i = rows.findIndex(function(x){ return x.participantId === rec.participantId && x.studyKey === rec.studyKey; });
    if(i >= 0) rows[i] = rec; else rows.push(rec);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(rows));
    return rec;
  }
  function clearLocalRecords(){ localStorage.removeItem(RECORDS_KEY); }
  function normalizeProfile(profile){
    if(!profile || typeof profile!=='object') return null;
    var out={studentId:String(profile.studentId||'').trim(),name:String(profile.name||'').trim(),className:String(profile.className||'').trim()};
    return out.studentId && out.name && out.className ? out : null;
  }
  function getProfile(){
    try { return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')); } catch(e){ return null; }
  }
  function setProfile(profile){
    var out=normalizeProfile(profile);
    if(!out) throw new Error('profile incomplete');
    localStorage.setItem(PROFILE_KEY,JSON.stringify(out));
    return out;
  }
  function clearProfile(){ localStorage.removeItem(PROFILE_KEY); }
  function participantIdForProfile(profile){
    var text=String(profile.studentId)+'|'+String(cfg.studyKey||'p2-06');
    var h=2166136261;
    for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return 'participant-'+(h>>>0).toString(16).padStart(8,'0');
  }
  function normalizeSession(s){
    if(!s || typeof s!=='object') return null;
    if(!Object.prototype.hasOwnProperty.call(s,'initialQuantity') && s.cartOpenedAt) s.initialQuantity=1;
    if(!Object.prototype.hasOwnProperty.call(s,'finalQuantity') && (s.cartOpenedAt || s.status==='completed' || s.finalValue!=null)){
      s.finalQuantity=Object.keys(s.cart||{}).reduce(function(n,id){return n+Math.max(0,Number(s.cart[id])||0);},0);
    }
    if(!Object.prototype.hasOwnProperty.call(s,'continuedAdd')) s.continuedAdd=Number(s.addonValue)>0.001;
    if(!Object.prototype.hasOwnProperty.call(s,'checkoutClicked')) s.checkoutClicked=s.status==='completed';
    return s;
  }
  function getSession(){
    try { return normalizeSession(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')); } catch(e){ return null; }
  }
  function setSession(s){ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); return s; }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }
  function previewVariant(){
    if(!cfg.allowPreviewOverride) return '';
    var p = new URLSearchParams(location.search).get('preview');
    p = (p || '').toUpperCase();
    return p === 'A' || p === 'B' ? p : '';
  }
  function createSession(forceNew){
    var preview = previewVariant();
    var profile = getProfile();
    if(!forceNew && !preview){
      var old = getSession();
      if(old && old.studyKey === cfg.studyKey && (!profile || !old.studentId || old.studentId===profile.studentId)){ setSession(old); return old; }
    }
    var s = {
      studyKey: cfg.studyKey,
      participantId: preview ? 'preview-' + preview.toLowerCase() : (profile ? participantIdForProfile(profile) : uid()),
      variant: preview || (crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? 'A' : 'B'),
      preview: !!preview,
      startedAt: nowISO(),
      cartOpenedAt: '',
      baselineValue: null,
      finalValue: null,
      addonValue: null,
      initialQuantity: null,
      finalQuantity: null,
      continuedAdd: false,
      checkoutClicked: false,
      freeShipping: false,
      completedAt: '',
      status: 'started',
      cart: {},
      studentId: profile ? profile.studentId : '',
      participantName: profile ? profile.name : '',
      className: profile ? profile.className : ''
    };
    if(!preview) setSession(s);
    return s;
  }
  function apiUrl(path){
    var base = String(cfg.apiBase || '').replace(/\/$/,'');
    return base ? base + path : '';
  }
  async function pushRecord(rec){
    if(rec.preview) return {ok:true, preview:true};
    var stored=Object.assign({},rec,{cart:Object.assign({},rec.cart||{})});
    saveLocalRecord(stored);
    var url = apiUrl('/api/participant');
    if(!url) return {ok:true, local:true};
    remoteQueue=remoteQueue.catch(function(){ return null; }).then(function(){
      return fetch(url, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({studyKey:cfg.studyKey, record:stored})
      }).then(function(res){
        if(!res.ok) throw new Error('remote ' + res.status);
        return res.json();
      });
    });
    return remoteQueue;
  }
  async function fetchResults(adminToken){
    var url = apiUrl('/api/results?studyKey=' + encodeURIComponent(cfg.studyKey));
    if(!url) return {ok:true, items:getLocalRecords(), source:'local'};
    var res = await fetch(url, {headers:{authorization:'Bearer ' + adminToken}});
    if(res.status === 401 || res.status === 403) throw new Error('AUTH');
    if(!res.ok) throw new Error('remote ' + res.status);
    var data = await res.json();
    data.source = 'remote';
    return data;
  }
  async function clearRemote(adminToken){
    var url = apiUrl('/api/results?studyKey=' + encodeURIComponent(cfg.studyKey));
    if(!url){ clearLocalRecords(); return {ok:true, source:'local'}; }
    var res = await fetch(url, {method:'DELETE', headers:{authorization:'Bearer ' + adminToken}});
    if(res.status === 401 || res.status === 403) throw new Error('AUTH');
    if(!res.ok) throw new Error('remote ' + res.status);
    return res.json();
  }
  function mean(xs){ return xs.length ? xs.reduce(function(a,b){return a+b;},0)/xs.length : 0; }
  function sd(xs){
    if(xs.length < 2) return 0;
    var m=mean(xs); return Math.sqrt(xs.reduce(function(s,x){return s+(x-m)*(x-m);},0)/(xs.length-1));
  }
  function erf(x){
    var sign=x<0?-1:1; x=Math.abs(x);
    var a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911;
    var t=1/(1+p*x);
    var y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
    return sign*y;
  }
  function normalCdf(z){ return .5*(1+erf(z/Math.SQRT2)); }
  function summarize(items){
    items = (items || []).filter(function(x){return x && !x.preview;});
    function group(v){ return items.filter(function(x){return x.variant===v;}); }
    function completed(rows){ return rows.filter(function(x){return x.status==='completed' && Number.isFinite(Number(x.finalValue));}); }
    function stats(v){
      var all=group(v), done=completed(all);
      var finals=done.map(function(x){return Number(x.finalValue);});
      var baselines=done.map(function(x){return Number(x.baselineValue || 0);});
      var deltas=done.map(function(x,i){return Number(x.addonValue != null ? x.addonValue : finals[i]-baselines[i]);});
      var free=done.filter(function(x){return !!x.freeShipping;}).length;
      var added=done.filter(function(x){return x.continuedAdd != null ? !!x.continuedAdd : Number(x.addonValue)>0.001;}).length;
      return {all:all.length,done:done.length,mean:mean(finals),sd:sd(finals),baseline:mean(baselines),delta:mean(deltas),freeRate:done.length?free/done.length:0,addonRate:done.length?added/done.length:0};
    }
    var A=stats('A'), B=stats('B');
    var diff=B.mean-A.mean;
    var lift=A.mean ? diff/A.mean : 0;
    var se=Math.sqrt((A.done?A.sd*A.sd/A.done:0)+(B.done?B.sd*B.sd/B.done:0));
    var z=se?diff/se:0;
    var p=se?2*(1-normalCdf(Math.abs(z))):1;
    var ci=[diff-1.96*se,diff+1.96*se];
    return {A:A,B:B,total:items.length,diff:diff,lift:lift,z:z,p:p,ci:ci};
  }
  window.P2 = {cfg:cfg,money:money,round2:round2,uid:uid,nowISO:nowISO,getLocalRecords:getLocalRecords,saveLocalRecord:saveLocalRecord,clearLocalRecords:clearLocalRecords,getProfile:getProfile,setProfile:setProfile,clearProfile:clearProfile,getSession:getSession,setSession:setSession,clearSession:clearSession,createSession:createSession,pushRecord:pushRecord,fetchResults:fetchResults,clearRemote:clearRemote,summarize:summarize};
})();
