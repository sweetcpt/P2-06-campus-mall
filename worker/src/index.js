function cors(env, request) {
  const configured = env.ALLOWED_ORIGIN || '*';
  const origin = request.headers.get('Origin') || '';
  const allowed = configured === '*' ? '*' : (origin === configured ? origin : configured);
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(data, status, env, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({'content-type':'application/json; charset=utf-8'}, cors(env, request))
  });
}
function adminOK(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  return request.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;
}
function text(v, max) {
  const s = String(v == null ? '' : v).trim();
  return s.slice(0, max);
}
function optionalText(v, max) {
  const s = text(v, max);
  return s || null;
}
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function integer(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
function validRecord(studyKey, r) {
  if (!studyKey || studyKey.length > 80) return 'invalid studyKey';
  if (!r || !/^[A-Za-z0-9-]{8,64}$/.test(String(r.participantId || ''))) return 'invalid participantId';
  if (r.variant !== 'A' && r.variant !== 'B') return 'invalid variant';
  if (!['started','cart_opened','completed'].includes(r.status)) return 'invalid status';
  return '';
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:cors(env, request)});
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ok:true, service:'p2-06-ab-api'}, 200, env, request);
    }
    if (url.pathname === '/api/participant' && request.method === 'POST') {
      const len = Number(request.headers.get('content-length') || 0);
      if (len > 20000) return json({ok:false,error:'payload too large'}, 413, env, request);
      let body;
      try { body = await request.json(); } catch { return json({ok:false,error:'invalid json'}, 400, env, request); }
      const studyKey = text(body.studyKey, 80);
      const r = body.record || {};
      const bad = validRecord(studyKey, r);
      if (bad) return json({ok:false,error:bad}, 400, env, request);
      const updatedAt = new Date().toISOString();
      const cartJson = JSON.stringify(r.cart && typeof r.cart === 'object' ? r.cart : {} ).slice(0,4000);
      await env.DB.prepare(`
        INSERT INTO participant_records
        (study_key,participant_id,student_id,participant_name,class_name,variant,status,started_at,cart_opened_at,baseline_value,final_value,addon_value,initial_quantity,final_quantity,continued_add,checkout_clicked,free_shipping,completed_at,cart_json,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(study_key,participant_id) DO UPDATE SET
          student_id=COALESCE(excluded.student_id,participant_records.student_id),
          participant_name=COALESCE(excluded.participant_name,participant_records.participant_name),
          class_name=COALESCE(excluded.class_name,participant_records.class_name),
          variant=excluded.variant,status=excluded.status,started_at=excluded.started_at,cart_opened_at=excluded.cart_opened_at,
          baseline_value=excluded.baseline_value,final_value=excluded.final_value,addon_value=excluded.addon_value,
          initial_quantity=COALESCE(excluded.initial_quantity,participant_records.initial_quantity),
          final_quantity=COALESCE(excluded.final_quantity,participant_records.final_quantity),
          continued_add=CASE WHEN excluded.continued_add=1 OR participant_records.continued_add=1 OR COALESCE(excluded.addon_value,0)>0.001 THEN 1 ELSE 0 END,
          checkout_clicked=CASE WHEN excluded.checkout_clicked=1 OR participant_records.checkout_clicked=1 OR excluded.status='completed' THEN 1 ELSE 0 END,
          free_shipping=excluded.free_shipping,completed_at=excluded.completed_at,cart_json=excluded.cart_json,updated_at=excluded.updated_at
        WHERE CASE participant_records.status WHEN 'started' THEN 0 WHEN 'cart_opened' THEN 1 WHEN 'completed' THEN 2 ELSE -1 END
          <= CASE excluded.status WHEN 'started' THEN 0 WHEN 'cart_opened' THEN 1 WHEN 'completed' THEN 2 ELSE -1 END
      `).bind(
        studyKey, text(r.participantId,64), optionalText(r.studentId,80), optionalText(r.participantName,80), optionalText(r.className,120),
        r.variant, r.status, text(r.startedAt,40), text(r.cartOpenedAt,40),
        num(r.baselineValue), num(r.finalValue), num(r.addonValue), integer(r.initialQuantity), integer(r.finalQuantity),
        r.continuedAdd ? 1 : 0, r.checkoutClicked ? 1 : 0, r.freeShipping ? 1 : 0, text(r.completedAt,40), cartJson, updatedAt
      ).run();
      return json({ok:true}, 200, env, request);
    }
    if (url.pathname === '/api/results' && request.method === 'GET') {
      if (!adminOK(request, env)) return json({ok:false,error:'unauthorized'}, 401, env, request);
      const studyKey = text(url.searchParams.get('studyKey'),80);
      if (!studyKey) return json({ok:false,error:'studyKey required'},400,env,request);
      const result = await env.DB.prepare(`SELECT * FROM participant_records WHERE study_key=? ORDER BY updated_at DESC LIMIT 5000`).bind(studyKey).all();
      const items = (result.results || []).map(row => {
        let cart = {};
        try {
          cart = JSON.parse(row.cart_json || '{}');
          if (!cart || typeof cart !== 'object' || Array.isArray(cart)) cart = {};
        } catch { cart = {}; }
        const derivedFinalQuantity = Object.keys(cart).reduce((n, id) => n + Math.max(0, Number(cart[id]) || 0), 0);
        return {
          studyKey: row.study_key,
          participantId: row.participant_id,
          studentId: row.student_id || '',
          participantName: row.participant_name || '',
          className: row.class_name || '',
          variant: row.variant,
          status: row.status,
          startedAt: row.started_at || '',
          cartOpenedAt: row.cart_opened_at || '',
          baselineValue: row.baseline_value,
          finalValue: row.final_value,
          addonValue: row.addon_value,
          initialQuantity: row.initial_quantity == null ? (row.cart_opened_at ? 1 : null) : Number(row.initial_quantity),
          finalQuantity: row.final_quantity == null ? derivedFinalQuantity : Number(row.final_quantity),
          continuedAdd: !!row.continued_add || Number(row.addon_value) > 0.001,
          checkoutClicked: !!row.checkout_clicked || row.status === 'completed',
          freeShipping: !!row.free_shipping,
          completedAt: row.completed_at || '',
          cart
        };
      });
      return json({ok:true,count:items.length,items},200,env,request);
    }
    if (url.pathname === '/api/results' && request.method === 'DELETE') {
      if (!adminOK(request, env)) return json({ok:false,error:'unauthorized'}, 401, env, request);
      const studyKey = text(url.searchParams.get('studyKey'),80);
      if (!studyKey) return json({ok:false,error:'studyKey required'},400,env,request);
      const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM participant_records WHERE study_key=?').bind(studyKey).first();
      await env.DB.prepare('DELETE FROM participant_records WHERE study_key=?').bind(studyKey).run();
      return json({ok:true,deleted:Number(before && before.n || 0)},200,env,request);
    }
    return json({ok:false,error:'not found'},404,env,request);
  }
};
