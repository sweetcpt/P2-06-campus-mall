# P2-06 参考成品式平台改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 P2-06 商城改成参考成品式的完整实验平台切片，同时保留真实购物行为和不伪造统计结果的约束。

**Architecture:** 以现有 `shared.js` 作为 P2-06 行为数据层，新增平台工作台页面和参与登记/汇总页面；商城逻辑从根首页移到 `shop.html`，首页只负责平台导航。Worker/D1 增加登记资料字段，所有页面仍使用相对路径和无依赖静态资源。

**Tech Stack:** 原生 HTML/CSS/JavaScript、localStorage、现有 Cloudflare Worker + D1、Node smoke tests、Playwright 浏览器回归。

## Global Constraints

- P2-06 唯一核心变量是“是否显示免运费门槛提示与进度反馈”。
- 初始商品 `USB 小风扇 ¥39.90`、配送费 `¥6.00`、免邮门槛 `¥53.00` 不变。
- 不生成随机实验样本、不伪造真实结果；样本不足只做描述性统计。
- 正式参与者版本稳定；预览 A/B 不写正式数据；记录按 `participantId + studyKey` 去重。
- GitHub Pages 子路径必须可用；API 失败时页面不崩溃并回退本机记录。
- 所有路径和新增资源保持在 `E:\codex\p2-06-campus-mall` 内。

---

### Task 1: 先建立平台页面和数据模型回归测试

**Files:**
- Modify: `E:\codex\p2-06-campus-mall\tests\smoke.mjs`
- Create: `E:\codex\p2-06-campus-mall\docs\superpowers\specs\2026-09-22-p2-06-reference-platform-design.md`

**Interfaces:**
- Tests consume the HTML files and exported browser scripts as plain text/data URLs.
- Tests produce regression assertions for page links, registration fields, profile propagation, and no-simulation empty states.

- [x] **Step 1: Write failing assertions**

Add assertions requiring `index.html`, `project2.html`, `experiment.html`, `share.html`, `shop.html`, `aggregate.html`, and `setup.html`; require `share.html` identity fields and `experiment.html` five numbered modules; require no `simulateDataUpdate` or hard-coded random sample generator in platform pages.

- [x] **Step 2: Run the test to verify the new assertions fail**

Run from `E:\codex\p2-06-campus-mall`:

```powershell
node tests/smoke.mjs
```

Expected: FAIL because the new platform pages do not exist yet.

- [ ] **Step 3: Keep the failing assertions as the implementation gate**

Do not weaken the assertions to match the old two-page structure; later tasks must make the complete reference-style path pass.

- [ ] **Step 4: Run the focused smoke test after each page task**

Expected: each page/resource assertion turns green without changing existing behavior assertions.

---

### Task 2: Move the current storefront to `shop.html` without changing behavior

**Files:**
- Create: `E:\codex\p2-06-campus-mall\shop.html`
- Modify: `E:\codex\p2-06-campus-mall\assets\app.js`
- Modify: `E:\codex\p2-06-campus-mall\assets\shared.js`
- Modify: `E:\codex\p2-06-campus-mall\assets\styles.css`
- Test: `E:\codex\p2-06-campus-mall\tests\smoke.mjs`

**Interfaces:**
- `shop.html` consumes `assets/config.js`, `products.js`, `shared.js`, and `app.js`.
- `shared.js` exposes profile-aware session creation while retaining `createSession`, `pushRecord`, `summarize`, and legacy migration behavior.
- `app.js` reads `P.getProfile()` and copies `studentId`, `name`, and `className` into session snapshots without changing cart math.

- [ ] **Step 1: Add a failing profile propagation test**

Set a test profile in the browser/local-storage fixture and assert a newly created session contains `studentId`, `participantName`, and `className`, while a preview session never reaches `saveLocalRecord`.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
node tests/smoke.mjs
```

Expected: FAIL because profile storage and `shop.html` are absent.

- [ ] **Step 3: Create `shop.html` from the existing participant markup**

Preserve the existing product grid, cart sheet, success sheet, relative asset paths, and `?preview=A/B` support. Change only the title/copy/navigation needed to identify it as the participation store and add a small profile/status strip that does not reveal the assigned variant.

- [ ] **Step 4: Add profile helpers and session propagation**

Implement `getProfile`, `setProfile`, and `clearProfile` in `shared.js`; `createSession` should attach the current profile if one exists. `snapshot` should persist the same profile fields on every record.

- [ ] **Step 5: Run the focused smoke and existing cart tests**

Expected: the new profile test and all existing A/B shipping/cart assertions pass.

---

### Task 3: Build the reference-style home and project navigation

**Files:**
- Replace: `E:\codex\p2-06-campus-mall\index.html`
- Create: `E:\codex\p2-06-campus-mall\project2.html`
- Modify: `E:\codex\p2-06-campus-mall\assets\styles.css`
- Test: `E:\codex\p2-06-campus-mall\tests\smoke.mjs`

**Interfaces:**
- `index.html` links to `project2.html`, `share.html?e=P2-06`, `aggregate.html`, and `setup.html`.
- `project2.html` links to `experiment.html?id=P2-06`, `share.html?e=P2-06`, and `aggregate.html`.

- [ ] **Step 1: Add failing navigation assertions**

Assert the root page has platform headings, P2-06 entry text, and all required relative links; assert `project2.html` contains the P2-06 card and no absolute `/assets/` paths.

- [ ] **Step 2: Run the test and verify failure**

Expected: FAIL because the current root is still the storefront and `project2.html` is absent.

- [ ] **Step 3: Implement the dark platform shell**

Use the reference visual tokens: dark body, deep-gray cards, thin borders, blue A, orange B, green success, numbered section titles, compact metric cards, and mobile breakpoints at 900px and 600px. Keep all user-facing copy specific to湛江科技学院/麻章校区 and P2-06.

- [ ] **Step 4: Run static navigation checks**

Expected: all links resolve under both root and simulated GitHub Pages subpaths.

---

### Task 4: Build `experiment.html?id=P2-06` as the reference-style workbench

**Files:**
- Create: `E:\codex\p2-06-campus-mall\experiment.html`
- Create: `E:\codex\p2-06-campus-mall\assets\workbench.js`
- Modify: `E:\codex\p2-06-campus-mall\assets\styles.css`
- Modify: `E:\codex\p2-06-campus-mall\assets\shared.js`
- Test: `E:\codex\p2-06-campus-mall\tests\smoke.mjs`

**Interfaces:**
- `workbench.js` consumes `P.getLocalRecords`, `P.fetchResults`, and `P.summarize`.
- It renders live empty/data states, A/B cart mockups, share link, collection status, and conclusion text.
- It never creates a record or modifies the experiment result merely by opening/refreshing the workbench.

- [ ] **Step 1: Add failing workbench assertions**

Assert five numbered sections, A/B labels, the `¥39.90 / ¥53.00 / ¥6.00` parameters, real-data empty wording, and no fake random data function.

- [ ] **Step 2: Run and confirm red**

Expected: FAIL because the workbench page and renderer do not exist.

- [ ] **Step 3: Implement workbench markup and renderer**

Create the five modules modeled on the reference site. The A card shows no treatment area; the B card shows a static preview of the progress bar. Metrics come from `P.summarize(rows)` and remain empty when `rows` is empty. The conclusion block explicitly reports “样本量不足，暂不下显著性结论” until the existing sample threshold is met.

- [ ] **Step 4: Add sharing actions**

Create a URL using `location.origin + location.pathname` base path plus `share.html?e=P2-06`; copy it through the existing clipboard fallback. Add a downloadable text/HTML share card only; do not add external QR dependencies.

- [ ] **Step 5: Verify workbench behavior**

Open `experiment.html?id=P2-06`, refresh, and assert local records are unchanged while the metrics and empty-state text render.

---

### Task 5: Build reference-style participant registration and connect it to the real store

**Files:**
- Create: `E:\codex\p2-06-campus-mall\share.html`
- Modify: `E:\codex\p2-06-campus-mall\assets\shared.js`
- Modify: `E:\codex\p2-06-campus-mall\assets\app.js`
- Modify: `E:\codex\p2-06-campus-mall\assets\styles.css`
- Test: `E:\codex\p2-06-campus-mall\tests\smoke.mjs`

**Interfaces:**
- `share.html?e=P2-06` writes a profile `{studentId,name,className}` and then navigates to `shop.html`.
- It accepts `?preview=A`/`?preview=B` for teacher preview without writing formal records.
- `shop.html` uses the profile but never displays the assigned variant to the participant.

- [ ] **Step 1: Add failing registration assertions**

Assert the form has required student ID/name/class fields, rejects missing fields, stores the profile, and navigates to `shop.html?e=P2-06`.

- [ ] **Step 2: Run and confirm red**

Expected: FAIL because `share.html` and profile methods do not exist.

- [ ] **Step 3: Implement registration screen**

Match the reference flow: identity form first, one clear CTA, resume existing unfinished session by student ID, and explicit simulated-transaction notice. Use escaped text when reflecting values.

- [ ] **Step 4: Verify stability and preview isolation**

Test same profile refresh, new profile on the same device, formal assignment stability, and preview mode not adding to formal records.

---

### Task 6: Build aggregate analysis and API setup pages

**Files:**
- Create: `E:\codex\p2-06-campus-mall\aggregate.html`
- Create: `E:\codex\p2-06-campus-mall\assets\aggregate.js`
- Create: `E:\codex\p2-06-campus-mall\setup.html`
- Create: `E:\codex\p2-06-campus-mall\assets\setup.js`
- Modify: `E:\codex\p2-06-campus-mall\assets\styles.css`
- Test: `E:\codex\p2-06-campus-mall\tests\smoke.mjs`

**Interfaces:**
- `aggregate.js` consumes records from localStorage or `P.fetchResults` and uses `P.summarize`; it renders per-participant rows and P2-06 behavior comparisons.
- `setup.js` saves `{apiBase,studyKey,adminToken}` in localStorage, runs GET health check, and never exposes tokens in page text.

- [ ] **Step 1: Add failing aggregate/setup assertions**

Require A/B metric cards, participant detail table, CSV buttons, local/cloud status, API URL field, health check button, and no hard-coded demo records.

- [ ] **Step 2: Run and confirm red**

Expected: FAIL because the pages are absent.

- [ ] **Step 3: Implement aggregation renderer**

Use CSS bars and a conic-gradient donut, matching the reference dashboard without a third-party chart library. CSV must include profile and behavior fields with correct quote escaping.

- [ ] **Step 4: Implement setup flow**

Save config only after explicit click, test `/api/results` or Worker health endpoint, show offline fallback, and provide a link back to the workbench.

- [ ] **Step 5: Verify real empty and one-record states**

Expected: empty state does not fabricate a sample; one locally generated record appears in participant and aggregate tables and CSV.

---

### Task 7: Extend Worker/D1 for registration fields and keep compatibility

**Files:**
- Modify: `E:\codex\p2-06-campus-mall\worker\schema.sql`
- Create: `E:\codex\p2-06-campus-mall\worker\migrations\0003_add_profile_fields.sql`
- Modify: `E:\codex\p2-06-campus-mall\worker\src\index.js`
- Modify: `E:\codex\p2-06-campus-mall\README.md`
- Modify: `E:\codex\p2-06-campus-mall\DEPLOY.md`
- Test: `E:\codex\p2-06-campus-mall\tests\smoke.mjs`

**Interfaces:**
- POST accepts `studentId`, `participantName`, and `className` as optional compatibility fields.
- GET returns them when present and continues deriving legacy fields.
- Existing status rank and monotonic flag protections remain unchanged.

- [ ] **Step 1: Add failing Worker schema/API assertions**

Assert schema/migration columns, POST bindings, GET output, and old payload compatibility.

- [ ] **Step 2: Run and confirm red**

Expected: FAIL because profile fields are absent.

- [ ] **Step 3: Implement migration and Worker mapping**

Use nullable text fields; preserve old records; never require identity fields for legacy API clients.

- [ ] **Step 4: Run schema and fake-DB tests**

Expected: PASS for new and legacy payloads.

---

### Task 8: Backward compatibility, responsive browser verification, package and deploy

**Files:**
- Modify: `E:\codex\p2-06-campus-mall\admin.html`
- Modify: `E:\codex\p2-06-campus-mall\README.md`
- Modify: `E:\codex\p2-06-campus-mall\DEPLOY.md`
- Modify: `E:\codex\HANDOVER.md`

**Interfaces:**
- `admin.html` remains reachable and links to `experiment.html?id=P2-06`, `aggregate.html`, and `share.html?e=P2-06`.
- Deployment publishes every new HTML/JS file and verifies GitHub Pages subpath URLs.

- [ ] **Step 1: Run all local tests**

```powershell
node tests/smoke.mjs
node --check assets/app.js
node --check assets/shared.js
node --check assets/workbench.js
node --check assets/aggregate.js
node --check assets/setup.js
node --check worker/src/index.js
```

Expected: all PASS.

- [ ] **Step 2: Run browser flow**

Verify reference path, registration, A/B stability, cart behavior, aggregate empty/one-record states, CSV download, and no console errors at 375/390/430px.

- [ ] **Step 3: Run subpath test**

Serve `E:\codex` and load `/p2-06-campus-mall/index.html`, `/p2-06-campus-mall/experiment.html?id=P2-06`, and `/p2-06-campus-mall/share.html?e=P2-06`; expected HTTP 200 and relative assets.

- [ ] **Step 4: Rebuild and hash the final ZIP**

Package `E:\codex\p2-06-campus-mall` into `E:\codex\P2-06-campus-mall-final.zip`, extract to a fresh verification directory, and require source/ZIP file sets and SHA-256 hashes to match.

- [ ] **Step 5: Publish**

Push only the new `sweetcpt/P2-06-campus-mall` repository, verify `main` SHA, and re-check the Pages URLs for home, workbench, participant entry, aggregate, and admin.
