# 小有计划 - 电脑版（HTML 静态网站）

纯静态站点，无需服务器、无需安装依赖：直接双击 `index.html` 即可在浏览器中打开。

## 文件结构

```
xiaoyoujihua-web/
├── index.html      # 官网落地页（对应 Ardot 设计稿，含 Hero/功能/同步/评价/页脚）
├── app.html        # 网页版计划工具（实际可用）
├── css/style.css   # 共享样式（奶油底 #FBF6EF + 暖橙 #E0764A，与设计稿一致）
├── js/app.js       # 工具逻辑（增删改查 + 标签筛选 + 进度条 + localStorage 持久化）
└── README.md
```

## 网页版功能

- 顶部输入栏记计划（回车或点「添加」）
- 轻点任务勾选 / 取消完成
- 悬停任务点 × 删除
- 全部 / 未完成 / 已完成 三个标签筛选
- 顶部进度卡（今日完成 x / y + 进度条）
- 数据保存在浏览器 localStorage，刷新/重启不丢失

## 部署

- 本地使用：双击 `index.html` 或 `app.html`
- 在线使用：把整个文件夹上传到任意静态托管（GitHub Pages、Vercel、对象存储静态网站等）即可

## 关于「手机同步」

当前网页版与小程序版均使用本地存储（网页用 localStorage、小程序用 wx.setStorageSync）。要实现真正的多端实时同步，把两边的数据层（网页 `js/app.js` 的 `loadTasks/saveTasks`、小程序 `pages/index/index.js` 的 `loadTasks/saveTasks`）统一替换为同一套云接口（微信云开发 / 自建后端）即可，页面逻辑无需改动。

## 配套产物

- 官网设计稿（Ardot 画布）：https://ardot.tencent.com/file/728606718008945
- 微信小程序版：`xiaoyoujihua-miniprogram/`（见其 README）
