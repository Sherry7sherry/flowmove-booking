# FlowMove

FlowMove 是一个适合移动端使用的普拉提 / 瑜伽上门私教预约系统。

当前版本支持：

- 学生登录并查看未来 3 天老师空档
- 学生提交预约，填写身体情况、改善目标和详细地址
- 老师登录维护自己的未来 3 天排班
- 管理员登录查看全部预约并维护老师排班
- Render 部署与持久化数据保存

## 本地运行

项目使用原生 Node.js 服务端，不依赖额外框架。

```bash
npm start
```

启动后访问：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

本地运行时，数据会自动写入 `.local-data/store.json`，不会污染 Git 仓库。

## 示例账号

- 老师：`tina / FlowMove2026!`
- 管理员：`admin / FlowMoveAdmin2026!`
- 学生：直接输入姓名和手机号登录

## 项目结构

- [index.html](/Users/bytedance/Documents/New%20project/index.html)：页面结构
- [styles.css](/Users/bytedance/Documents/New%20project/styles.css)：界面样式
- [script.js](/Users/bytedance/Documents/New%20project/script.js)：前端交互
- [server.js](/Users/bytedance/Documents/New%20project/server.js)：Node 服务端和 API
- [render.yaml](/Users/bytedance/Documents/New%20project/render.yaml)：Render 部署配置
- [DEPLOY_RENDER.md](/Users/bytedance/Documents/New%20project/DEPLOY_RENDER.md)：Render 部署说明

## 部署

推荐直接部署到 Render，详细步骤见：

- [DEPLOY_RENDER.md](/Users/bytedance/Documents/New%20project/DEPLOY_RENDER.md)

## 后续建议

如果准备正式运营，下一步建议升级为 SQLite 或 Postgres，并接入短信 / 微信提醒。

## 支付网关预留

当前版本已经预留微信支付和支付宝定金支付接入口，但默认不会真的发起扣款。

后续接真实支付时，至少需要配置这些环境变量：

- `WECHAT_PAY_MCHID`
- `WECHAT_PAY_API_V3_KEY`
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`

拿到商户资料后，可以继续把下单、签名和支付回调补上。
