// 模拟 GoPeed 运行时, 验证扩展 onResolve 两种模式
const fs = require('fs');
const path = require('path');

const settings = {
  parse_api: 'http://8.133.160.188:3500',
  card: 'TESTCARD123',
  referer: 'https://moguwp.com/',
  ua: 'Mozilla/5.0 Chrome/124'
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
  if (opts.method === 'POST') {
    return {
      json: async () => ({ success: true, download_url: 'https://vipxz3.cainiu.xyz/dl.php?YWJjZGVm', fileSize: 139460608, filename: '测试文件.rar' })
    };
  }
  throw new Error('unexpected');
};

global.fetch = fetch;
global.gopeed = gopeed;
class MessageError extends Error {}
global.MessageError = MessageError;

const code = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
eval(code);

(async () => {
  // ── 测试1: 直链模式 ──
  const ctx1 = { req: { url: 'https://vipxz3.cainiu.xyz/dl.php?YWJjZGVm' }, res: null };
  await handlers[0](ctx1);
  console.log('[直链] name =', ctx1.res.name);
  console.log('[直链] size =', ctx1.res.files[0].size);
  console.log('[直链] headers =', JSON.stringify(ctx1.res.files[0].req.extra.header));
  const h = ctx1.res.files[0].req.extra.header;
  if (h.Referer !== 'https://moguwp.com/' || !h['User-Agent']) throw new Error('直链模式 header 缺失');
  if (ctx1.res.files[0].name !== '测试文件.rar') throw new Error('文件名解析失败: ' + ctx1.res.files[0].name);
  console.log('[直链] PASS\n');

  // ── 测试2: 分享链接模式 (服务器返回原始 cainiu 直链) ──
  const ctx2 = { req: { url: 'https://www.moguwp.com/file/5RJTM' }, res: null };
  await handlers[0](ctx2);
  console.log('[分享] POST body =', JSON.stringify(JSON.parse(fetchCalls[1].opts.body)));
  console.log('[分享] name =', ctx2.res.name, 'size =', ctx2.res.files[0].size);
  console.log('[分享] headers =', JSON.stringify(ctx2.res.files[0].req.extra.header));
  if (!ctx2.res.files[0].req.extra.header.Referer) throw new Error('分享模式直链未附加 Referer');
  console.log('[分享] PASS\n');

  // ── 测试3: 分享链接模式 (服务器返回中转链接 /api/download/xx) ──
  fetch = async (url, opts) => {
    if (opts.method === 'POST') {
      return { json: async () => ({ success: true, download_url: '/api/download/abc123token', fileSize: 1024, filename: 'proxy.rar' }) };
    }
    throw new Error('unexpected');
  };
  const ctx3 = { req: { url: 'https://www.mogupan.net/file/xyz' }, res: null };
  await handlers[0](ctx3);
  console.log('[中转] url =', ctx3.res.files[0].req.url);
  console.log('[中转] headers =', JSON.stringify(ctx3.res.files[0].req.extra.header));
  if (ctx3.res.files[0].req.url !== 'http://8.133.160.188:3500/api/download/abc123token') throw new Error('相对路径拼接失败');
  if (ctx3.res.files[0].req.extra.header && Object.keys(ctx3.res.files[0].req.extra.header).length > 0) throw new Error('中转链接不应附加防盗链头');
  console.log('[中转] PASS\n');

  // ── 测试4: 解析失败错误提示 ──
  fetch = async () => ({ json: async () => ({ success: false, error: '卡号无效或已用完' }) });
  const ctx4 = { req: { url: 'https://www.moguwp.com/file/xyz' }, res: null };
  let err = null;
  try { await handlers[0](ctx4); } catch (e) { err = e; }
  console.log('[失败] 抛出 =', err && err.message);
  if (!err || err.message.indexOf('卡号无效或已用完') === -1) throw new Error('错误提示不对');
  console.log('[失败] PASS\n');

  console.log('ALL TESTS PASSED');
})().catch(e => { console.error('TEST FAILED:', e.message); process.exit(1); });
