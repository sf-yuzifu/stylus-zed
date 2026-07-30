# Zed 的 Stylus 语言支持

[English](README.md)

基于 [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus)，为 [Zed](https://zed.dev/) 编辑器提供原生 [Stylus](https://stylus-lang.com/) 语言支持。

> 预发布状态：语法解析、编辑器集成与编译器诊断已可用于开发测试。首个公开版本发布前，计划继续加入补全、hover 与导航等语言智能能力。

## 功能

- 原生 Tree-sitter grammar，同时支持缩进式和大括号式 Stylus
- 为选择器、声明、变量、mixin、函数、控制流、插值、hash、at-rule 和运算符提供语法高亮
- 为嵌套规则、mixin、条件、循环、at-rule、keyframes、匿名函数和 block call 提供自动缩进
- 括号匹配，以及能识别上下文的括号和引号自动闭合
- 为选择器、mixin、变量、keyframes 和 at-rule 提供文档大纲
- 为规则、mixin、block call、匿名函数、at-rule、keyframes 和注释提供 Vim text objects
- 基于官方 Stylus 编译器的错误诊断，输入时实时显示在编辑器和 Problems 面板中
- 上下文感知的补全：CSS 属性与值、Stylus 内建函数、at-rule、伪类与伪元素、HTML 标签，以及当前文件中定义的变量、mixin 和函数
- Hover 文档：变量、mixin、函数、Stylus 内建函数，以及附带 MDN 链接的 CSS 属性文档
- 颜色色板：字面量颜色与值为颜色的变量，取色器支持 hex/RGB/HSL 互转
- 签名帮助：用户 mixin 与 Stylus 内建函数，实时高亮当前参数
- 跳转定义与查找引用：变量、mixin、函数，作用域感知，理解遮蔽、参数与循环变量
- 跨文件符号：`@import` 文件中的变量和 mixin 可补全、hover，并跳转到来源文件，自动跟随导入链
- 工作区范围的查找引用与重命名：覆盖所有（传递）导入该声明的文件，基于反向导入图驱动
- 重命名重构：保留每个使用处的 `$` 书写习惯
- 文档符号：文件内变量与 mixin，与 Tree-sitter 选择器大纲并存
- 文档格式化：由 [stylus-supremacy](https://github.com/ThisIsManta/stylus-supremacy)（社区标准 Stylus 格式化器）驱动，针对其已知不安全场景设有护栏；另提供永远安全的 whitespace 引擎
- `.styl` 文件识别、注释切换、两空格缩进和 Stylus 单词字符配置

grammar 是专门为 Stylus 实现的，不使用 CSS grammar 作为替代。因此，缩进式 Stylus 和 Stylus 特有语法都由原生 parser 解析。

## 功能矩阵

以 [sinejoe/zed-stylus-extension](https://github.com/sinejoe/zed-stylus-extension) 发布的功能表格为对照（截至 2026 年 7 月），本扩展已覆盖全部 11 项：

| 功能 | 本扩展 | sinejoe/zed-stylus-extension |
| --- | --- | --- |
| 语法高亮 | ✅ 原生 `tree-sitter-stylus` grammar，同时支持缩进式和大括号式 | ⚠️ 部分支持（以 CSS grammar 代替） |
| 诊断 / lint | ✅ 官方 Stylus 编译器错误，实时显示在编辑器和 Problems 面板 | ⚠️ 未测试 |
| 补全 | ✅ CSS 属性/值、Stylus 内建函数、at-rule、伪选择器、标签，以及文件内变量/mixin/函数 | ⚠️ 未测试 |
| Hover 文档 | ✅ 变量、mixin、函数、Stylus 内建函数和 CSS 属性 | ⚠️ 未测试 |
| 签名帮助 | ✅ 用户 mixin 与 Stylus 内建函数，带当前参数跟踪 | ⚠️ 未测试 |
| 跳转到定义 | ✅ 作用域感知，理解遮蔽与参数 | ⚠️ 未测试 |
| 查找引用 | ✅ 作用域感知，含重命名重构 | ⚠️ 未测试 |
| 文档符号 | ✅ 通过 Tree-sitter outline 查询提供大纲面板（非 LSP `documentSymbol`） | ⚠️ 未测试 |
| 代码折叠 | ✅ 通过 Tree-sitter 提供语法驱动的折叠 | ⚠️ 未测试 |
| 颜色选择器 | ✅ 字面量与颜色变量的色板，支持 hex/RGB/HSL 展示切换 | ⚠️ 未测试 |
| 格式化 | ✅ 带护栏的 stylus-supremacy 引擎 + 安全的 whitespace 引擎 | ⚠️ 未测试 |

诊断目前每次校验只报告编译器发现的第一个错误，且不包含风格 lint。文档符号与折叠由 Tree-sitter grammar 提供，不经过 language server。

## 兼容性

扩展当前固定使用 [`tree-sitter-stylus@8f00573`](https://github.com/sf-yuzifu/tree-sitter-stylus/commit/8f005731c15642c92db1235391b10f7e7c820a84)。该 revision 已通过以下检查：

- 21 个聚焦的 [Tree-sitter corpus 测试](https://github.com/sf-yuzifu/tree-sitter-stylus/blob/8f005731c15642c92db1235391b10f7e7c820a84/test/corpus/statements.txt)，全部通过
- 综合语法冒烟样例 [`example.styl`](example.styl)，解析结果中没有 `ERROR` 或 `MISSING` 节点
- 对 Stylus 官方仓库与 nib 中 501 个非空真实 `.styl` 文件进行的手工兼容性扫描，未产生 `ERROR` 或 `MISSING` 节点
- highlights、brackets、indents、outline、syntax overrides 和 text objects 查询均可针对固定版本的 grammar 编译

grammar 仓库的 CI 会重新生成 parser 并运行 corpus 测试。fixture、查询文件和 501 文件扫描目前属于发布前检查而非 CI 任务；在扫描脚本与样例来源 revision 纳入仓库前，501 文件数据只表示一次已记录的测试结果。

这些结果衡量的是 parser 兼容性，并不等价于编译器语义。Stylus 官方编译器仍然是判断代码语义是否合法的最终依据，同时也是下方诊断功能的错误来源。

## 错误诊断

扩展附带一个 diagnostics-only language server：[`stylus-language-server`](language-server/)，由官方 Stylus 编译器（`stylus@0.64.0`）驱动。它运行完整的编译流程——解析、求值以及 `@import`/`@require` 解析——并发布 Stylus 报告的第一个错误：

- 错误显示在编辑器内和 Problems 面板中，输入时按 200ms 防抖刷新，保存时立即刷新
- 由被导入文件引起的错误会报告到该文件的 URI 上，跳转时直接打开真正的依赖文件
- 服务器刻意只报告编译器的第一个错误，而不是基于 Tree-sitter 语法树猜测更多错误，避免诊断与真实编译器行为不一致

扩展首次使用时从 npm 下载固定版本的服务器包，并缓存在 Zed 的扩展工作目录中，之后离线可用，不要求用户预先在 `PATH` 中安装服务器。

## 语言智能

补全与 hover 由同一个 language server 提供：

- CSS 属性、值、at-rule 和伪选择器数据来自 [`@vscode/web-custom-data`](https://www.npmjs.com/package/@vscode/web-custom-data)（与 VS Code 相同的数据集），附 MDN 参考链接——只复用其数据，不使用它的 CSS parser（那会误读缩进式 Stylus）
- Stylus 内建函数签名在运行时直接读取已安装编译器自身的源码（`functions/index.styl` 与 `functions/index.js`），始终与当前编译器一致；常用内建函数配有人工整理的说明
- 变量、mixin 和函数由容错的逐行索引器从当前文件收集，因此编辑到一半文档暂时损坏时补全仍然可用
- Hover 显示变量声明、mixin/函数签名（含定义上方的文档注释）、内建函数文档和 CSS 属性文档

补全条目按上下文区分：属性后的值、`$` 后的变量、`@` 后的 at-rule、`:` 后的伪选择器、`()` 内的调用参数，以及语句位置的属性/mixin/标签。

颜色色板来自与编译器一致的字面量分析：识别 hex、`rgb()`/`rgba()`、`hsl()`/`hsla()` 以及 148 个 CSS 命名颜色；赋值为字面量颜色的变量会在每个使用处带上色板。取色器提供 hex、RGB、HSL 三种替换格式。`lighten()` 等函数求值结果暂不做色板。

签名帮助解析光标处最内层调用——用户 mixin 显示其声明的参数，Stylus 内建函数显示运行时提取的准确签名——并在嵌套调用中实时高亮当前参数。

导航是作用域感知的：索引器根据缩进树计算每个声明的可见范围，因此跳转定义、查找引用和重命名都能理解遮蔽。规则内声明的变量只在其块内遮蔽外层变量；参数和循环变量在函数体内优先；解析到不同（被遮蔽）声明的引用会被排除。重命名保留每个使用处各自的 `$` 前缀形式。

跨文件支持按编译器的查找规则解析 `@import`/`@require`（相对路径、`.styl` 补全、`index.styl`），带环保护和深度上限。导入文件中的根级变量和 mixin 出现在补全与 hover 中并标注来源文件，跳转定义直接进入依赖文件。索引缓存跟踪导入文件的修改时间，磁盘上的改动会自动生效。

查找引用与重命名是工作区范围的：服务器扫描工作区内的 `.styl` 文件（排除 `node_modules`，对大型目录设有上限），构建反向导入图，从所有能传递到达该声明的文件中收集引用——同时仍按每个文件各自的作用域规则过滤，因此无关文件里的同名局部变量永远不会混入。重命名会一次性在所有受影响文件中应用编辑。

## 格式化

Stylus 没有官方格式化器，因此服务器集成了 [stylus-supremacy](https://github.com/ThisIsManta/stylus-supremacy)——VSCode "Stylus Supremacy" 扩展的引擎，也是大多数 Stylus 用户正在使用的格式化工具。默认使用引擎自身的默认选项（CSS 风格的大括号/冒号/分号，即其测试最充分的路径），所有选项均可透传配置。

由于上游引擎在部分合法 Stylus 上存在已知的正确性缺陷，每次格式化请求都会经过安全护栏；任一护栏触发时文件保持不变，原因会写入 language server 日志：

1. 含科学计数法（如 `1e5px`，引擎会将其改写成非法 CSS）的文档拒绝格式化
2. 引擎无法解析的文档（包括 `@namespace ... url(...)` 与语法损坏的文件）拒绝格式化
3. 输出中被注入回车符（`\r`）的拒绝格式化
4. 二次格式化结果不稳定（`@document` 的已知缺陷）的拒绝格式化

另提供 `whitespace` 引擎：只规范化行尾空白、tab 缩进、连续空行和末尾换行，永不重写值或风格，因此始终安全。

在 Zed `settings.json` 中配置：

```json
{
  "lsp": {
    "stylus-language-server": {
      "initialization_options": {
        "format": {
          "engine": "supremacy",
          "options": { "insertBraces": false, "insertSemicolons": false }
        }
      }
    }
  },
  "languages": {
    "Stylus": { "format_on_save": "on" }
  }
}
```

- `format.engine`：`"supremacy"`（默认）或 `"whitespace"`
- `format.options`：任意 [stylus-supremacy 选项](https://thisismanta.github.io/stylus-supremacy)（`insertColons`、`insertBraces`、`tabStopChar`、`sortProperties` 等）。注意 `insertBraces: false`（缩进风格输出）走的是引擎测试最少的路径，复杂文件可能格式化不当；护栏仍然生效
- `format.tabStopChar` 与 `format.maxConsecutiveBlankLines` 用于调整 whitespace 引擎

## 当前限制

- 每次校验只报告编译器发现的第一个错误，而不是一次列出全部错误
- 跨文件索引只覆盖 `@import` 链中的根级符号；暂不支持 `node_modules` 包解析与 glob 导入
- 工作区引用沿声明文件的反向导入图收集；`node_modules` 中的导入方不在范围内
- 作用域模型基于缩进，是近似实现：不建模 Stylus 求值顺序、条件重定义或属性查找（`@width`）
- 出于安全考虑，格式化可能拒绝部分合法文档（见上方护栏列表）；不支持范围格式化
- 伪类与伪元素参数内容目前以宽容的 `pseudo_argument_text` 解析，嵌套参数尚不能获得完整的语法感知高亮
- Tree-sitter parser 会有意保持宽容度；编译器诊断才是权威的错误信号

## 安装

扩展尚未发布到 Zed 扩展市场。

### 开发安装

1. 克隆本仓库。
2. 打开 Zed。
3. 在命令面板运行 `zed: install dev extension`。
4. 选择本仓库目录。
5. 打开 `.styl` 文件。如果语言检测尚未刷新，手动选择 `Stylus`。

Zed 会自动编译扩展以及 [`extension.toml`](extension.toml) 中固定 revision 的 Tree-sitter grammar。需要编译 grammar 时，Zed 会自动下载所需的 WASI SDK。

## 架构

实现分布在两个仓库：

- [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus) 负责 `grammar.js`、外部缩进 scanner、生成的 parser 源码、corpus 测试、完整语法 fixture 和可复用的基础查询。
- 本仓库固定不可变的 grammar commit，维护 Zed metadata 与 outline、syntax overrides 等编辑器专用查询，负责安装并启动 language server 的 Rust 扩展入口，以及 language server 本身。

```text
stylus-zed/
├── extension.toml
├── Cargo.toml
├── src/lib.rs
├── example.styl
├── language-server/
│   ├── bin/stylus-language-server.js
│   ├── src/diagnostics.js
│   └── test/
└── languages/stylus/
    ├── config.toml
    ├── highlights.scm
    ├── brackets.scm
    ├── indents.scm
    ├── outline.scm
    ├── overrides.scm
    └── textobjects.scm
```

本仓库的查询必须与固定 grammar revision 产生的节点类型一致。highlights、brackets、indents 和 text objects 等共享查询应与 grammar 仓库保持同步。

## 开发

依赖：

- 用于集成测试的 Zed
- 手动构建扩展时，通过 `rustup` 安装的 Rust 与 `wasm32-wasip2` target
- 修改 grammar 时使用的 Node.js、npm 和 Tree-sitter CLI
- 在 Zed 之外编译 grammar 时使用的 WASI SDK

Zed 会自动安装 Rust target 和 WASI SDK。手动构建 Rust 扩展时运行：

```sh
rustup target add wasm32-wasip2
cargo build --locked --target wasm32-wasip2
```

运行 language server 检查（需要 Node.js 20 或更高版本）：

```sh
cd language-server
npm install
npm run check
npm test
```

当 `stylus-zed` 和 `tree-sitter-stylus` 位于同一父目录时，在 grammar 仓库执行 parser 检查：

```sh
cd ../tree-sitter-stylus
npm install
npx tree-sitter generate
npx tree-sitter test
npx tree-sitter parse --quiet --stat example.styl
```

针对 fixture 编译 grammar 仓库查询与 Zed 专用查询：

```sh
for query in queries/*.scm; do
  npx tree-sitter query "$query" example.styl >/dev/null
done

npx tree-sitter query ../stylus-zed/languages/stylus/outline.scm example.styl >/dev/null
npx tree-sitter query ../stylus-zed/languages/stylus/overrides.scm example.styl >/dev/null
```

查询编译只能验证节点名称，不能验证 Zed 专用 capture 的行为。发布前应将本仓库安装为开发扩展，检查 `Zed.log` 是否存在查询警告，并分别验证高亮、按 Enter 与反缩进、文档大纲、括号匹配、字符串或注释内的引号插入、Vim text objects，以及 Problems 面板中的编译器诊断。

### 更新 Grammar

1. 更新并测试 `tree-sitter-stylus`。
2. 提交并推送 grammar 变更。
3. 将 [`extension.toml`](extension.toml) 中 `[grammars.stylus].rev` 更新为完整 commit SHA。
4. 如果共享查询或 `example.styl` 有变化，同步到本仓库。
5. 重新执行上述检查，并重新安装或重新加载 Zed 开发扩展。

## 路线图

### 错误诊断 —— 已在 v0.2 完成

基于官方 Stylus 编译器的 diagnostics-only language server 会向 Zed 发布语法、求值和导入错误，同时避免引入第二套不兼容的 parser。后续可以针对编译器不覆盖的风格规则接入 Stylelint。本扩展不会使用 `vscode-css-language-server`，因为缩进式 Stylus 不是合法 CSS，直接接入会产生误导性的错误诊断。

### 语言智能 —— v0.3 已开始

- CSS 属性和值补全 —— v0.3 已完成
- Stylus 内建函数补全和 hover 文档 —— v0.3 已完成
- 文件内变量、mixin、函数和参数 —— 已完成；v0.5 起导航为作用域感知
- 签名帮助与颜色色板/格式切换 —— v0.4 已完成
- 跳转到定义、引用查找和重命名 —— v0.5 已完成
- 跨文件符号索引（跟随 `@import`）—— v0.6 已完成；覆盖所有导入方的工作区范围引用与重命名 —— v0.8 已完成
- 变量/mixin 的文档符号 —— v0.8 已完成（选择器大纲由 Tree-sitter 提供）
- `node_modules` 包解析与 glob 导入的跨文件索引
- 求值颜色（如 `lighten()` 结果）的色板

### 格式化与 Lint

格式化自 v0.7 起可用，由带护栏的 stylus-supremacy 引擎与安全的 whitespace 引擎提供。后续方向：范围格式化、自研保留缩进风格的格式化器以替代脆弱的 `insertBraces: false` 路径，以及可选的 Stylelint 集成。

## 贡献

欢迎提交 issue 和 pull request。parser 问题请附带最小 `.styl` 样例，并尽可能说明 Stylus 编译器的预期行为。

grammar 问题请提交到 [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus)，Zed 集成问题请提交到本仓库。

## 致谢

本项目建立在以下项目及其维护者的工作之上，谨致谢意。

### 直接使用的代码与数据

- [Stylus](https://github.com/stylus/stylus)：语言、编译器与文档。language server 运行官方编译器产生诊断，并从其自身源码（`functions/index.styl`、`functions/index.js`）读取内建函数签名。其测试套件也为我们的兼容性 fixture 提供了参考。
- [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus)：驱动解析的原生 Tree-sitter grammar，作为本扩展的姊妹项目维护。
- [stylus-supremacy](https://github.com/ThisIsManta/stylus-supremacy)（[@ThisIsManta](https://github.com/ThisIsManta)）：格式化引擎，通过我们的安全护栏集成。
- [vscode-custom-data](https://github.com/microsoft/vscode-custom-data)（`@vscode/web-custom-data`）：补全与 hover 使用的 CSS 属性、值、at-rule、伪选择器数据以及 HTML 标签数据。我们只复用与 VS Code 相同的数据集，不使用其 CSS parser。
- [color-name](https://github.com/colorjs/color-name)：颜色色板使用的 148 个 CSS 命名颜色。
- [vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node)（`vscode-languageserver`、`vscode-languageserver-textdocument`）：服务器所基于的 LSP 协议实现。
- [nib](https://github.com/stylus/nib)：真实 Stylus 项目的兼容性测试样例。
- [Tree-sitter](https://github.com/tree-sitter/tree-sitter)：增量解析基础设施。
- [Zed](https://github.com/zed-industries/zed) 与 [Zed Extensions](https://github.com/zed-industries/extensions)：编辑器和扩展平台。

### 参考与先行工作

- [zed-less](https://github.com/jimliang/zed-less) 与 [tree-sitter-less](https://github.com/jimliang/tree-sitter-less)：扩展的 Rust 入口借鉴了它们在 Zed 中安装并启动 npm language server 的模式。
- [sinejoe/zed-stylus-extension](https://github.com/sinejoe/zed-stylus-extension)：较早探索了 Zed 的 Stylus 支持，并明确记录了缺少原生 grammar 的核心问题；功能矩阵沿用了其 README 的功能表格作为对照基准。

本扩展不依赖之前 CSS fallback 实现中的代码；当前 parser 与查询均围绕原生 `tree-sitter-stylus` grammar 构建。

## 许可证

[MIT](LICENSE)
