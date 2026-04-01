# Claude Code 源码使用手册

这份仓库可以理解为一份基于 `@anthropic-ai/claude-code v2.1.88` 的本地可运行快照。我把重点放在两件事上：

- 让它能尽快在本地编译、启动、验证
- 让后来接手的人能快速判断哪些功能能用，哪些地方只是占位

它依旧是一个基于 **Bun + TypeScript + React (Ink)** 的终端 AI 编程工具，但这个 README 更偏向“如何接手这份仓库并继续折腾”。

## 先说结论

如果你只是想把项目跑起来，按下面三步做就够了：

```bash
bun install
bun run build
bun cli.js
```

如果你已经有可用的 Anthropic Key，启动前先配置环境变量：

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

非交互模式也支持，适合快速测试：

```bash
bun cli.js -p "你好"
```

---

## 复现测试

![image-20260401154712407](README\image-20260401154712407.png)

![image-20260401154607283](README\image-20260401154607283.png)

## 这份仓库是什么

- 来源是 `Claude Code` 的 TypeScript 源码快照
- 当前版本号对应 `2.1.88`
- 运行时和构建工具都是 [Bun](https://bun.sh)
- UI 不是网页，而是基于 React + Ink 的终端界面
- 这不是官方发布仓库，更多适合研究结构、验证想法、做自己的二次改动

如果你的目标是“读源码、改功能、重新打包、验证交互链路”，这份仓库是合适的。

## 环境准备

建议至少满足下面版本：

- [Bun](https://bun.sh) `>= 1.3.11`
- Node.js `>= 18.0.0`

可以先确认一下本机状态：

```bash
node -v
bun -v
```

如果 Bun 还没装：

Mac / Linux:

```bash
curl -fsSL https://bun.sh/install | bash
```

Windows PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

## 最快启动流程

### 1. 安装依赖

```bash
bun install
```

### 2. 构建可执行入口

```bash
bun run build
```

构建完成后，根目录会生成 `cli.js`。

### 3. 启动

```bash
bun cli.js
```

常见命令也一并放在这里，省得来回查：

```bash
bun cli.js --version
bun cli.js --help
bun cli.js --model <model>
```

## 构建方式说明

`package.json` 里的默认构建脚本本质上等价于下面这条命令：

```bash
bun build src/entrypoints/cli.tsx --outfile cli.js --target bun \
  --define 'MACRO.VERSION="2.1.88"' \
  --define 'MACRO.BUILD_TIME="2025-01-01"' \
  --define 'MACRO.FEEDBACK_CHANNEL="https://github.com/anthropics/claude-code/issues"' \
  --define 'MACRO.ISSUES_EXPLAINER="https://github.com/anthropics/claude-code/issues"' \
  --define 'MACRO.NATIVE_PACKAGE_URL="https://npmjs.com"' \
  --define 'MACRO.PACKAGE_URL="https://npmjs.com"' \
  --define 'MACRO.VERSION_CHANGELOG=""'
```

这里的 `MACRO.*` 都是构建时注入的常量，不是运行时动态提供的变量。所以如果你直接拿 `.ts` 入口硬跑，很容易遇到 `MACRO is not defined` 之类的问题。

### 可选 Feature Flag

这个项目里有一部分能力是通过 Bun 的 feature flag 在打包阶段裁剪的。如果你做了额外魔改，比如启用了桌宠 `buddy`，记得在构建时显式打开对应 feature：

```bash
bun build src/entrypoints/cli.tsx --outfile cli.js --target bun --feature BUDDY ...
```

默认的 `bun run build` 并不会自动开启所有 feature。

## 路径别名

`bunfig.toml` 里已经配好了路径别名：

```toml
[build]
alias = { "src" = "./src", "react/compiler-runtime" = "react-compiler-runtime" }
```

这意味着源码里像 `src/...` 这样的导入并不是 npm 包，而是直接解析回仓库本地的 `./src/...`。

## 技术栈速览

| 组件 | 作用 |
|---|---|
| Bun | 构建与运行时 |
| TypeScript | 主开发语言 |
| React + Ink | 终端 UI |
| Zod v4 | 数据校验 |
| `@anthropic-ai/sdk` | Anthropic API 调用 |
| `@modelcontextprotocol/sdk` | MCP 协议接入 |

## 哪些功能是可用的，哪些只是占位

这份仓库里有几个 Anthropic 内部私有包在公开 npm 上并不存在，所以当前是以“存根”方式兜住导入关系。它们不会阻止你研究主流程，但相关能力本身不能正常工作。

| 包名 | 原本用途 | 当前情况 |
|---|---|---|
| `@ant/claude-for-chrome-mcp` | Claude in Chrome 浏览器控制 | 不可用 |
| `@ant/computer-use-mcp` | Computer Use 鼠标键盘控制 | 不可用 |
| `@anthropic-ai/mcpb` | `.dxt` 插件包安装 | 不可用 |
| `@anthropic-ai/sandbox-runtime` | 沙箱文件与网络隔离 | 不可用 |

换句话说：

- 对话主链路可研究
- 命令系统可研究
- 工具调用可研究
- 终端 UI 可研究
- 一部分官方内部集成能力不能按原样复现

## 认证方式

### 1. API Key

最直接，适合本地开发。

```bash
export ANTHROPIC_API_KEY=sk-ant-xxxx
bun cli.js
```

### 2. OAuth

```bash
bun cli.js
```

启动后在界面里走登录流程即可。

### 3. AWS Bedrock

```bash
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_REGION=us-east-1
bun cli.js --model anthropic.claude-3-5-sonnet-20241022-v2:0
```

## 改源码之后怎么验证

仓库里已经带了一份编译产物 `cli.js`，所以只想看看原始效果时可以直接运行，不一定非要先重新构建。

但只要你改了 `src/` 里的逻辑，最好还是按下面流程走一遍：

```bash
# 1. 修改源码

# 2. 重新构建
bun run build

# 3. 启动验证
bun cli.js
```

如果你改的是带 feature flag 的模块，记得用对应的 `bun build ... --feature XXX` 重新打包，而不是只跑默认脚本。

### 当前已知不适合硬改后验证的区域

下面这些位置要么依赖私有包，要么运行条件不完整，改完之后很可能不是你代码有问题，而是仓库天然缺件：

- `src/utils/claudeInChrome/`
- `src/utils/sandbox/`
- `src/skills/bundled/claudeInChrome.ts`
- `src/utils/plugins/mcpbHandler.ts`

相对来说，下面这些区域更适合做本地二开：

- 命令系统
- REPL / 终端界面
- 工具注册和调用链
- 普通业务逻辑与状态管理

## 常见问题

### 启动之后界面像是卡住了

通常不是死掉了，而是 Ink 初始化需要一点时间。等 1 到 2 秒再看，很多时候就会正常进入界面。

### 出现 `MACRO is not defined`

说明你绕过了正常构建流程，直接执行了源码入口。先重新跑一遍：

```bash
bun run build
```

### 遇到 `headers?.get is not a function`

这类问题通常和依赖版本不一致有关。当前仓库按 `zod@^4` 工作，如果本地不一致，可以显式装回去再重新构建：

```bash
bun add zod@^4
bun run build
```

### `organization has been disabled`

这不是仓库本身的问题，而是你当前使用的 API Key 所属组织状态异常。如果你是通过环境变量注入的 Key，可以先清掉再试 OAuth 登录：

```bash
unset ANTHROPIC_API_KEY
```

