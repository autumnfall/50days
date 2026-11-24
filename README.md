# 五十日坚守

回合制生存策略游戏。分配村民、发展经济、训练军队、守住村庄。经典战役的目标是击败第 50 天的 Boss。无尽远征包含随种子变化的事件、战场词条与遗物。完成对局可获得传承点，用来为之后的对局配点。

[在线游玩](https://autumnfall.github.io/50days/)

## 开发

使用 Node.js 20（至少 20.19，见 `.nvmrc`）。

```sh
npm ci
npm run dev
npm run lint
npm test
npx playwright install chromium
npm run test:smoke
npm run build
npm run test:pwa
```

开发服务器默认使用 3000 端口。冒烟测试覆盖桌面和移动视口。PWA 测试在生产构建下模拟 `/50days/` 部署路径，验证离线开局。

对局和传承进度保存在当前浏览器和站点来源中。自动存档在回合结算后更新，也可使用三个手动槽位。存档在清除站点数据或切换域名后不会自动迁移。

## 发布

向 GitHub 的 `main` 推送后，[发布工作流](.github/workflows/deploy.yml) 会先运行检查，再将 `dist/` 发布到 GitHub Pages。Pages 的发布来源应设为 **GitHub Actions**。生产构建会生成版本化的 Service Worker，并缓存离线启动所需的资源。

错误上报默认关闭。自行托管时，可在构建时设置 `VITE_ERROR_REPORT_URL`，并另行部署 `node server/error-logger.mjs`。接收服务默认绑定 `127.0.0.1:4000`，通过 `ALLOWED_ORIGINS` 设置允许的浏览器来源（多个来源以逗号分隔）。GitHub Pages 只托管静态资源。
