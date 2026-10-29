// Smoke + load test for the memorial API. Usage: node tools/load-test.mjs <apiBase> <allowedOrigin> [concurrency=300]
const [base, origin, n = '300'] = process.argv.slice(2);
if (!base || !origin) { console.error('usage: node tools/load-test.mjs <apiBase> <allowedOrigin> [concurrency]'); process.exit(1); }
const N = Number(n);
const j = (res) => res.json().catch(() => ({}));
const post = (path, body, headers = {}) => fetch(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body)
});
let failed = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failed++; };
const ip = (i) => `203.0.113.${(i % 250) + 1}, 10.0.0.${Math.floor(i / 250) + 1}:5000`;

const before = (await j(await fetch(base + '/api/state'))).totals;

// correctness
check('POST without Origin is rejected', (await fetch(base + '/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 403);
check('POST with foreign Origin is rejected', (await post('/api/actions', {}, { Origin: 'https://evil.example' })).status === 403);
check('non-JSON is rejected', (await fetch(base + '/api/actions', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: origin }, body: 'x' })).status === 415);
check('oversized body is rejected', (await post('/api/actions', { pad: 'x'.repeat(5000) })).status === 413);
for (const [i, [label, msg]] of [['URL', 'see https://evil.example'], ['NG word', 'f u c k'], ['phone', '090-1234-5678']].entries()) {
  check(`tribute with ${label} is rejected`, (await post('/api/tributes', { name: 't', msg }, { 'X-Forwarded-For': `198.51.100.${10 + i}` })).status === 422);
}

// tribute create + delete round trip
const text = `load test ${Math.random().toString(36).slice(2, 8)}`;
const created = await post('/api/tributes', { name: 'tester', msg: text }, { 'X-Forwarded-For': '198.51.100.8' });
const c = await j(created);
check('tribute is created', created.status === 201 && !!c.id && !!c.token);
check('delete with wrong token fails', (await fetch(`${base}/api/tributes/${c.id}`, { method: 'DELETE', headers: { Origin: origin, 'X-Delete-Token': 'wrong-token-value' } })).status === 404);
check('delete with right token works', (await fetch(`${base}/api/tributes/${c.id}`, { method: 'DELETE', headers: { Origin: origin, 'X-Delete-Token': c.token } })).status === 200);

// load: N concurrent clients, each adds 1 candle + 2 F + 1 flower[3]
const t0 = Date.now();
const results = await Promise.all(Array.from({ length: N }, (_, i) =>
  post('/api/actions', { candle: 1, f: 2, flowers: [0, 0, 0, 1] }, { 'X-Forwarded-For': ip(i) }).then((r) => r.status).catch(() => 0)));
const ms = Date.now() - t0;
const ok = results.filter((s) => s === 202).length;
console.log(`${N} concurrent POSTs in ${ms} ms, accepted=${ok}, statuses=${JSON.stringify(results.reduce((a, s) => ((a[s] = (a[s] || 0) + 1), a), {}))}`);

await new Promise((r) => setTimeout(r, 3500)); // state cache is 3 s
const after = (await j(await fetch(base + '/api/state'))).totals;
check('no lost candle updates', after.candle - before.candle === ok, `${after.candle - before.candle}/${ok}`);
check('no lost F updates', after.f - before.f === ok * 2, `${after.f - before.f}/${ok * 2}`);
check('no lost flower updates', after.flowers[3] - before.flowers[3] === ok, `${after.flowers[3] - before.flowers[3]}/${ok}`);

// concurrent readers
const reads = await Promise.all(Array.from({ length: N }, () => fetch(base + '/api/state').then((r) => r.status).catch(() => 0)));
check(`${N} concurrent reads succeed`, reads.every((s) => s === 200), `${reads.filter((s) => s === 200).length}/${N}`);

process.exit(failed ? 1 : 0);
