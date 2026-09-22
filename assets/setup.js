(function(){
  'use strict';
  var P=window.P2, key='p206_api_config_v1';
  var urlInput=document.getElementById('setupApiUrl'), tokenInput=document.getElementById('setupToken'), result=document.getElementById('setupResult');
  function set(text,kind){result.textContent=text;result.className='setup-result '+(kind||'');}
  function load(){
    try{var c=JSON.parse(localStorage.getItem(key)||'null');if(c&&c.apiBase)urlInput.value=c.apiBase;}catch(e){}
    var t=sessionStorage.getItem('p206_admin_token');if(t)tokenInput.value=t;
    set(P.cfg.apiBase?'已配置：'+P.cfg.apiBase:'当前使用本机记录。','');
  }
  document.getElementById('setupSaveBtn').onclick=function(){
    var url=urlInput.value.trim().replace(/\/$/,'');
    localStorage.setItem(key,JSON.stringify({apiBase:url}));P.cfg.apiBase=url;
    var token=tokenInput.value.trim();if(token)sessionStorage.setItem('p206_admin_token',token);else sessionStorage.removeItem('p206_admin_token');
    set(url?'已保存接口地址：'+url:'已清除接口地址，恢复本机模式。','success');
  };
  document.getElementById('setupClearBtn').onclick=function(){localStorage.removeItem(key);P.cfg.apiBase='';sessionStorage.removeItem('p206_admin_token');urlInput.value='';tokenInput.value='';set('已恢复本机模式。','success');};
  document.getElementById('setupTestBtn').onclick=async function(){
    var url=urlInput.value.trim().replace(/\/$/,'');if(!url){set('请先填写 Worker URL。','warn');return;}
    set('正在请求 /api/health …','');
    try{var res=await fetch(url+'/api/health',{headers:{accept:'application/json'}});var data=await res.json();if(!res.ok||!data.ok)throw new Error('HTTP '+res.status);set('连接成功：Worker '+(data.service||'已响应')+'。','success');}
    catch(e){set('连接失败：'+(e.message||e)+'。请检查 URL、CORS 和 Worker 部署。','warn');}
  };
  load();
})();
