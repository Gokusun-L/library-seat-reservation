# GitHub + PingCode 团队协作手册

> 适用：实验三「五棒接力」开发（图书馆座位预约系统）。
> 一句话分工：**GitHub 管「代码怎么改」，PingCode 管「活儿到哪一步了」**。

## 1. 两个工具到底各管什么

| | GitHub | PingCode |
| --- | --- | --- |
| 本质 | 代码托管 + 版本控制 + 代码评审 | 研发项目管理（需求/任务/迭代/缺陷/工时/度量） |
| 存什么 | 源码、分支、提交历史、PR、Issue、CI 结果 | 用户故事、Task、Sprint、看板状态、Bug、测试用例、文档 |
| 谁看 | 写代码的人 | 全组 + 老师（能一眼看到进度和分工证据） |
| 关键动作 | `git commit` / `push` / `Pull Request` / `Review` | 拖看板、登记工时、提缺陷、切迭代 |

**为什么两个都要**：老师评的是「敏捷过程」，而敏捷过程必须有**可追溯的证据链**——需求（PingCode）→ 任务（PingCode）→ 代码提交与 PR（GitHub）→ 测试与缺陷（PingCode）→ 验收。只有 GitHub，你只能证明「代码写了」；只有 PingCode，你证明不了「代码真的写了」。两者关联起来，一条用户故事点进去能看到它对应的提交、PR、缺陷和工时，这才叫研发链路闭环。

## 2. 一次性准备（组长做，10 分钟）

### 2.1 GitHub

```bash
# 1) 新建仓库（建议 private，课程期间加老师为 collaborator）
#    仓库名：library-seat-reservation
# 2) 本地项目初始化并推送（在 library-seat-system 目录下执行）
git init
git add .
git commit -m "chore: 初始化项目骨架（第一棒后端基础）"
git branch -M main
git remote add origin https://github.com/<你的账号>/library-seat-reservation.git
git push -u origin main
```

然后到 `Settings → Collaborators` 邀请 4 位成员；`Settings → Branches → Add branch protection rule`：
- 保护 `main`：要求 PR 合并、要求至少 1 个 approve、要求 CI 通过（本仓库已带 `.github/workflows/ci.yml`，PR 会自动跑 lint + 单测）。
  > 注意：**私有仓库**的分支保护需要 GitHub Pro/Team 套餐，免费个人账号对私有库不可用。若开不了，就用「`main` 只接受 PR 合并 + 口头约定不直接推 main」，并把这条规则写进团队承诺书。

### 2.2 PingCode

1. 注册（25 人以下团队免费）→ 创建**团队/组织**，邀请 5 人。
2. 新建**项目**，模板选「**Scrum 敏捷开发**」（有迭代、看板、需求、缺陷）。
3. 把实验一/二的成果搬进去（这是最省事的一步，直接决定后面好不好用）：
   - **需求**模块：建 8 条用户故事（US-01a/01b/02/03/04/05/06/07），标题用「作为学生，我想…以便…」，描述里粘验收标准（Given-When-Then），填优先级（P0/P1/P2）和故事点（1/2/3/5/8）。
   - **任务**模块：把 US-02 的 T1–T7、US-04 的 T1–T7 等作为子任务挂到对应需求下，填预估工时（对齐分工表的 6h/8h/3h…）。
   - 每个 Task 的**负责人**填对应棒次的成员——这就是分工证据。
4. 建**迭代（Sprint）**：「实验三 Sprint 1」，周期填 2 周，把 Sprint Backlog 的 6 个故事（19 点）拉进迭代。
5. **看板**视图：列设为 `待办 / 进行中 / 待评审 / 已完成`（与团队 DoD 对齐）。
6. **代码集成**：项目设置里绑定 GitHub 仓库（需要 GitHub 授权），绑定后提交信息里带工作项编号即可自动关联。
7. **Wiki**：放实验报告草稿、接口文档链接、会议记录（站会记录 1 分钟一条，是「过程证据」里最容易被忽略的一块）。

## 3. 每天怎么干（每棒循环）

```bash
# ① 开工前：拉最新主干，从 main 切自己的分支（分支名带工作项编号）
git checkout main && git pull
git checkout -b feature/US-02-reservation   # 一个故事/一个 Task 一条分支

# ② 开发：小步提交，提交信息写清「做了什么 + 关联哪个工作项」
git add backend/src/service/reservationService.js
git commit -m "feat(reservation): 实现创建预约与重复预约校验 #US-02"

# ③ 自测：本地必须全绿才推
npm test && npm run lint
git push -u origin feature/US-02-reservation

# ④ 提 PR（GitHub 网页操作）：标题写 [US-02] 创建预约接口，描述填「改了什么/怎么验证/影响面」
# ⑤ 找 1 名成员 Review（DoD 第 3 条硬要求）→ CI 绿 → Squash merge 到 main
# ⑥ 回 PingCode：把 Task 拖到「已完成」，登记实际工时，写一句结果
```

**提交信息规范**（`type(scope): 描述 #工作项编号`）：

| type | 用途 |
| --- | --- |
| feat | 新功能 |
| fix | 修 Bug |
| refactor | 重构（不改行为） |
| test | 补测试 |
| docs | 文档 |
| chore | 构建/依赖/配置 |

例：`fix(checkin): 修正签到窗口边界判断 #BUG-003`、`docs(api): 补充取消预约接口 #US-05`。

## 4. 五棒接力的具体操作（重点）

1. **交接 = 打 tag + 发 PR + 关任务**
   ```bash
   git checkout main && git pull
   git tag -a v0.1-baton1 -m "第一棒交付：三张表 + 5 个基础接口"
   git push origin v0.1-baton1
   ```
   第二棒从 `v0.1-baton1` 拉分支开发，出问题能精确回到上一棒的稳定点。
2. **接手方先跑通再动代码**：`npm install && npm test`，24 个用例必须全绿，否则先反馈给上一棒，不要在坏的基础上叠加。
3. **接口变更必须走 PR 且 @ 下游**：第二棒要改 `docs/API.md` 里的字段或错误码，PR 描述里 @ 第三棒，避免前端按旧文档写。
4. **PingCode 里建「交接任务」**：`US-02 后端实现（成员1 → 成员2）`，完成后勾掉，形成时间线。
5. **缺陷不要口头传**：发现别人的问题，在 PingCode 提**缺陷**（附复现步骤、期望/实际、截图、关联需求），指派给责任人；修完在提交信息里写 `#BUG-xxx`，缺陷自动关。

## 5. 让老师一眼看到「过程」的三张图

1. **迭代看板**：6 个故事从「待办」移动到「已完成」的流向，配每天的站会记录。
2. **提交-工作项关联**：随便点开一条需求，下面能看到它关联的提交与 PR（这就是 PingCode 绑 GitHub 的价值）。
3. **缺陷闭环**：Bug → 修复提交 → 关闭，一条完整记录。

## 6. 常见坑

| 坑 | 后果 | 规避 |
| --- | --- | --- |
| 直接在 `main` 上开发 | 上一棒的成果被别人覆盖，无法回滚 | 保护 main，只允许 PR 合并 |
| `git push -f` 到共享分支 | 队友的提交消失 | 永远不在 main/共享分支 force push |
| 把 `node_modules`、`data/*.db` 提交了 | 仓库爆炸、二进制冲突 | 本仓库 `.gitignore` 已配好，别删 |
| 提交信息写「update」「修改」 | 无法追溯，报告没法写证据 | 用 `type(scope): 描述 #编号` |
| PingCode 只建需求不拆任务 | 看板看不出分工 | 每个 Task 必须指派到人 + 填工时 |
| 接口文档改在聊天里说 | 前端对接踩空 | 文档进仓库，改文档也走 PR |

## 7. 本仓库已经为你准备好的协作设施

- `.github/workflows/ci.yml`：PR 自动跑 `npm run lint` + `npm test`（失败会挡住合并）
- `.github/pull_request_template.md`：PR 描述模板（改了什么 / 怎么验证 / 影响面 / DoD 自检）
- `.eslintrc.json`：团队代码规范（DoD 第 2 条）
- `backend/docs/API.md`：接口约定，跨棒改动的唯一真源
- `backend/docs/HANDOFF.md`：每棒交接清单模板
