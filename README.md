# 小有计划 - 电脑版（HTML 静态网站）

纯静态站点，无需服务器、无需安装依赖：直接双击 `index.html` 即可在浏览器中打开。

**在线地址**：https://100plus.top （GitHub Pages，仓库 `TTmini1/xiaoyoujihua-web`）

## 文件结构

```
xiaoyoujihua-web/
├── index.html        # 官网落地页（导航/Hero/功能/场景/流程/同步/评价/FAQ/CTA/页脚）
├── app.html          # 网页版计划工具（实际可用）
├── CNAME             # 自定义域名标识：100plus.top
├── css/style.css     # 共享样式（奶油底 #FBF6EF + 暖橙 #E0764A，与设计稿一致）
├── js/app.js         # 工具逻辑（解析器 + 增删改查 + 排序 + 导入导出 + 存储适配层）
├── test/parser-test.js  # 自然语言解析器单元测试（node test/parser-test.js）
└── README.md
```

## 落地页板块

顶部导航 → Hero 首屏（手机样机 + 网页卡片 + 同步徽章）→ 核心功能两行交错 → 使用场景四宫格 → 三步流程 → 深色多端同步区 → 用户心声（主评价 + 双卡 + 四宫格）→ 数据行（数字滚动）→ 常见问题 FAQ → 结尾行动号召 → 页脚

视觉动效：滚动入场淡入上浮、卡片悬停位移、数字递增、同步徽章呼吸、FAQ 展开动画，并遵循 `prefers-reduced-motion` 降低动效偏好。

## 网页版功能

**基础**
- 顶部输入栏记计划（回车或点「添加」）
- 轻点任务勾选 / 取消完成
- 悬停任务点 × 删除，星标可标记「重点关注」
- 全部 / 未完成 / 已完成 / 重点关注 四档筛选
- 顶部进度卡（完成比例 + 进度条 + 按标签完成统计）

**进阶**
- **自然语言识别**：输入「明天下午三点 和牙医预约 #健康 !高」，自动拆解出标题、截止时间、标签、优先级
  - 日期：今天/今晚/明早/明天/明晚/后天/大后天、周X、下周X、X月X日
  - 时间：上午/中午/下午/晚上 + 阿拉伯数字或中文数字（三点、十点半、3:30、下午 5 点）
  - 标签：`#标签名`（可多个）
  - 优先级：`!高` / `!中` / `!低`
- **输入实时预览**：边打字边显示识别结果，回车前就能看到会被拆成什么
- **标签筛选**：按标签过滤清单，标签从已有任务自动汇总
- **行内编辑**：双击任务文字直接改，回车保存、Esc 取消
- **拖拽排序**：按住左侧圆点上下拖动调整顺序
- **导入 / 导出**：右上角按钮导出 JSON 备份，或导入之前导出的文件

## 部署

- 本地使用：双击 `index.html` 或 `app.html`
- 在线使用：GitHub Pages 已配置，推送到 `main` 分支后约 1 分钟自动生效
- 也可整体上传到 Vercel、对象存储静态网站等任意静态托管

## 关于「手机同步」

数据层已抽象为可替换的存储适配器，见 `js/app.js` 顶部：

```js
var store = API_BASE ? RemoteStore : LocalStore;
```

- `LocalStore`：当前默认实现，数据存浏览器 localStorage（key: `xyjh_tasks`）
- `RemoteStore`：已写好接口约定与实现骨架，只要设置 `API_BASE` 即可切换

**接入后端只需两步**（页面逻辑无需改动）：

1. 在 `js/app.js` 顶部填写 `var API_BASE = 'https://your-api.com';`
2. 后端实现三个接口：
   - `GET {API_BASE}/tasks` → 返回任务数组
   - `PUT {API_BASE}/tasks`（body: `{tasks:[...]}`）→ 整体保存
   - `DELETE {API_BASE}/tasks` → 清空

`RemoteStore` 已内置 Authorization 头（从 localStorage 的 `xyjh_token` 读取）与断网降级到本地的兜底逻辑，恢复联网后由上层补同步。小程序端把 `pages/index/index.js` 的 `loadTasks/saveTasks` 指向同一套接口即可实现双端同步。

## 测试

```bash
node test/parser-test.js
```

覆盖 11 条自然语言用例（含中文数字时间、标签、优先级、周次推算），全部通过。

## 配套产物

- 官网设计稿（Ardot 画布）：https://ardot.tencent.com/file/728606718008945
- 微信小程序版：`xiaoyoujihua-miniprogram/`（见其 README）
