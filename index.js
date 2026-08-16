(function () {
  var DEFAULT_REFERER = 'https://moguwp.com/';
  var DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  var DEFAULT_SERVER = 'https://pan.f11.yoga';

  var RELAY_HOSTS = [
    { host: 'pan.f11.yoga' },
    { host: 'dl.f11.yoga' },
    { host: 'pan2.f11.yoga' },
    { host: 'dl2.f11.yoga' },
    { host: 'localhost', ports: [3000, 3200, 3500] },
    { host: '127.0.0.1', ports: [3000, 3200, 3500] },
    { host: '8.133.160.188' }
  ];
  var RELAY_PATHS = ['/api/download/', '/dl/', '/r2/', '/stream/'];

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

  function isShareLink(url) {
    return url.indexOf('moguwp.com') !== -1 || url.indexOf('mogupan.net') !== -1;
  }

  // 识别自有服务器的中转下载链接 (正则解析 host:port + path, 兼容 GoPeed JS 运行时)
  function isRelayUrl(url) {
    var m = /^https?:\/\/([^\/]+)(\/[^?#]*)?/i.exec(url);
    if (!m) return false;
    var hostPort = m[1].toLowerCase();
    var path = m[2] || '/';
    var host = hostPort, port = '';
    var c = hostPort.lastIndexOf(':');
    if (c !== -1) {
      host = hostPort.substring(0, c);
      port = hostPort.substring(c + 1);
    }
    for (var i = 0; i < RELAY_HOSTS.length; i++) {
      var h = RELAY_HOSTS[i];
      if (h.host !== host) continue;
      if (h.ports && h.ports.indexOf(parseInt(port, 10)) === -1) continue;
      for (var j = 0; j < RELAY_PATHS.length; j++) {
        if (path.indexOf(RELAY_PATHS[j]) === 0) return true;
      }
      return false;
    }
    return false;
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

  // 先 HEAD 拿真实文件名和大小 (失败降级为空, 不影响下载)
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

    // ── 直链: CDN 原始链接, 附加防盗链头 ──
    if (isCainiu(url)) {
      var header = { 'Referer': DEFAULT_REFERER, 'User-Agent': DEFAULT_UA };
      var info = await headInfo(url, header);
      var directName = info.name || ('jisupan-' + Date.now());
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

    // ── 中转链接: 服务端已注入防盗链头, 客户端透传 ──
    if (isRelayUrl(url)) {
      var rinfo = await headInfo(url, { 'User-Agent': DEFAULT_UA });
      var rname = rinfo.name || 'download';
      ctx.res = {
        name: rname,
        files: [{
          name: rname,
          size: rinfo.size,
          req: { url: url, extra: {} }
        }]
      };
      return;
    }

    // ── 分享链接: 引导到解析页 ──
    if (isShareLink(url)) {
      var server = setting('server', DEFAULT_SERVER).replace(/\/+$/, '');
      throw new MessageError('分享链接请在解析页解析后一键推送下载：' + server + '/jisupan.html');
    }

    // 其他链接: 不处理, 交给 GoPeed 内置解析
  });
})();
