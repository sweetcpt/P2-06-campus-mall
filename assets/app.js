(function(){
  'use strict';
  var P = window.P2;
  var products = window.P2_PRODUCTS || [];
  var session = P.createSession(false);
  var profile = P.getProfile && P.getProfile();
  var grid = document.getElementById('productGrid');
  var intro = document.getElementById('introSheet');
  var cartSheet = document.getElementById('cartSheet');
  var successSheet = document.getElementById('successSheet');
  var scrim = document.getElementById('scrim');
  var treatment = document.getElementById('treatmentArea');
  var cartLines = document.getElementById('cartLines');
  var toastTimer = null;

  var profileStrip=document.getElementById('profileStrip');
  if(profileStrip && profile){ profileStrip.textContent='参与者 '+profile.name+' · 模拟购物，不产生真实订单'; }

  function product(id){ return products.find(function(x){return x.id===id;}); }
  function cartQty(){ return Object.keys(session.cart||{}).reduce(function(n,id){return n+(session.cart[id]||0);},0); }
  function subtotal(){
    return P.round2(Object.keys(session.cart||{}).reduce(function(sum,id){ var p=product(id); return sum+(p?p.price*(session.cart[id]||0):0); },0));
  }
  function shipping(){ return subtotal() >= P.cfg.freeShippingThreshold ? 0 : P.cfg.shippingFee; }
  function saveSession(){ if(!session.preview) P.setSession(session); }
  function showToast(msg){
    var el=document.getElementById('toast'); el.textContent=msg; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer=setTimeout(function(){el.classList.add('hidden');},1800);
  }
  function showSheet(el){
    [intro,cartSheet,successSheet].forEach(function(x){ if(x!==el) x.classList.add('hidden'); });
    el.classList.remove('hidden'); scrim.classList.remove('hidden');
  }
  function hideSheets(){ cartSheet.classList.add('hidden'); successSheet.classList.add('hidden'); scrim.classList.add('hidden'); }
  function art(p, cls){ return '<div class="product-art '+p.art+' '+(cls||'')+'"><span>'+p.emoji+'</span></div>'; }

  function renderProducts(){
    grid.innerHTML = products.map(function(p){
      var q=session.cart[p.id]||0;
      return '<article class="product-card">'+art(p)+'<div class="product-body"><div class="product-name">'+p.name+'</div><div class="product-desc">'+p.desc+'</div><div class="product-footer"><span class="price">'+P.money(p.price)+'</span><button class="add-btn" data-add="'+p.id+'" aria-label="加入 '+p.name+'">'+(q?'+':'＋')+'</button></div></div></article>';
    }).join('');
    grid.querySelectorAll('[data-add]').forEach(function(btn){ btn.onclick=function(){ addItem(btn.dataset.add,1,true); }; });
  }

  function renderCart(){
    var sum=subtotal(), fee=shipping(), threshold=P.cfg.freeShippingThreshold;
    document.getElementById('cartCount').textContent=cartQty();
    document.getElementById('subtotalText').textContent=P.money(sum);
    document.getElementById('shippingText').textContent=fee===0?'免运费':P.money(fee);
    document.getElementById('totalText').textContent=P.money(sum+fee);
    document.getElementById('checkoutBtn').disabled=cartQty()===0;

    var ids=Object.keys(session.cart||{}).filter(function(id){return session.cart[id]>0 && product(id);});
    document.getElementById('cartEmpty').classList.toggle('hidden',ids.length>0);
    cartLines.innerHTML=ids.map(function(id){
      var p=product(id), q=session.cart[id];
      return '<div class="cart-line"><div class="cart-thumb '+p.art+'">'+p.emoji+'</div><div><strong>'+p.name+'</strong><small>'+P.money(p.price)+' / 件</small></div><div class="qty-control"><button data-minus="'+id+'">−</button><b>'+q+'</b><button data-plus="'+id+'">＋</button></div></div>';
    }).join('');
    cartLines.querySelectorAll('[data-minus]').forEach(function(b){b.onclick=function(){addItem(b.dataset.minus,-1,false);};});
    cartLines.querySelectorAll('[data-plus]').forEach(function(b){b.onclick=function(){addItem(b.dataset.plus,1,false);};});

    if(session.variant==='B'){
      if(sum < threshold){
        var remain=P.round2(threshold-sum), pct=Math.max(4,Math.min(100,sum/threshold*100));
        var addons=products.filter(function(p){return p.addon && (!session.cart[p.id] || session.cart[p.id]===0);}).slice(0,4);
        treatment.innerHTML='<div class="treatment treatment-b"><div class="treatment-title"><span>🚚 再买 <strong>'+P.money(remain)+'</strong> 即可免运费</span><small>'+Math.round(pct)+'%</small></div><div class="progress-track"><i style="width:'+pct+'%"></i></div><div class="progress-labels"><span>当前 '+P.money(sum)+'</span><span>'+P.money(threshold)+' 免邮</span></div>'+(addons.length?'<div class="addon-title">凑单小件 · 一键加入</div><div class="addon-row">'+addons.map(function(p){return '<button class="addon-btn" data-addon="'+p.id+'">'+p.emoji+' '+p.name+' '+P.money(p.price)+'</button>';}).join('')+'</div>':'')+'</div>';
        treatment.querySelectorAll('[data-addon]').forEach(function(b){b.onclick=function(){addItem(b.dataset.addon,1,false);showToast('已加入凑单商品');};});
      } else {
        treatment.innerHTML='<div class="treatment treatment-b treatment-success"><div class="treatment-title"><span>🎉 <strong>已达到免运费门槛</strong></span><small>省 '+P.money(P.cfg.shippingFee)+'</small></div><div class="progress-track"><i style="width:100%"></i></div><div class="progress-labels"><span>当前 '+P.money(sum)+'</span><span>'+P.money(threshold)+' 免邮</span></div></div>';
      }
    } else {
      treatment.innerHTML='';
    }
    renderProducts();
  }

  function snapshot(status){
    var sum=subtotal();
    if(session.baselineValue==null && session.cartOpenedAt){
      session.baselineValue=sum;
      session.initialQuantity=cartQty();
    }
    session.status=status||session.status;
    session.finalValue=sum;
    session.addonValue=session.baselineValue==null?null:P.round2(sum-session.baselineValue);
    session.finalQuantity=cartQty();
    session.continuedAdd=!!session.continuedAdd;
    session.checkoutClicked=!!session.checkoutClicked || session.status==='completed';
    session.freeShipping=sum>=P.cfg.freeShippingThreshold;
    session.cart=Object.assign({},session.cart);
    saveSession();
    P.pushRecord(Object.assign({},session)).catch(function(){ showToast('已保存在本机，云端暂未同步'); });
  }

  function addItem(id,delta,toast){
    var p=product(id); if(!p) return;
    var q=Math.max(0,(session.cart[id]||0)+delta);
    if(q===0) delete session.cart[id]; else session.cart[id]=q;
    if(session.cartOpenedAt && delta>0) session.continuedAdd=true;
    saveSession(); renderCart();
    if(session.cartOpenedAt) snapshot('cart_opened');
    if(toast) showToast(delta>0?'已加入购物车':'已更新购物车');
  }

  function openCart(){
    if(!session.cartOpenedAt){
      session.cartOpenedAt=P.nowISO();
      session.baselineValue=subtotal();
      session.initialQuantity=cartQty();
      snapshot('cart_opened');
    }
    renderCart(); showSheet(cartSheet);
  }

  document.getElementById('startExperiment').onclick=function(){
    session.cart={fan:1};
    session.status='started';
    saveSession();
    P.pushRecord(Object.assign({},session)).catch(function(){});
    if(session.preview) showToast('预览 '+session.variant+' 版 · 不计入实验数据');
    intro.classList.add('hidden');
    openCart();
  };
  document.querySelectorAll('.cart-trigger').forEach(function(b){b.onclick=openCart;});
  document.getElementById('closeCart').onclick=hideSheets;
  document.getElementById('continueBtn').onclick=hideSheets;
  scrim.onclick=function(){ if(!intro.classList.contains('hidden')) return; hideSheets(); };
  document.getElementById('recommendNav').onclick=function(){document.querySelector('.section-block').scrollIntoView({behavior:'smooth'});};
  document.getElementById('aboutNav').onclick=function(){document.querySelector('.why-card').scrollIntoView({behavior:'smooth'});};

  document.getElementById('checkoutBtn').onclick=function(){
    if(cartQty()===0) return;
    session.checkoutClicked=true;
    session.completedAt=P.nowISO();
    snapshot('completed');
    document.getElementById('receiptValue').textContent=P.money(subtotal());
    document.getElementById('receiptShip').textContent=shipping()===0?'配送费：已免运费':'配送费：'+P.money(shipping());
    showSheet(successSheet);
  };
  document.getElementById('restartBtn').onclick=function(){
    var url=new URL(location.href); url.search='?preview='+session.variant; location.href=url.toString();
  };

  renderProducts(); renderCart();
  if(session.preview){
    intro.querySelector('.privacy-note').textContent='当前为 '+session.variant+' 版预览，不会写入正式实验数据。';
  } else if(session.status==='completed') {
    document.getElementById('receiptValue').textContent=P.money(session.finalValue || subtotal());
    document.getElementById('receiptShip').textContent=session.freeShipping?'配送费：已免运费':'配送费：'+P.money(P.cfg.shippingFee);
    intro.classList.add('hidden');
    showSheet(successSheet);
  } else if(session.cartOpenedAt) {
    intro.classList.add('hidden');
    showSheet(cartSheet);
  } else {
    showSheet(intro);
  }
})();
