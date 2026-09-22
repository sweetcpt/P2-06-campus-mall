(function(){
  'use strict';
  var P=window.P2;
  var form=document.getElementById('profileForm');
  var error=document.getElementById('entryError');
  var resume=document.getElementById('resumeCard');
  var resumeText=document.getElementById('resumeText');
  var profile=P.getProfile();
  var query=new URLSearchParams(location.search);
  var preview=(query.get('preview')||'').toUpperCase();
  var nextUrl='shop.html?e=P2-06'+(preview==='A'||preview==='B'?'&preview='+preview:'');

  function fill(p){
    if(!p) return;
    document.getElementById('studentId').value=p.studentId||'';
    document.getElementById('participantName').value=p.name||'';
    document.getElementById('className').value=p.className||'';
  }
  function showError(text){error.textContent=text||'';error.classList.toggle('show',!!text);}
  function valid(){
    var sid=document.getElementById('studentId').value.trim();
    var name=document.getElementById('participantName').value.trim();
    var klass=document.getElementById('className').value.trim();
    if(!sid||!name||!klass){showError('请完整填写学号、姓名和班级。');return null;}
    if(sid.length<4){showError('请填写完整的学号（至少 4 位）。');return null;}
    return {studentId:sid,name:name,className:klass};
  }
  function go(){ location.href=nextUrl; }
  function existingResume(){
    var s=P.getSession();
    if(!profile||!s||s.studyKey!==P.cfg.studyKey||s.studentId!==profile.studentId||s.status==='completed') return;
    resumeText.textContent=profile.name+' 的上次体验还没有结算，可以继续上次的购物车。';
    resume.classList.remove('hidden');
  }
  fill(profile); existingResume();
  if(preview==='A'||preview==='B'){
    var note=document.createElement('div'); note.className='preview-note'; note.textContent='当前为教师预览：'+preview+' 版，不会写入正式实验数据。';
    form.parentNode.insertBefore(note,form);
  }
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var next=valid(); if(!next) return;
    showError('');
    var old=P.getSession();
    P.setProfile(next);
    if(old && old.studentId!==next.studentId) P.clearSession();
    profile=next;
    go();
  });
  document.getElementById('resumeBtn').addEventListener('click',go);
  document.getElementById('newBtn').addEventListener('click',function(){
    P.clearSession(); P.clearProfile(); profile=null; resume.classList.add('hidden'); form.reset(); showError('');
    document.getElementById('studentId').focus();
  });
})();
