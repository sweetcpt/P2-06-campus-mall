# 部署说明

## 方案一：只做演示 / 答辩

只部署 GitHub Pages 即可，不需要任何服务器。

优点：最快、免费、不会碰到数据库配置。

限制：每台设备的数据只存在自己的浏览器中，不能自动汇总全班。

---

## 方案二：GitHub Pages + Cloudflare Worker + D1（正式收全班数据）

推荐的最终课堂部署方式：

- **GitHub Pages**：托管 `index.html`、`admin.html`、`assets/`
- **Cloudflare Worker**：提供数据 API
- **Cloudflare D1**：保存匿名实验记录

### 1. 安装 Wrangler

需要 Node.js。终端执行：

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 D1 数据库

进入 `worker` 目录：

```bash
cd worker
wrangler d1 create p2-06-ab
```

命令会返回一个 `database_id`。把它复制到 `worker/wrangler.toml`：

```toml
database_id = "你的 database_id"
```

### 3. 建表

```bash
wrangler d1 execute p2-06-ab --remote --file=schema.sql
```

如果你已经按第一版 schema 创建过同名数据库，则先部署前端代码前执行一次增量迁移：

```bash
wrangler d1 execute p2-06-ab --remote --file=migrations/0002_add_behavior_fields.sql
```

新建数据库只执行 `schema.sql`；不要在已经包含这四列的数据库上重复执行增量迁移。

### 4. 设置后台口令

后台口令不要写进 GitHub 仓库：

```bash
wrangler secret put ADMIN_TOKEN
```

输入一个自己记得住、别人猜不到的长口令。

### 5. 限制前端来源（建议）

GitHub Pages 发布后，把 `wrangler.toml` 的：

```toml
ALLOWED_ORIGIN = "*"
```

改成：

```toml
ALLOWED_ORIGIN = "https://你的用户名.github.io"
```

如果你用自定义域名，就填自定义域名来源。

### 6. 部署 Worker

```bash
wrangler deploy
```

会得到类似：

```text
https://p2-06-ab-api.xxxxx.workers.dev
```

### 7. 把 API 地址填回前端

打开：

`assets/config.js`

把：

```js
apiBase: ''
```

改为：

```js
apiBase: 'https://p2-06-ab-api.xxxxx.workers.dev'
```

重新提交到 GitHub。Pages 更新后，全班的正式实验记录就会进入 D1。

参与端写入失败时会保留本机记录并提示“云端暂未同步”，不会让商城页面崩溃；后台读取云端失败时会显示回退到本机演示数据的状态。

### 8. 后台查看数据

打开：

```text
https://你的用户名.github.io/仓库名/admin.html
```

后台第一次读取云端数据会要求输入刚才的 `ADMIN_TOKEN`。口令只保存在当前浏览器的 `sessionStorage`，不会写进仓库。

---

## 正式发给同学前的检查

1. 用 `?preview=A` 看 A 版：购物车中不应出现免邮进度条。
2. 用 `?preview=B` 看 B 版：购物车应显示 `再买 ¥13.10 即可免运费`。
3. B 版加入 `Type-C 数据线 ¥9.9` 后，提示应变成还差 `¥3.20`。
4. 再加任意商品超过 `¥53` 后，应显示 `已达到免运费门槛`，配送费变为免运费。
5. `admin.html` 能读取数据。
6. 正式 URL 不要带 `preview`。
7. 不要在同学群里解释哪一个版本是实验组，以免影响行为。

正式发给同学时使用不带 `preview` 参数的 GitHub Pages 地址，例如：

```text
https://你的用户名.github.io/仓库名/
```

`?preview=A` 和 `?preview=B` 只用于老师验收，不应作为正式实验入口。
