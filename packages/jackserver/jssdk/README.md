# jackmetrics（纯 JS 打点 SDK）

jackserver 网站访问量打点 SDK，**纯 JavaScript、零依赖、无需构建**。直接 `<script>` 引入即可。

HMAC-SHA256 签名使用浏览器原生 [Web Crypto API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Crypto_API)，体积约 3KB。

## 用法

### 1. 引入 SDK

把 `jackmetrics.js` 拷贝到你的站点（或 CDN），页面引入：

```html
<script src="/path/to/jackmetrics.js"></script>
<script>
  JackMetrics.init({
    endpoint: 'https://jack.example.com/api/metrics/track',
    site: 'blog',                         // 须在服务端 allowed_origins 白名单内
    trackSecret: '与服务端 metrics.track_secret 一致',
    // spa: false  // 非 SPA 站点可关闭路由监听
  });
</script>
```

初始化后会自动上报当前页 PV；SPA（vue-router / react-router 等）路由变化也会自动上报。

### 2. 手动上报

```js
JackMetrics.trackPageView('/some/path');
```

## 服务端配套配置

jackserver 的 `config.toml`：

```toml
[metrics]
enabled = true
track_secret = "与 SDK trackSecret 完全一致"
allowed_origins = ["https://你的站点域名"]   # 浏览器 Origin/Referer 白名单 + CORS
rate_limit_per_minute = 60
```

## 签名契约（SDK 与服务端必须一致）

```
sig = HMAC-SHA256(trackSecret, "${site}|${path}|${ts}")  →  hex
```

- 分隔符固定 `|`
- 字段顺序固定：`site` → `path` → `ts`
- `ts` 为秒级 unix 时间戳
- 服务端校验时间戳新鲜度（默认 ±5 分钟）以防重放

对应服务端实现：`packages/jackserver/src/middleware/track.rs::verify_sig`。

## ⚠️ 安全说明（务必阅读）

`trackSecret` 嵌在客户端、**可被逆向抠出**，签名仅用于**提高伪造门槛**，**不保证密码学级防伪**（与所有前端打点方案一致，GA / 百度统计同理）。真正的兜底是服务端限流（`rate_limit_per_minute`）。

建议：

1. 定期轮换 `track_secret`，并同步更新服务端配置。
2. 配置合理的 `rate_limit_per_minute`，限制单 IP 刷量。
3. 报表数据清洗时关注异常突增。

## 运行环境要求

Web Crypto（`crypto.subtle`）仅在**安全上下文**可用：

- `https://` 站点 ✅
- `http://localhost` 本地调试 ✅
- `file://` 直接打开 ❌（需起本地 http 服务调试）
