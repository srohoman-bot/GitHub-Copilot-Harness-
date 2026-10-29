'use strict';

const crypto = require('node:crypto');

const SALT = crypto.randomBytes(16);
const MAX_KEYS = 50000;

function clientKey(request) {
  const raw = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  let ip = raw;
  if (raw.startsWith('[')) ip = raw.slice(1, raw.indexOf(']'));
  else if (raw.includes('.') && raw.includes(':')) ip = raw.slice(0, raw.lastIndexOf(':'));
  return crypto.createHash('sha256').update(SALT).update(ip || 'unknown').digest('base64url').slice(0, 16);
}

// Token bucket per key. Per-instance and best effort; protects the table, not a security boundary.
class Bucket {
  constructor(capacity, refillPerSec) {
    this.capacity = capacity;
    this.refill = refillPerSec;
    this.map = new Map();
  }

  take(key, want = 1) {
    const now = Date.now();
    let b = this.map.get(key);
    if (!b) {
      if (this.map.size >= MAX_KEYS) this.map.clear();
      b = { tokens: this.capacity, at: now };
      this.map.set(key, b);
    }
    b.tokens = Math.min(this.capacity, b.tokens + ((now - b.at) / 1000) * this.refill);
    b.at = now;
    const granted = Math.min(want, Math.floor(b.tokens));
    b.tokens -= granted;
    return granted;
  }
}

function originAllowed(request) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('origin');
  return !!origin && allowed.includes(origin);
}

module.exports = { clientKey, Bucket, originAllowed };
