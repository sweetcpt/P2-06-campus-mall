(function(){
  'use strict';
  var P=window.P2, rows=[], adminToken=sessionStorage.getItem('p206_admin_token')||'';
  var metricGrid=document.getElementById('metricGrid');

  function pct(v){return (Number(v||0)*100).toFixed(1)+'%';}
  function fmt(v,d){return Number(v||0).toFixed(d==null?1:d);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function timeText(s){if(!s)return '—';try{return new Date(s).toLocaleString('zh-CN',{hour12:false});}catch(e){return s;}}
  function quantity(r,kind){
    var explicit=kind==='initial'?r.initialQuantity:r.finalQuantity;
    if(explicit!=null && Number.isFinite(Number(explicit))) return Number(explicit);
    if(kind==='initial') return r.cartOpenedAt ? 1 : null;
    return Object.keys(r.cart||{}).reduce(function(n,id){return n+Math.max(0,Number(r.cart[id])||0);},0);
  }
  function tokenIfNeeded(){
    if(!P.cfg.apiBase) return '';
    if(adminToken) return adminToken;
    adminToken=prompt('请输入 Cloudflare Worker 后台 ADMIN_TOKEN：')||'';
    if(adminToken) sessionStorage.setItem('p206_admin_token',adminToken);
    return adminToken;
  }

  function render(){
    var s=P.summarize(rows), A=s.A, B=s.B;
    metricGrid.innerHTML=[
      ['参与会话',s.total,'A '+A.all+' / B '+B.all],
      ['完成结算',A.done+B.done,'A '+A.done+' / B '+B.done],
      ['B 相对提升',A.done&&B.done?(s.lift*100).toFixed(1)+'%':'—','主指标：最终购物车金额'],
      ['B 凑单率',B.done?pct(B.addonRate):'—','A '+(A.done?pct(A.addonRate):'—')]
    ].map(function(x){return '<article class="metric-card"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>';}).join('');

    var max=Math.max(A.mean,B.mean,1);
    document.getElementById('valueChart').innerHTML=[['A · 无提示',A.mean,'bar-a'],['B · 进度条',B.mean,'bar-b']].map(function(x){return '<div class="bar-row"><div class="bar-label">'+x[0]+'</div><div class="bar-track"><div class="bar-fill '+x[2]+'" style="width:'+(x[1]/max*100)+'%"></div></div><div class="bar-value">'+P.money(x[1])+'</div></div>';}).join('');
    document.getElementById('liftNote').textContent=A.done&&B.done?('差值 '+P.money(s.diff)+' · '+(s.lift>=0?'+':'')+fmt(s.lift*100,1)+'%'):'等待两组完成数据';

    document.getElementById('behaviorTable').innerHTML=[
      ['完成率',A.all?A.done/A.all:0,B.all?B.done/B.all:0,'pct'],
      ['继续凑单率',A.addonRate,B.addonRate,'pct'],
      ['达到免邮率',A.freeRate,B.freeRate,'pct'],
      ['平均凑单金额',A.delta,B.delta,'money']
    ].map(function(x){var av=x[3]==='money'?P.money(x[1]):pct(x[1]),bv=x[3]==='money'?P.money(x[2]):pct(x[2]);return '<div class="behavior-row"><span>'+x[0]+'</span><b>A '+av+'</b><b>B '+bv+'</b></div>';}).join('');

    var enough=A.done>=20&&B.done>=20;
    var direction=s.diff>0?'B 组平均金额高于 A 组':s.diff<0?'B 组平均金额低于 A 组':'两组平均金额暂时相同';
    var stat = enough ? ('大样本正态近似：差值 95% CI 为 '+P.money(s.ci[0])+' ～ '+P.money(s.ci[1])+'，双侧 p≈'+(s.p<.001?'<0.001':fmt(s.p,3))+'。') : ('当前完成样本 A='+A.done+'、B='+B.done+'，样本仍少，先报告描述性结果，不建议据此下显著性结论。');
    document.getElementById('interpretation').innerHTML='<div class="insight-card '+(s.diff>0?'positive':'')+'"><strong>'+direction+'</strong><p>当前 A 组平均 '+P.money(A.mean)+'，B 组平均 '+P.money(B.mean)+'，B−A='+P.money(s.diff)+'（'+(s.lift>=0?'+':'')+fmt(s.lift*100,1)+'%）。</p></div><div class="insight-card '+(enough?'':'warn')+'"><strong>'+(enough?'统计近似':'样本量提醒')+'</strong><p>'+stat+'</p></div><div class="insight-card"><strong>报告时怎么说</strong><p>本实验只操纵“免运费门槛是否被显性展示”。若 B 组的最终金额、继续凑单率和免邮达成率同时上升，可以把它解释为与“目标梯度效应”一致的行为证据；但课程报告仍应说明样本规模、随机分流和模拟购物环境的限制。</p></div>';

    document.getElementById('recordsBody').innerHTML=rows.length?rows.slice().sort(function(a,b){return String(b.startedAt).localeCompare(String(a.startedAt));}).map(function(r){var checkout=r.checkoutClicked!=null?!!r.checkoutClicked:r.status==='completed',continued=r.continuedAdd!=null?!!r.continuedAdd:Number(r.addonValue)>0.001,initialQty=quantity(r,'initial'),finalQty=quantity(r,'final');return '<tr><td>'+esc(String(r.participantId||'').slice(0,10))+'</td><td class="variant-cell">'+esc(r.variant)+'</td><td>'+esc(r.status)+'</td><td>'+(r.baselineValue==null?'—':P.money(r.baselineValue))+'</td><td>'+(r.finalValue==null?'—':P.money(r.finalValue))+'</td><td>'+(initialQty==null?'—':fmt(initialQty,0))+'</td><td>'+(finalQty==null?'—':fmt(finalQty,0))+'</td><td>'+(r.addonValue==null?'—':P.money(r.addonValue))+'</td><td>'+(continued?'是':'否')+'</td><td>'+(r.freeShipping?'是':'否')+'</td><td>'+(checkout?'是':'否')+'</td><td>'+timeText(r.completedAt||r.startedAt)+'</td></tr>';}).join(''):'<tr><td colspan="12" style="text-align:center;color:#8b94a3;padding:30px">还没有实验记录。先打开参与端完成几次模拟结算。</td></tr>';
  }

  async function load(){
    document.getElementById('lastSync').textContent='正在读取…';
    try{
      var data=await P.fetchResults(tokenIfNeeded());
      rows=data.items||[];
      document.getElementById('sourceLabel').textContent='数据源：'+(data.source==='remote'?'Cloudflare D1 云端':'本机演示数据');
      document.getElementById('lastSync').textContent='最后刷新 '+new Date().toLocaleTimeString('zh-CN',{hour12:false});
      render();
    }catch(e){
      if(e.message==='AUTH'){sessionStorage.removeItem('p206_admin_token');adminToken='';alert('后台口令错误，请重新输入。');return load();}
      rows=P.getLocalRecords();document.getElementById('sourceLabel').textContent='云端读取失败 · 已回退本机数据';document.getElementById('lastSync').textContent=String(e.message||e);render();
    }
  }

  function csv(){
    var head=['study_key','participant_id','variant','status','started_at','cart_opened_at','baseline_value','final_value','addon_value','initial_quantity','final_quantity','continued_add','free_shipping','checkout_clicked','completed_at'];
    var body=rows.map(function(r){var checkout=r.checkoutClicked!=null?!!r.checkoutClicked:r.status==='completed',continued=r.continuedAdd!=null?!!r.continuedAdd:Number(r.addonValue)>0.001;return [r.studyKey,r.participantId,r.variant,r.status,r.startedAt,r.cartOpenedAt,r.baselineValue,r.finalValue,r.addonValue,quantity(r,'initial'),quantity(r,'final'),continued?1:0,r.freeShipping?1:0,checkout?1:0,r.completedAt];});
    var text='\ufeff'+[head].concat(body).map(function(row){return row.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download='P2-06_AB实验数据.csv';a.click();URL.revokeObjectURL(a.href);
  }
  function summaryText(){
    var s=P.summarize(rows),A=s.A,B=s.B;
    return 'P2-06 免运费门槛提示 A/B 实验\nA组（无提示）：完成 '+A.done+'，平均最终购物车金额 '+P.money(A.mean)+'，继续凑单率 '+pct(A.addonRate)+'，免邮达成率 '+pct(A.freeRate)+'。\nB组（进度条提示）：完成 '+B.done+'，平均最终购物车金额 '+P.money(B.mean)+'，继续凑单率 '+pct(B.addonRate)+'，免邮达成率 '+pct(B.freeRate)+'。\nB-A 金额差：'+P.money(s.diff)+'（'+(s.lift>=0?'+':'')+fmt(s.lift*100,1)+'%）。\n说明：参与者随机分流，除免邮提示与配套凑单推荐外其余页面条件保持一致；该网页为课程模拟购物环境，不产生真实交易。';
  }

  document.getElementById('refreshBtn').onclick=load;
  document.getElementById('exportCsvBtn').onclick=csv;
  document.getElementById('copySummaryBtn').onclick=async function(){try{await navigator.clipboard.writeText(summaryText());this.textContent='已复制';setTimeout(()=>this.textContent='复制报告摘要',1200);}catch(e){alert(summaryText());}};
  document.getElementById('resetLocalBtn').onclick=async function(){
    if(!confirm(P.cfg.apiBase?'这只会清空本机演示缓存，不会删除云端正式数据。继续吗？':'确认清空当前浏览器里的实验记录？'))return;
    P.clearLocalRecords();rows=[];render();
  };
  load();
})();
