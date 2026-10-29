'use strict';

const { app } = require('@azure/functions');
const store = require('../lib/store');
const { clean, isRejected } = require('../lib/text');
const { clientKey, Bucket, originAllowed } = require('../lib/guard');

const NAME_MAX = 24;
const MSG_MAX = 140;
const MAX_BODY = 2048;
const MAX_PER_REQUEST = 100;

// Per-IP limits (best effort, per instance).
const clickBucket = new Bucket(300, 5);
const actionCalls = new Bucket(20, 20 / 60);
const tributeCalls = new Bucket(2, 1 / 20);
const tributeHourly = new Bucket(8, 8 / 3600);
const recentMessages = new Map();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};

function reply(status, body, extra = {}) {
  return {
    status,
    jsonBody: body,
    headers: { ...SECURITY_HEADERS, 'Cache-Control': 'no-store', ...extra }
  };
}

async function readJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) return { error: reply(413, { error: 'too_large' }) };
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return { error: reply(415, { error: 'unsupported_media_type' }) };
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return { error: reply(413, { error: 'too_large' }) };
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('shape');
    return { data };
  } catch {
    return { error: reply(400, { error: 'bad_request' }) };
  }
}

const toCount = (v, max) => (Number.isInteger(v) && v > 0 ? Math.min(v, max) : 0);

app.http('state', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'state',
  handler: async (request, context) => {
    try {
      const [totals, tributes] = await Promise.all([store.getTotals(), store.listTributes(50)]);
      return reply(200, { totals, tributes, serverTime: Date.now() }, { 'Cache-Control': 'public, max-age=3' });
    } catch (e) {
      context.error('state failed', e);
      return reply(503, { error: 'unavailable' });
    }
  }
});

app.http('actions', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'actions',
  handler: async (request, context) => {
    if (!originAllowed(request)) return reply(403, { error: 'forbidden' });
    const key = clientKey(request);
    if (actionCalls.take(key) < 1) return reply(429, { error: 'rate_limited' }, { 'Retry-After': '10' });

    const parsed = await readJson(request);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const wanted = {
      candle: toCount(body.candle, MAX_PER_REQUEST),
      f: toCount(body.f, MAX_PER_REQUEST),
      koden: toCount(body.koden, MAX_PER_REQUEST),
      visit: toCount(body.visit, 1)
    };
    const flowers = Array.isArray(body.flowers) ? body.flowers.slice(0, store.FLOWER_KINDS) : [];
    flowers.forEach((v, i) => { wanted[`fl${i}`] = toCount(v, MAX_PER_REQUEST); });

    // Clip clicks to the per-IP budget instead of failing the whole request.
    const deltas = {};
    const total = Object.entries(wanted).reduce((s, [k, v]) => (k === 'visit' ? s : s + v), 0);
    let budget = total ? clickBucket.take(key, total) : 0;
    for (const [k, v] of Object.entries(wanted)) {
      if (!v) continue;
      const n = k === 'visit' ? v : Math.min(v, budget);
      if (k !== 'visit') budget -= n;
      if (n > 0) deltas[k] = n;
    }

    try {
      await store.addCounts(deltas);
      return reply(202, { ok: true });
    } catch (e) {
      context.error('actions failed', e);
      return reply(503, { error: 'unavailable' });
    }
  }
});

app.http('tributeCreate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'tributes',
  handler: async (request, context) => {
    if (!originAllowed(request)) return reply(403, { error: 'forbidden' });
    const key = clientKey(request);
    if (tributeCalls.take(key) < 1 || tributeHourly.take(key) < 1) {
      return reply(429, { error: 'rate_limited' }, { 'Retry-After': '20' });
    }

    const parsed = await readJson(request);
    if (parsed.error) return parsed.error;
    const name = clean(parsed.data.name, NAME_MAX);
    const msg = clean(parsed.data.msg, MSG_MAX);
    if (!msg) return reply(400, { error: 'empty' });
    if (isRejected(msg) || isRejected(name)) return reply(422, { error: 'rejected' });

    const now = Date.now();
    const sig = `${key}:${msg}`;
    if (recentMessages.get(sig) > now - 60 * 60 * 1000) return reply(409, { error: 'duplicate' });
    if (recentMessages.size > 5000) recentMessages.clear();
    recentMessages.set(sig, now);

    try {
      const created = await store.addTribute(name, msg);
      return reply(201, created);
    } catch (e) {
      context.error('tribute failed', e);
      return reply(503, { error: 'unavailable' });
    }
  }
});

app.http('tributeDelete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'tributes/{id}',
  handler: async (request, context) => {
    if (!originAllowed(request)) return reply(403, { error: 'forbidden' });
    if (actionCalls.take(clientKey(request)) < 1) return reply(429, { error: 'rate_limited' });
    try {
      const ok = await store.deleteTribute(String(request.params.id || ''), request.headers.get('x-delete-token') || '');
      return ok ? reply(200, { ok: true }) : reply(404, { error: 'not_found' });
    } catch (e) {
      context.error('delete failed', e);
      return reply(503, { error: 'unavailable' });
    }
  }
});
