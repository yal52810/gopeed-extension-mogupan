// 模拟 GoPeed 运行时, 验证扩展 onResolve 各分支
const fs = require('fs');
const path = require('path');

const settings = {
  server: 'https://pan.f11.yoga'
};

let handlers = [];
const gopeed = {
  settings,
  events: {
    onResolve(fn) { handlers.push(fn); }
  }
};

let fetchCalls = [];
var fetch = async function (url, opts) {
  fetchCalls.push({ url, opts });
  if (opts.method === 'HEAD') {
    return {
      headers: {
        get: (k) => k === 'Content-Disposition'
          ? "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95%E6%96%87%E4%BB%B6.rar"
          : (k === 'Content-Length' ? '139460608' : null)
      }
    };
  }
  throw new Error('unexpected non-HEAD fetch: ' + opts.method + ' ' + url);
};

global.fetch = fetch;
global.gopeed = gopeed;
class MessageError extends Error {}
global.MessageError = MessageError;

const code = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
eval(code);

function assert(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  // ── 测试1: 直链模式 ──
  const ctx1 = { req: { url: 'https://vipxz3.cainiu.xyz/dl.php?YWJjZGVm' }, res: null };
  await handlers[0](ctx1);
  const h = ctx1.res.files[0].req.extra.header;
  assert(h.Referer === 'https://moguwp.com/' && !!h['User-Agent'], '直链模式 header 缺失');
  assert(ctx1.res.files[0].name === '测试文件.rar', '文件名解析失败: ' + ctx1.res.files[0].name);
  assert(ctx1.res.files[0].size === 139460608, '大小解析失败');
  assert(fetchCalls[0].opts.method === 'HEAD' && fetchCalls[0].opts.headers.Referer === 'https://moguwp.com/', 'HEAD 未携带 Referer');
  console.log('[直链] PASS');

  // ── 测试2: 中转链接透传 ──
  fetchCalls = [];
  const ctx2 = { req: { url: 'https://dl.f11.yoga/api/download/abc123token' }, res: null };
  await handlers[0](ctx2);
  assert(ctx2.res.files[0].req.url === 'https://dl.f11.yoga/api/download/abc123token', '中转 URL 被修改');
  assert(ctx2.res.files[0].req.extra && Object.keys(ctx2.res.files[0].req.extra).length === 0, '中转链接不应附加请求头');
  assert(ctx2.res.files[0].name === '测试文件.rar', '中转文件名解析失败');
  assert(fetchCalls[0].opts.headers['User-Agent'] && !fetchCalls[0].opts.headers.Referer, '中转 HEAD 不应携带 Referer');
  console.log('[中转] PASS');

  // ── 测试3: 本机域名非下载路径 no-op ──
  fetchCalls = [];
  const ctx3 = { req: { url: 'https://pan.f11.yoga/user.html' }, res: null };
  await handlers[0](ctx3);
  assert(ctx3.res === null, '非下载路径不应处理');
  assert(fetchCalls.length === 0, 'no-op 不应发起请求');
  console.log('[非下载路径 no-op] PASS');

  // ── 测试4: 分享链接引导到解析页 ──
  const ctx4 = { req: { url: 'https://www.moguwp.com/file/5RJTM' }, res: null };
  let err = null;
  try { await handlers[0](ctx4); } catch (e) { err = e; }
  assert(err && err instanceof MessageError, '分享链接应抛 MessageError');
  assert(err.message.indexOf('pan.f11.yoga/jisupan.html') !== -1, '错误信息应包含解析页地址: ' + err.message);
  console.log('[分享链接引导] PASS');

  // ── 测试5: 其他链接 no-op ──
  fetchCalls = [];
  const ctx5 = { req: { url: 'https://example.com/a.zip' }, res: null };
  await handlers[0](ctx5);
  assert(ctx5.res === null && fetchCalls.length === 0, '其他链接不应处理');
  console.log('[其他链接 no-op] PASS');

  // ── 测试6: 字符串审计 (无卡号/令牌/解析设置/旧品牌字样) ──
  const manifest = fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8');
  const banned = ['卡号', 'token', 'parse_api', '蘑菇', 'card'];
  for (const w of banned) {
    assert(code.indexOf(w) === -1, 'index.js 不应包含 ' + w);
    assert(manifest.indexOf(w) === -1, 'manifest.json 不应包含 ' + w);
  }
  console.log('[字符串审计] PASS');

  console.log('ALL TESTS PASSED');
})().catch(e => { console.error('TEST FAILED:', e.message); process.exit(1); });
