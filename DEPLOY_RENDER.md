# Render 部署说明

这个项目已经带了 [render.yaml](/Users/bytedance/Documents/New%20project/render.yaml)，可以直接按 Render 的 Blueprint 或普通 Web Service 方式部署。

## 部署前

1. 把当前项目推到 GitHub。
2. 确认仓库根目录包含：
   - `package.json`
   - `server.js`
   - `render.yaml`

## 方式一：直接用 `render.yaml`

1. 登录 Render。
2. 选择 `New +` -> `Blueprint`。
3. 连接 GitHub 仓库。
4. 选中当前仓库，Render 会读取 `render.yaml`。
5. 确认创建服务。

当前 Blueprint 已配置：

- `runtime`: `node`
- `buildCommand`: `npm install`
- `startCommand`: `npm start`
- `healthCheckPath`: `/api/healthz`
- `plan`: `starter`
- `region`: `singapore`
- `disk.mountPath`: `/var/data`
- `DATA_DIR`: `/var/data/flowmove`

## 方式二：手动创建 Web Service

如果你不想用 Blueprint，可以在 Render Dashboard 手动创建：

1. `New +` -> `Web Service`
2. 连接 GitHub 仓库
3. 配置以下参数：

- Name: `flowmove-booking`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Instance Type: `Starter`
- Region: `Singapore`

4. 在 `Advanced` 里添加 Persistent Disk：

- Mount Path: `/var/data`
- Size: `1 GB`

5. 在环境变量里添加：

- `DATA_DIR=/var/data/flowmove`
- `NODE_VERSION=22.7.0`

## 上线后检查

部署成功后建议检查：

1. 首页是否能正常打开
2. `/api/healthz` 是否返回 `{"ok":true}`
3. 学生是否可以登录并创建预约
4. 老师账号 `tina / FlowMove2026!` 是否能维护排班
5. 重新部署后数据是否仍保留

## 说明

- 当前版本使用 JSON 文件持久化数据，所以必须挂载 Persistent Disk。
- Render 文档说明：Web Service 可使用 `PORT` 环境变量，默认端口是 `10000`；当前服务已兼容该机制。
- Render 文档也说明：只有挂载路径下的文件变更会被持久保存，因此我们把 `DATA_DIR` 指到 `/var/data/flowmove`。
- 本地开发时如果没有设置 `DATA_DIR`，系统会自动使用 `.local-data/store.json`。

## 后续更稳的升级方向

如果正式运营，建议下一步升级为：

1. SQLite
2. Postgres
3. 短信 / 微信提醒
4. 管理后台权限细化
