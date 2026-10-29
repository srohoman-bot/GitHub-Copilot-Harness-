'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { clean, isRejected } = require('../src/lib/text');
const { Bucket } = require('../src/lib/guard');

test('clean strips control and bidi characters and trims length', () => {
  assert.equal(clean('a\u202Eb\u0000c\n d', 10), 'a b c d');
  assert.equal(clean('x'.repeat(200), 5), 'xxxxx');
  assert.equal(clean(42, 5), '');
});

test('moderation rejects URLs, contact info and NG words', () => {
  for (const s of ['see https://evil.example', 'visit www.x.y', 'foo.com', 'a@b.co', '090-1234-5678', 'F u c k', 'しね', 'ｓｈｉｔ', 'aaaaaaaaaaaaaa']) {
    assert.equal(isRejected(s), true, s);
  }
});

test('moderation accepts normal tributes', () => {
  for (const s of ['ありがとう、GitHub Copilot Harness。', 'Rest in peace, old name.', '<<<<<<< 旧名 ======= 新名 >>>>>>>', '4,000 行書き換わりました']) {
    assert.equal(isRejected(s), false, s);
  }
});

test('bucket grants at most the available tokens', () => {
  const b = new Bucket(5, 0);
  assert.equal(b.take('k', 3), 3);
  assert.equal(b.take('k', 10), 2);
  assert.equal(b.take('k', 1), 0);
});
