(function(){
  'use strict';
  var P=window.P2, rows=[], token=sessionStorage.getItem('p206_admin_token')||'';
  var cfgKey='p206_api_config_v1';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function pct(v){return (Number(v||0)*100).toFixed(1)+'%';}
  function money(v){return P.money(Number(v||0));}
  function time(v){if(!v)return '—';try{return new Date(v).toLocaleString('zh-CN',{hour12:false});}catch(e){return v;}}
  function bool(v){return v?'是':'否';}
  function setStatus(text){document.getElementById('aggregateStatus').textContent=text;}
  function empty(text){return '<div class="empty-state">'+text+'</div>';}
  function currentToken(){return token||sessionStorage.getItem('p206_admin_token')||'';}
  function render(){
    var s=P.summarize(rows), A=s.A, B=s.B, done=A.done+B.done;
    document.getElementById('aggMetricGrid').innerHTML=[
      ['参与会话',rows.length,'A '+A.all+' / B '+B.all],
      ['完成结算',done,'A '+A.done+' / B '+B.done],
      ['A 平均金额',A.done?money(A.mean):'—','商品金额，不含配送费'],
      ['B 平均金额',B.done?money(B.mean):'—',A.done&&B.done?'B−A '+money(s.diff):'等待两组完成']
    ].map(function(x){return '<article class="metric-card"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>';}).join('');
    document.getElementById('aggLift').textContent=A.done&&B.done?'差值 '+money(s.diff)+' · '+(s.lift>=0?'+':'')+(s.lift*100).toFixed(1)+'%':'等待两组完成数据';
    var max=Math.max(A.mean,B.mean,1);
    document.getElementById('aggBarChart').innerHTML=done?[['A · 无提示',A.mean,'bar-a'],['B · 进度条',B.mean,'bar-b']].map(function(x){return '<div class="bar-row"><div class="bar-label">'+x[0]+'</div><div class="bar-track"><div class="bar-fill '+x[2]+'" style="width:'+Math.max(2,x[1]/max*100)+'%"></div></div><div class="bar-value">'+money(x[1])+'</div></div>';}).join(''):empty('还没有完成记录');
    var total=done, aDone=A.done, bDone=B.done;
    document.getElementById('aggDonut').style.background=total?'conic-gradient(var(--accent) 0 '+(bDone/total*100)+'%,var(--brand) '+(bDone/total*100)+'% 100%)':'var(--bg-elevated)';
    document.getElementById('aggLegend').innerHTML='<div><i class="legend-dot dot-a"></i>A 完成 '+aDone+'（'+(total?pct(aDone/total):'0.0%')+'）</div><div><i class="legend-dot dot-b"></i>B 完成 '+bDone+'（'+(total?pct(bDone/total):'0.0%')+'）</div>';
    document.getElementById('aggBehavior').innerHTML=[['继续加购率',A.addonRate,B.addonRate,'pct'],['免邮达成率',A.freeRate,B.freeRate,'pct'],['平均凑单金额',A.delta,B.delta,'money'],['完成率',A.all?A.done/A.all:0,B.all?B.done/B.all:0,'pct']].map(function(x){return '<div class="behavior-row"><span>'+x[0]+'</span><b>A '+(x[3]==='money'?money(x[1]):pct(x[1]))+'</b><b>B '+(x[3]==='money'?money(x[2]):pct(x[2]))+'</b></div>';}).join('');
    document.getElementById('aggHint').textContent=rows.length?'已载入 '+rows.length+' 条会话；完成记录 '+done+' 条。':'暂无完成记录；先从参与端完成一次模拟购物。';
    document.getElementById('participantBody').innerHTML=rows.length?rows.slice().sort(function(a,b){return String(b.startedAt||'').localeCompare(String(a.startedAt||''));}).map(function(r,i){var doneFlag=r.status==='completed';return '<tr><td>'+(i+1)+'</td><td>'+esc(r.studentId||'—')+'</td><td>'+esc(r.participantName||'—')+'</td><td>'+esc(r.className||'—')+'</td><td class="variant-cell">'+esc(r.variant||'—')+'</td><td>'+esc(r.status||'—')+'</td><td>'+((r.finalValue==null)?'—':money(r.finalValue))+'</td><td>'+bool(r.continuedAdd!=null?r.continuedAdd:Number(r.addonValue)>0.001)+'</td><td>'+bool(r.freeShipping)+'</td><td>'+bool(r.checkoutClicked!=null?r.checkoutClicked:doneFlag)+'</td><td>'+time(r.completedAt||r.startedAt)+'</td></tr>';}).join(''):'<tr><td colspan="11" class="empty-cell">还没有参与记录。</td></tr>';
    document.getElementById('apiTip').textContent=P.cfg.apiBase?'已配置云端接口：'+P.cfg.apiBase:'未配置时使用本机记录。';
  }
  async function load(){
    setStatus('正在读取…');
    try{var data=await P.fetchResults(currentToken());rows=Array.isArray(data.items)?data.items:[];setStatus(data.source==='remote'?'云端 D1 · '+rows.length+' 条':'本机记录 · '+rows.length+' 条');}
    catch(e){rows=P.getLocalRecords();setStatus('云端读取失败，已回退本机 · '+rows.length+' 条');}
    render();
  }
  function csvRows(detail){
    var head=detail?['participant_id','student_id','name','class_name','variant','status','started_at','final_value','continued_add','free_shipping','checkout_clicked','completed_at']:['variant','sessions','completed','avg_final_value','addon_rate','free_rate','checkout_rate'];
    if(detail)return [head].concat(rows.map(function(r){return [r.participantId,r.studentId,r.participantName,r.className,r.variant,r.status,r.startedAt,r.finalValue,r.continuedAdd?1:0,r.freeShipping?1:0,r.checkoutClicked?1:0,r.completedAt];}));
    var s=P.summarize(rows);return [head,['A',s.A.all,s.A.done,s.A.mean,s.A.addonRate,s.A.freeRate,s.A.done?s.A.done/s.A.all:0],['B',s.B.all,s.B.done,s.B.mean,s.B.addonRate,s.B.freeRate,s.B.done?s.B.done/s.B.all:0]];
  }
  function download(rowsOut,name){var csv='\ufeff'+rowsOut.map(function(row){return row.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');var blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  function parseText(text){
    var parsed;
    try{parsed=JSON.parse(text);}catch(e){parsed=text.split(/\r?\n/).map(function(line){try{return JSON.parse(line);}catch(_){return null;}}).filter(Boolean);}
    if(parsed&&parsed.items)parsed=parsed.items;
    if(parsed&&parsed.record)parsed=parsed.record;
    if(!Array.isArray(parsed))parsed=[parsed];
    return parsed.map(function(x){return x&&x.record?x.record:x;}).filter(function(x){return x&&x.participantId;}).map(function(x){return Object.assign({studyKey:P.cfg.studyKey},x);});
  }
  function importText(text){var imported=parseText(text), count=0;imported.forEach(function(r){P.saveLocalRecord(r);count++;});document.getElementById('importHint').textContent=count?'已导入 '+count+' 条记录并去重。':'未识别出有效 JSON 记录。';load();}
  document.getElementById('aggregateRefresh').onclick=load;
  document.getElementById('aggregateCsv').onclick=function(){download(csvRows(false),'P2-06_汇总统计.csv');};
  document.getElementById('participantCsv').onclick=function(){download(csvRows(true),'P2-06_参与明细.csv');};
  document.getElementById('clearLocalBtn').onclick=function(){if(confirm('只清空本机记录，不影响云端数据，继续吗？')){P.clearLocalRecords();load();}};
  document.getElementById('importInput').addEventListener('change',function(){var file=this.files&&this.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){importText(String(reader.result||''));};reader.readAsText(file);});
  var drop=document.getElementById('dropZone');['dragenter','dragover'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.add('on');});});['dragleave','drop'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.remove('on');});});drop.addEventListener('drop',function(e){var file=e.dataTransfer.files&&e.dataTransfer.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){importText(String(reader.result||''));};reader.readAsText(file);});
  document.getElementById('saveApiBtn').onclick=function(){var url=document.getElementById('apiUrl').value.trim().replace(/\/$/,'');var t=document.getElementById('apiToken').value;localStorage.setItem(cfgKey,JSON.stringify({apiBase:url}));P.cfg.apiBase=url;if(t){sessionStorage.setItem('p206_admin_token',t);token=t;}document.getElementById('apiTip').textContent=url?'已保存接口地址，正在拉取云端数据…':'已清除接口地址，使用本机记录。';load();};
  document.getElementById('pullApiBtn').onclick=load;
  (function(){try{var c=JSON.parse(localStorage.getItem(cfgKey)||'null');if(c&&c.apiBase)document.getElementById('apiUrl').value=c.apiBase;}catch(e){}})();
  load();
})();
