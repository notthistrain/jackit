// 临时验证脚本：对照 Node 内置 crypto 校验 jackmetrics 的纯 JS HMAC-SHA256 实现。
// 运行：node packages/jackserver/jssdk/verify_hmac.js
const crypto = require('crypto');
const { _hmacSha256Hex } = require('./jackmetrics.js');

function ref(secret, msg) {
  return crypto.createHmac('sha256', secret).update(msg, 'utf8').digest('hex');
}

const cases = [
  ['test-track', 'blog|/post|1700000000'],
  ['', ''],
  ['key', 'The quick brown fox jumps over the lazy dog'],
  ['940457524', 'mysite|/|1752000000'],
  ['k', 'a|b|c|d|e'],
  ['secret', '中文路径|/你好/世界|1700000000'],
];

let ok = true;
for (const [s, m] of cases) {
  const mine = _hmacSha256Hex(s, m);
  const std = ref(s, m);
  const pass = mine === std;
  console.log(pass ? 'PASS' : 'FAIL', JSON.stringify(m));
  if (!pass) {
    console.log('  mine    :', mine);
    console.log('  expected:', std);
    ok = false;
  }
}
console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
process.exit(ok ? 0 : 1);
