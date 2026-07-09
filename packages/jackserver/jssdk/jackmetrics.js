/*!
 * jackmetrics —— jackserver 网站访问量打点 SDK（纯 JS，零依赖）
 *
 * 【签名契约】sig = HMAC-SHA256(trackSecret, `${site}|${path}|${ts}`) 的 hex，
 *   必须与服务端 packages/jackserver/src/middleware/track.rs::verify_sz 完全一致
 *   （分隔符 `|`、字段顺序 site→path→ts、ts 为秒级时间戳、hex 输出）。
 *
 * 【安全说明】trackSecret 嵌入客户端、可被逆向抠出，签名仅用于提高伪造门槛，
 *   不保证密码学级防伪；真正兜底是服务端限流（rate_limit_per_minute）。
 *   建议定期轮换 track_secret 并同步更新服务端配置。
 *
 * 【运行环境】Web Crypto API（crypto.subtle）仅在安全上下文可用：
 *   https:// 站点、或 http://localhost 本地调试。file:// 直接打开无效。
 */
(function (root) {
  'use strict';

  var options = null;

  /**
   * 初始化 SDK。初始化后自动上报一次当前页 PV；SPA 路由变化也会自动上报。
   * @param {Object} opts
   * @param {string} opts.endpoint      打点端点，如 https://jack.example.com/api/metrics/track
   * @param {string} opts.site          站点标识（须在服务端 allowed_origins 白名单内）
   * @param {string} opts.trackSecret   签名密钥（与服务端 metrics.track_secret 一致）
   * @param {boolean} [opts.spa=true]   是否监听 SPA 路由变化自动上报
   */
  function init(opts) {
    options = opts || null;
    if (!options) return;
    trackPageView();
    if (options.spa !== false) {
      hookHistory();
    }
  }

  /**
   * 上报一次页面访问。失败静默，不影响站点正常使用。
   * @param {string} [path] 自定义路径，默认取 location.pathname
   * @returns {Promise<void>}
   */
  async function trackPageView(path) {
    if (!options || typeof window === 'undefined') return;
    var p = path || window.location.pathname || '/';
    var ts = Math.floor(Date.now() / 1000);
    var sig = await hmacHex(options.trackSecret, options.site + '|' + p + '|' + ts);
    var payload = {
      site: options.site,
      path: p,
      referer: document.referrer || undefined,
      ts: ts,
      sig: sig,
    };
    try {
      await fetch(options.endpoint, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[jackmetrics] track failed', e);
      }
    }
  }

  // HMAC-SHA256(secret, msg) -> hex，使用浏览器原生 Web Crypto API。
  async function hmacHex(secret, msg) {
    var key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    var buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    var bytes = new Uint8Array(buf);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  // 拦截 history API + popstate，SPA 路由变化时上报新 path。
  function hookHistory() {
    if (typeof window === 'undefined' || !window.history) return;
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () {
      var ret = origPush.apply(this, arguments);
      queueMicrotask(function () {
        trackPageView();
      });
      return ret;
    };
    history.replaceState = function () {
      var ret = origReplace.apply(this, arguments);
      queueMicrotask(function () {
        trackPageView();
      });
      return ret;
    };
    window.addEventListener('popstate', function () {
      trackPageView();
    });
  }

  var JackMetrics = { init: init, trackPageView: trackPageView };

  // 挂全局（浏览器 <script> 引入）
  root.JackMetrics = JackMetrics;

  // CommonJS（Node 等环境，便于测试）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JackMetrics;
  }
})(typeof window !== 'undefined' ? window : this);
