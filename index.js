(function () {
  var DEFAULT_REFERER = 'https://moguwp.com/';
  var DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  function setting(name, fallback) {
    try {
      var v = gopeed.settings[name];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        return String(v).trim();
      }
    } catch (e) {}
    return fallback;
  }

  function isCainiu(url) {
    return url.indexOf('cainiu.xyz') !== -1;
  }

  function parseFilename(cd) {
    if (!cd) return '';
    // RFC 5987: filename*=UTF-8''xxx
    var star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(cd);
    if (star) {
      try {
        return decodeURIComponent(star[1].trim());
      } catch (e) {
        return star[1].trim();
      }
    }
    // filename="xxx"
    var quoted = /filename\s*=\s*"([^"]+)"/i.exec(cd);
    if (quoted) return quoted[1];
    // filename=xxx
    var bare = /filename\s*=\s*([^;]+)/i.exec(cd);
    if (bare) return bare[1].trim();
    return '';
  }

  // 直链模式: 先 HEAD 拿真实文件名和大小 (dl.php 支持 HEAD + Referer)
  function headInfo(url, headers) {
    return fetch(url, { method: 'HEAD', headers: headers, redirect: 'follow' }).then(function (resp) {
      var name = '';
      var size = 0;
      try { name = parseFilename(resp.headers.get('Content-Disposition') || ''); } catch (e) {}
      try {
        var cl = resp.headers.get('Content-Length');
        if (cl) {
          var s = parseInt(cl, 10);
          if (s > 0) size = s;
        }
      } catch (e) {}
      return { name: name, size: size };
    }).catch(function () {
      return { name: '', size: 0 };
    });
  }

  gopeed.events.onResolve(async function (ctx) {
    var url = ctx.req.url;
    var referer = setting('referer', DEFAULT_REFERER);
    var ua = setting('ua', DEFAULT_UA);
    var header = { 'Referer': referer, 'User-Agent': ua };

    // ── 直链模式: vipxz*.cainiu.xyz/dl.php?xxx ──
    if (isCainiu(url)) {
      var info = await headInfo(url, header);
      var directName = info.name || ('mogupan-' + Date.now());
      ctx.res = {
        name: directName,
        files: [{
          name: directName,
          size: info.size,
          req: { url: url, extra: { header: header } }
        }]
      };
      return;
    }

    // ── 分享链接模式: moguwp.com / mogupan.net 的 /file/ 链接 ──
    if (url.indexOf('moguwp.com') !== -1 || url.indexOf('mogupan.net') !== -1) {
      var api = setting('parse_api', '');
      var card = setting('card', '');
      if (!api) throw new MessageError('未配置解析 API 地址，请在扩展设置中填写');
      if (!card) throw new MessageError('未配置卡号，请在扩展设置中填写');

      var resp;
      try {
        resp = await fetch(api.replace(/\/+$/, '') + '/api/user/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: card, url: url })
        });
      } catch (e) {
        throw new MessageError('解析服务不可达: ' + api);
      }

      var data;
      try {
        data = await resp.json();
      } catch (e) {
        throw new MessageError('解析服务响应异常');
      }
      if (!data || !data.success || !data.download_url) {
        throw new MessageError('解析失败: ' + (data && data.error ? data.error : '未知错误'));
      }

      var dl = data.download_url;
      // 服务器返回的中转链接可能是相对路径
      if (dl.charAt(0) === '/') {
        dl = api.replace(/\/+$/, '') + dl;
      }
      var shareName = data.filename || ('mogupan-' + Date.now());
      var file = {
        name: shareName,
        size: data.fileSize || 0,
        req: { url: dl, extra: {} }
      };
      // 原始 CDN 直链需要附加防盗链头; 中转链接由服务器代发, 不需要
      if (isCainiu(dl)) {
        file.req.extra.header = header;
      }
      ctx.res = { name: shareName, files: [file] };
      return;
    }
  });
})();
