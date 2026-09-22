(function(){
  'use strict';
  var P=window.P2, rows=[], token=sessionStorage.getItem('p206_admin_token')||'';
  function pct(v){return (Number(v||0)*100).toFixed(1)+'%';}
  function money(v){return P.money(Number(v||0));}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function set(id,text){var el=document.getElementById(id);if(el)el.textContent=text;}
  function shareUrl(){return new URL('share.html?e=P2-06',location.href).href;}
  function render(){
    var s=P.summarize(rows),A=s.A,B=s.B,done=A.done+B.done;
    document.getElementById('metricGrid').innerHTML=[
      ['参与会话',rows.length,'A '+A.all+' / B '+B.all],
      ['完成结算',done,'A '+A.done+' / B '+B.done],
      ['平均最终金额',done?money((A.mean*A.done+B.mean*B.done)/done):'—','商品金额，不含配送费'],
      ['B 相对变化',A.done&&B.done?(s.lift>=0?'+':'')+pct(s.lift):'—','主指标：最终购物车金额'],
      ['B 凑单率',B.done?pct(B.addonRate):'—','继续加购并留下记录'],
      ['B 免邮率',B.done?pct(B.freeRate):'—','达到 ¥53 的完成记录']
    ].map(function(x){return '<article class="metric-card"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></article>';}).join('');
    var banner=document.getElementById('dataBanner');
    if(done){banner.className='data-banner success';banner.innerHTML='<b>✅</b><span>已汇总 '+done+' 条完成记录；当前结果来自真实参与行为。</span>';}
    else{banner.className='data-banner';banner.innerHTML='<b>⏳</b><span>还没有完成记录，先邀请同学完成一次模拟购物。</span>';}
    set('dataHint',rows.length?'当前 A '+A.all+' / B '+B.all+' 个会话，已完成 A '+A.done+' / B '+B.done+'；页面不会生成随机样本。':'样本量 = 真实提交的完成记录；页面不会生成随机样本。');
    var con=document.getElementById('conclusionBanner'), grid=document.getElementById('conclusionGrid'), read=document.getElementById('interpretation');
    grid.innerHTML=[['A 组平均金额',A.done?money(A.mean):'—','无提示'],['B 组平均金额',B.done?money(B.mean):'—','进度条提示'],['B − A',A.done&&B.done?money(s.diff):'—','绝对差值'],['相对变化',A.done&&B.done?(s.lift>=0?'+':'')+pct(s.lift):'—','描述性结果']].map(function(x){return '<div><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>';}).join('');
    var enough=A.done>=20&&B.done>=20;
    con.className='data-banner '+(enough?'success':'neutral');con.innerHTML='<b>'+(enough?'📈':'📊')+'</b><span>'+(enough?'两组完成样本达到课程观察门槛，可查看统计近似；仍需结合实验限制解释。':'样本不足，暂不下显著性结论；当前只观察金额、凑单率和免邮率趋势。')+'</span>';
    read.innerHTML='<div class="insight-card"><strong>'+(A.done&&B.done?(s.diff>=0?'B 组目前高于 A 组':'B 组目前低于 A 组'):'等待两组完成记录')+'</strong><p>'+ (A.done&&B.done?'A 组平均 '+money(A.mean)+'，B 组平均 '+money(B.mean)+'，差值 '+money(s.diff)+'（'+(s.lift>=0?'+':'')+pct(s.lift)+'）。':'目前没有足够的真实完成记录进行比较。')+'</p></div><div class="insight-card warn"><strong>课程报告提示</strong><p>只有完成真实模拟购物的记录才计入样本。若样本量少，不应写“B 显著优于 A”；应写成趋势观察，并说明模拟商城、样本规模和跨设备收集限制。</p></div>';
  }
  async function load(){
    set('lastSync','正在读取…');
    try{var data=await P.fetchResults(token);rows=Array.isArray(data.items)?data.items:[];set('sourceLabel','数据源：'+(data.source==='remote'?'Cloudflare D1 云端':'本机记录'));set('lastSync','最后刷新 '+new Date().toLocaleTimeString('zh-CN',{hour12:false}));}
    catch(e){rows=P.getLocalRecords();set('sourceLabel','云端读取失败 · 已回退本机记录');set('lastSync',String(e.message||e));}
    document.getElementById('shareUrl').textContent=shareUrl();document.getElementById('openShareBtn').href=shareUrl();render();
  }
  function exportCsv(){var head=['study_key','participant_id','student_id','name','class_name','variant','status','started_at','final_value','continued_add','free_shipping','checkout_clicked','completed_at'];var body=rows.map(function(r){return [r.studyKey,r.participantId,r.studentId,r.participantName,r.className,r.variant,r.status,r.startedAt,r.finalValue,r.continuedAdd?1:0,r.freeShipping?1:0,r.checkoutClicked?1:0,r.completedAt];});var text='\ufeff'+[head].concat(body).map(function(row){return row.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download='P2-06_AB实验数据.csv';a.click();}
  document.getElementById('copyShareBtn').onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(shareUrl()).then(function(){alert('参与链接已复制。');}).catch(function(){alert(shareUrl());});};
  document.getElementById('shareCardBtn').onclick=function(){var out=document.getElementById('shareCardOutput');out.classList.remove('hidden');out.innerHTML='<div class="share-card-preview"><span>P2-06 · 湛科校园商城实验</span><strong>帮忙体验一次宿舍好物购物</strong><p>登记后进入湛科生活站，完成一次模拟购物；不会扣款。</p><code>'+esc(shareUrl())+'</code></div>';};
  document.getElementById('refreshDataBtn').onclick=load;document.getElementById('exportCsvBtn').onclick=exportCsv;
  document.getElementById('shareUrl').textContent=shareUrl();load();
})();
