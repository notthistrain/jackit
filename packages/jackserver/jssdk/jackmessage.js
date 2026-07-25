/*!
 * jackmessage —— jackserver 网站留言提交 SDK（纯 JS，零依赖）
 *
 * 【用途】在多个站点嵌入，收集用户留言反馈到 jackserver，按 site 隔离。
 *         留言入库后由管理员通过 admin token 调用 /api/messages/admin/consume 消费。
 *
 * 【签名契约】sig = HMAC-SHA256(trackSecret, `${site}|${path_or_empty}|${ts}`) 的 hex，
 *   必须与服务端 packages/jackserver/src/middleware/track.rs::verify_sig 完全一致
 *   （分隔符 `|`、字段顺序 site→path→ts、ts 为秒级时间戳、hex 输出）。
 *   与 jackmetrics 共用同一份 trackSecret，path 缺失时按空串参与签名。
 *
 * 【实现】内联纯 JS 的 SHA-256 + HMAC-SHA256（标准 FIPS 180-4 / RFC 2104），
 *   不依赖 Web Crypto（crypto.subtle），因此 http:// + 纯 IP 等非安全上下文也可用。
 *   HMAC 实现与 jackmetrics.js 完全一致，便于两个 SDK 各自独立引入。
 *
 * 【安全说明】trackSecret 嵌入客户端、可被逆向抠出，签名仅用于提高伪造门槛，
 *   不保证密码学级防伪；真正兜底是服务端限流（rate_limit）。
 */
(function (root) {
  'use strict';

  var options = null;

  /**
   * 初始化 SDK。
   * @param {Object} opts
   * @param {string} opts.endpoint      留言提交端点，如 http://114.124.36.46:7001/api/messages/submit
   * @param {string} opts.site          站点标识（须在服务端 allowed_origins 白名单内）
   * @param {string} opts.trackSecret   签名密钥（与服务端 metrics.track_secret 一致，与 jackmetrics 共用）
   */
  function init(opts) {
    options = opts || null;
  }

  /**
   * 提交一条留言。失败静默，不影响站点正常使用。
   * @param {Object}   data
   * @param {string}   data.nickname 留言者昵称（≤64 字符）
   * @param {string}   data.content  留言内容（≤4096 字符）
   * @param {string}   [data.path]   留言所在页面路径，默认取 location.pathname
   * @returns {Promise<{ok: boolean, id?: number, error?: string}>}
   *          成功返回 {ok:true, id:<messageId>}；失败返回 {ok:false, error:<msg>}
   */
  async function submit(data) {
    if (!options || typeof window === 'undefined') {
      return { ok: false, error: 'sdk not initialized or no window' };
    }
    if (!data || !data.nickname || !data.content) {
      return { ok: false, error: 'missing nickname or content' };
    }
    var path = data.path || window.location.pathname || '';
    var ts = Math.floor(Date.now() / 1000);
    // 签名拼接与 jackmetrics 完全一致：site|path|ts（path 可为空串）
    var sig = hmacSha256Hex(options.trackSecret, options.site + '|' + path + '|' + ts);
    var payload = {
      site: options.site,
      path: path || undefined,
      nickname: data.nickname,
      content: data.content,
      ts: ts,
      sig: sig,
    };
    try {
      var resp = await fetch(options.endpoint, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        return { ok: false, error: 'http ' + resp.status };
      }
      var json = await resp.json();
      // 服务端返回 { code:0, msg:"ok", data:{ id:<i64> } }
      if (json && json.code === 0 && json.data && typeof json.data.id !== 'undefined') {
        return { ok: true, id: json.data.id };
      }
      return { ok: false, error: (json && json.msg) || 'unknown response' };
    } catch (e) {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[jackmessage] submit failed', e);
      }
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  // ===== 纯 JS SHA-256 + HMAC-SHA256（与 jackmetrics.js 完全一致，零依赖）=====

  function utf8ToBytes(str) {
    return new TextEncoder().encode(str);
  }

  // 32 位右旋转
  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  // SHA-256：输入 Uint8Array，输出 Uint8Array(32)
  function sha256Bytes(msg) {
    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    var l = msg.length;
    var bitLen = l * 8;
    var total = (((l + 1 + 8) + 63) >>> 6) << 6;
    var buf = new Uint8Array(total);
    buf.set(msg);
    buf[l] = 0x80;
    var dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, bitLen >>> 0, false);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);

    var W = new Array(64);
    for (var blk = 0; blk < total; blk += 64) {
      for (var t = 0; t < 16; t++) {
        W[t] = dv.getUint32(blk + t * 4, false);
      }
      for (var t = 16; t < 64; t++) {
        var s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        var s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }

    var out = new Uint8Array(32);
    var odv = new DataView(out.buffer);
    for (var i = 0; i < 8; i++) {
      odv.setUint32(i * 4, H[i], false);
    }
    return out;
  }

  function bytesToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  // HMAC-SHA256(secret, msg) → hex。secret / msg 按字符串 UTF-8 编码。
  function hmacSha256Hex(secret, msg) {
    var blockSize = 64;
    var keyBytes = utf8ToBytes(secret);
    if (keyBytes.length > blockSize) {
      keyBytes = sha256Bytes(keyBytes);
    }
    var paddedKey = new Uint8Array(blockSize);
    paddedKey.set(keyBytes);
    var ipad = new Uint8Array(blockSize);
    var opad = new Uint8Array(blockSize);
    for (var i = 0; i < blockSize; i++) {
      ipad[i] = paddedKey[i] ^ 0x36;
      opad[i] = paddedKey[i] ^ 0x5c;
    }
    var msgBytes = utf8ToBytes(msg);
    var inner = new Uint8Array(blockSize + msgBytes.length);
    inner.set(ipad, 0);
    inner.set(msgBytes, blockSize);
    var innerHash = sha256Bytes(inner);
    var outer = new Uint8Array(blockSize + innerHash.length);
    outer.set(opad, 0);
    outer.set(innerHash, blockSize);
    return bytesToHex(sha256Bytes(outer));
  }

  var JackMessage = { init: init, submit: submit };

  // 挂全局（浏览器 <script> 引入）
  root.JackMessage = JackMessage;

  // CommonJS（Node 等环境，便于测试）
  if (typeof module !== 'undefined' && module.exports) {
    JackMessage._hmacSha256Hex = hmacSha256Hex;
    module.exports = JackMessage;
  }
})(typeof window !== 'undefined' ? window : this);
