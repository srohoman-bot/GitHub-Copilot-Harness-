'use strict';

const crypto = require('node:crypto');
const { TableClient, odata } = require('@azure/data-tables');
const { DefaultAzureCredential } = require('@azure/identity');

const SHARDS = 32;
const FLOWER_KINDS = 8;
const CACHE_MS = 3000;
const FIELDS = ['candle', 'f', 'koden', 'visit', 'tribute', ...Array.from({ length: FLOWER_KINDS }, (_, i) => `fl${i}`)];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clients = {};
let ensured = null;

function client(name) {
  if (!clients[name]) {
    const cs = process.env.TABLES_CONNECTION_STRING;
    clients[name] = cs
      ? TableClient.fromConnectionString(cs, name, { allowInsecureConnection: true })
      : new TableClient(process.env.STORAGE_TABLE_ENDPOINT, name, new DefaultAzureCredential());
  }
  return clients[name];
}

// Tables are created by Bicep in Azure; this only helps local Azurite runs.
function ensureTables() {
  if (!process.env.TABLES_CONNECTION_STRING) return Promise.resolve();
  ensured = ensured || Promise.all(['counters', 'tributes'].map((n) => client(n).createTable().catch(() => {})));
  return ensured;
}

async function addCounts(deltas) {
  const entries = Object.entries(deltas).filter(([k, v]) => FIELDS.includes(k) && v > 0);
  if (!entries.length) return;
  await ensureTables();
  const table = client('counters');
  for (let attempt = 0; attempt < 8; attempt++) {
    const rowKey = String(Math.floor(Math.random() * SHARDS)).padStart(2, '0');
    try {
      let current = null;
      try { current = await table.getEntity('c', rowKey); } catch (e) { if (e.statusCode !== 404) throw e; }
      const row = { partitionKey: 'c', rowKey };
      for (const [k, v] of entries) row[k] = (current ? Number(current[k]) || 0 : 0) + v;
      if (current) await table.updateEntity(row, 'Merge', { etag: current.etag });
      else await table.createEntity(row);
      return;
    } catch (e) {
      if (e.statusCode === 409 || e.statusCode === 412) { await sleep(5 + Math.random() * 35); continue; }
      throw e;
    }
  }
  throw new Error('counter contention');
}

const totalsCache = { at: 0, value: null, pending: null };

function emptyTotals() {
  return { candle: 0, f: 0, koden: 0, visit: 0, tribute: 0, flowers: Array(FLOWER_KINDS).fill(0) };
}

async function readTotals() {
  await ensureTables();
  const t = emptyTotals();
  const iter = client('counters').listEntities({ queryOptions: { filter: odata`PartitionKey eq ${'c'}` } });
  for await (const e of iter) {
    for (const k of ['candle', 'f', 'koden', 'visit', 'tribute']) t[k] += Number(e[k]) || 0;
    for (let i = 0; i < FLOWER_KINDS; i++) t.flowers[i] += Number(e[`fl${i}`]) || 0;
  }
  return t;
}

async function getTotals() {
  if (totalsCache.value && Date.now() - totalsCache.at < CACHE_MS) return totalsCache.value;
  if (!totalsCache.pending) {
    totalsCache.pending = readTotals()
      .then((v) => { totalsCache.value = v; totalsCache.at = Date.now(); return v; })
      .catch((e) => { if (totalsCache.value) return totalsCache.value; throw e; })
      .finally(() => { totalsCache.pending = null; });
  }
  return totalsCache.pending;
}

const tributeCache = { at: 0, value: null, pending: null };

async function readTributes(limit) {
  await ensureTables();
  const out = [];
  const pages = client('tributes')
    .listEntities({ queryOptions: { filter: odata`PartitionKey eq ${'t'}`, select: ['name', 'msg', 'ts'] } })
    .byPage({ maxPageSize: limit });
  for await (const page of pages) {
    for (const e of page) out.push({ id: e.rowKey, n: e.name || '', m: e.msg || '', t: Number(e.ts) || 0 });
    break;
  }
  return out;
}

async function listTributes(limit = 50) {
  if (tributeCache.value && Date.now() - tributeCache.at < CACHE_MS) return tributeCache.value;
  if (!tributeCache.pending) {
    tributeCache.pending = readTributes(limit)
      .then((v) => { tributeCache.value = v; tributeCache.at = Date.now(); return v; })
      .catch((e) => { if (tributeCache.value) return tributeCache.value; throw e; })
      .finally(() => { tributeCache.pending = null; });
  }
  return tributeCache.pending;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
const ID_RE = /^\d{13}-[0-9a-f]{6}$/;

async function addTribute(name, msg) {
  await ensureTables();
  const now = Date.now();
  const id = `${String(9999999999999 - now).padStart(13, '0')}-${crypto.randomBytes(3).toString('hex')}`;
  const token = crypto.randomBytes(16).toString('base64url');
  await client('tributes').createEntity({
    partitionKey: 't', rowKey: id, name, msg, ts: now, tokenHash: sha256(token).toString('hex')
  });
  tributeCache.at = 0;
  await addCounts({ tribute: 1 });
  return { id, token, t: now };
}

async function deleteTribute(id, token) {
  if (!ID_RE.test(id) || typeof token !== 'string' || token.length > 64) return false;
  const table = client('tributes');
  let entity;
  try { entity = await table.getEntity('t', id); } catch (e) { if (e.statusCode === 404) return false; throw e; }
  const expected = Buffer.from(String(entity.tokenHash || ''), 'hex');
  const actual = sha256(token);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;
  await table.deleteEntity('t', id);
  tributeCache.at = 0;
  return true;
}

module.exports = { FIELDS, FLOWER_KINDS, addCounts, getTotals, listTributes, addTribute, deleteTribute };
