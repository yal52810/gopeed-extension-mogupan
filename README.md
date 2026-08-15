# 蘑菇云直链下载 (GoPeed 扩展)

解决蘑菇云盘 (moguwp.com / mogupan.net) 直链防盗链问题：`vipxz*.cainiu.xyz/dl.php` 只校验 Referer 请求头，
浏览器地址栏直接打开会 302 跳转到首页，但下载器只要带上 `Referer: https://moguwp.com/` 就能直接下载，不经过任何中转服务器。

本扩展支持手机和电脑 (GoPeed 全平台)，两种模式：

1. **直链模式**：把 `https://vipxz*.cainiu.xyz/dl.php?...` 直链粘贴到 GoPeed 新建任务，扩展自动附加 Referer 防盗链头直接下载（先 HEAD 拿真实文件名和大小）。
2. **分享链接模式**：把 `https://www.moguwp.com/file/xxx` 分享链接粘贴到 GoPeed，扩展调用解析 API 换取新鲜直链（或中转链接）后下载。

## 安装

### 手机 / 电脑通用

1. 安装 [GoPeed](https://gopeed.com)（Android / iOS / Windows / macOS 均支持扩展）。
2. 打开 GoPeed → 底部「扩展」标签页 → 右上角 ➕ → 选择「安装」。
3. 输入本仓库地址：

   ```
   https://github.com/yal52810/gopeed-extension-mogupan
   ```

4. 安装后点进扩展，在「设置」里填写：
   - **解析 API 地址**：解析服务地址（例如 `http://8.133.160.188:3500`）
   - **卡号**：解析分享链接用的点卡卡号（只下载直链可留空）
   - **Referer**：默认 `https://moguwp.com/`，一般不用改
   - **User-Agent**：默认 Chrome UA，一般不用改

### 电脑本地安装（开发调试）

1. 打开 GoPeed → 扩展 → 右上角 ➕ → 「安装」→ 选择本地目录（本仓库文件夹）。

## 使用

### 直链模式（不需要卡号）

1. 拿到 `https://vipxz2.cainiu.xyz/dl.php?...` 或 `https://vipxz3.cainiu.xyz/dl.php?...` 直链。
2. GoPeed 首页 → 新建任务 → 粘贴直链 → 确认。
3. 扩展自动带上 Referer，直接走 CDN 下载，速度不受任何中转限制。

### 分享链接模式（需要卡号 + 解析 API）

1. 复制 `https://www.moguwp.com/file/xxxx` 分享链接。
2. GoPeed 新建任务 → 粘贴分享链接 → 确认。
3. 扩展调用解析 API 扣卡解析，返回直链（带防盗链头）或中转链接后自动下载。

## 常见问题

- **提示「解析失败：卡号无效或已用完」**：卡号错误或已用完，请在设置里更换卡号。
- **提示「未配置卡号」**：说明你粘贴的是分享链接（`/file/` 开头），需要先在设置里填卡号。
- **直链提示错误 / 下载下来是网页**：VIP 直链已过期（有时效），用分享链接模式重新解析拿新直链。
- **NDM / IDM 也能直接下载直链**：手动添加请求头 `Referer: https://moguwp.com/` 即可，本扩展只是把这步自动化。

## 说明

- 直链模式**不经过任何中转服务器**，流量直接从 cainiu.xyz CDN 到你设备。
- 扩展本身不内置任何账号、卡号、服务器凭证；解析 API 地址和卡号由你在设置中自行填写。
