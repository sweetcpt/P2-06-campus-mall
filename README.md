# P2-06 校园商城 A/B 实验 · 湛科生活站

一个可直接放到 GitHub Pages 的课程项目。研究问题：**免运费门槛提示（无提示 vs 进度条提示）是否会刺激用户凑单，提高最终购物车金额？**

## 已完成的功能

- 手机端校园商城界面，10 个湛江校园生活商品
- 统一实验情境：初始购物车固定为 `USB 静音小风扇 ¥39.9`
- A/B 50:50 随机分流；同一设备在正式实验中保持同一版本
- A 版：无免邮门槛提示
- B 版：`再买 ¥X 免运费` 动态进度条 + 低价凑单推荐
- 免邮门槛 `¥53`，未达门槛配送费 `¥6`
- 模拟购物车：加购、减购、删除、商品金额、配送费、模拟结算
- 埋点：开始、首次打开购物车、初始金额、最终金额、凑单金额、是否免邮、是否完成
- 行为字段：初始/最终商品件数、是否发生继续加购、是否点击模拟结算
- `admin.html` 实验后台：A/B 样本、平均金额、提升率、凑单率、免邮率、原始记录、CSV 导出、报告摘要
- 参考成品式完整链路：平台首页、P2 项目页、实验工作台、参与登记、商城、汇总看板、Worker 配置页
- 参与登记字段：学号、姓名、班级；不收集手机号、地址、支付信息
- 汇总页支持真实记录、参与明细、CSV 导出和 JSON 记录导入，不生成随机演示样本
- A/B 预览模式，不污染正式数据：`?preview=A` / `?preview=B`
- 默认纯静态、本机即可跑
- 可选 Cloudflare Worker + D1 后端，用于全班不同手机自动汇总

## 页面

- `index.html`：平台首页与项目总览
- `project2.html`：P2 项目页
- `experiment.html?id=P2-06`：实验工作台、方案预览、实时汇总和参与链接
- `share.html?e=P2-06`：正式参与登记入口
- `shop.html?e=P2-06`：真实校园商城参与端
- `aggregate.html`：汇总看板、参与明细、CSV 导出
- `setup.html`：Cloudflare Worker 地址和后台口令配置
- `admin.html`：兼容后台入口

## 本机预览

可以直接双击 `index.html`，也可以在目录中运行：

```bash
python3 -m http.server 8000
```

然后访问：

- `http://localhost:8000/index.html`
- `http://localhost:8000/experiment.html?id=P2-06`
- `http://localhost:8000/share.html?e=P2-06`
- `http://localhost:8000/shop.html?e=P2-06`
- `http://localhost:8000/aggregate.html`

也可以直接双击 `index.html` 查看静态页面；需要完整跳转和 Worker 回退测试时，使用静态服务器更稳妥。

## GitHub Pages

前端完全静态，可以直接托管。最简单方式：

1. 新建 GitHub 仓库。
2. 把本目录内容上传到仓库根目录。
3. 仓库 `Settings → Pages`。
4. `Build and deployment` 选择 `Deploy from a branch`。
5. Branch 选 `main`，Folder 选 `/(root)`，保存。
6. 等 GitHub 给出 `https://用户名.github.io/仓库名/`。

**只做课堂演示时，到这里就可以。** 数据会保存在当前浏览器的 `localStorage`。

如果要让几十个同学各自用手机扫码后自动汇总到同一个后台，GitHub Pages 本身没有数据库，需要部署 `worker/` 中附带的 Cloudflare Worker + D1。见 `DEPLOY.md`。

打开 `setup.html` 可以填写 Worker 地址、保存后台口令并测试 `/api/health`。如果 D1 已经使用第一版结构，需要额外执行 `worker/migrations/0003_add_profile_fields.sql`。

## 实验设计

### 自变量

免运费门槛提示方式：

- **A 对照组**：不显示免邮门槛、进度或凑单推荐。
- **B 实验组**：显示距离 ¥53 免邮还差多少、进度条与低价凑单推荐。

### 主指标

`最终购物车商品金额`，不包含配送费。

### 辅助指标

- 继续凑单率
- 达到免邮门槛率
- 模拟结算完成率
- 平均凑单金额

### 控制变量

两组的商品、价格、初始商品、配送规则、页面结构、结算按钮、商品排序完全一致。只有 B 组多出免邮进度提示和与该提示配套的凑单推荐。

## 预览与正式实验

`?preview=A` 和 `?preview=B` 仅用于老师/本人验收，不会保存正式实验记录。

正式参与请使用 `share.html?e=P2-06`，不要带 `preview` 参数；也可以先打开主页，再从项目页进入参与登记。

## 隐私

参考成品式参与流程会登记学号、姓名、班级，并继续使用匿名 `participant_id` 做行为去重；系统不采集手机号、地址或支付信息，结算为模拟操作。

## 自检

在项目目录运行：

```bash
node tests/smoke.mjs
```

该检查会验证入口资源、关键 DOM 引用、免邮参数、统计计算、参与者行为字段、D1 字段和 Worker 的迟到状态保护。
