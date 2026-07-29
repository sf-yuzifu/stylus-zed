# Zed 的 Stylus 语言支持

[English](README.md)

基于 [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus)，为 [Zed](https://zed.dev/) 编辑器提供原生 [Stylus](https://stylus-lang.com/) 语言支持。

> 预发布状态：语法解析与编辑器集成已可用于开发测试。首个公开版本发布前，计划继续加入编译器诊断与语言智能能力。

## 功能

- 原生 Tree-sitter grammar，同时支持缩进式和大括号式 Stylus
- 为选择器、声明、变量、mixin、函数、控制流、插值、hash、at-rule 和运算符提供语法高亮
- 为嵌套规则、mixin、条件、循环、at-rule、keyframes、匿名函数和 block call 提供自动缩进
- 括号匹配，以及能识别上下文的括号和引号自动闭合
- 为选择器、mixin、变量、keyframes 和 at-rule 提供文档大纲
- 为规则、mixin、block call、匿名函数、at-rule、keyframes 和注释提供 Vim text objects
- `.styl` 文件识别、注释切换、两空格缩进和 Stylus 单词字符配置

grammar 是专门为 Stylus 实现的，不使用 CSS grammar 作为替代。因此，缩进式 Stylus 和 Stylus 特有语法都由原生 parser 解析。

## 兼容性

扩展当前固定使用 [`tree-sitter-stylus@8f00573`](https://github.com/sf-yuzifu/tree-sitter-stylus/commit/8f005731c15642c92db1235391b10f7e7c820a84)。该 revision 已通过以下检查：

- 21 个聚焦的 [Tree-sitter corpus 测试](https://github.com/sf-yuzifu/tree-sitter-stylus/blob/8f005731c15642c92db1235391b10f7e7c820a84/test/corpus/statements.txt)，全部通过
- 综合语法冒烟样例 [`example.styl`](example.styl)，解析结果中没有 `ERROR` 或 `MISSING` 节点
- 对 Stylus 官方仓库与 nib 中 501 个非空真实 `.styl` 文件进行的手工兼容性扫描，未产生 `ERROR` 或 `MISSING` 节点
- highlights、brackets、indents、outline、syntax overrides 和 text objects 查询均可针对固定版本的 grammar 编译

grammar 仓库的 CI 会重新生成 parser 并运行 corpus 测试。fixture、查询文件和 501 文件扫描目前属于发布前检查而非 CI 任务；在扫描脚本与样例来源 revision 纳入仓库前，501 文件数据只表示一次已记录的测试结果。

这些结果衡量的是 parser 兼容性，并不等价于编译器语义。Stylus 官方编译器仍然是判断代码语义是否合法的最终依据。

## 当前限制

- 暂无错误诊断和 Problems 面板集成
- 暂无补全、hover 文档、引用查找和跳转到定义
- 暂无格式化器
- 伪类与伪元素参数内容目前以宽容的 `pseudo_argument_text` 解析，嵌套参数尚不能获得完整的语法感知高亮
- parser 会有意保持一定宽容度，不能替代编译器或 linter

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
- 本仓库固定不可变的 grammar commit，并维护 Zed metadata 与 outline、syntax overrides 等编辑器专用查询。当前 Rust 入口只包含最小注册逻辑，留作后续 language server 集成使用。

```text
stylus-zed/
├── extension.toml
├── Cargo.toml
├── src/lib.rs
├── example.styl
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

查询编译只能验证节点名称，不能验证 Zed 专用 capture 的行为。发布前应将本仓库安装为开发扩展，检查 `Zed.log` 是否存在查询警告，并分别验证高亮、按 Enter 与反缩进、文档大纲、括号匹配、字符串或注释内的引号插入以及 Vim text objects。

### 更新 Grammar

1. 更新并测试 `tree-sitter-stylus`。
2. 提交并推送 grammar 变更。
3. 将 [`extension.toml`](extension.toml) 中 `[grammars.stylus].rev` 更新为完整 commit SHA。
4. 如果共享查询或 `example.styl` 有变化，同步到本仓库。
5. 重新执行上述检查，并重新安装或重新加载 Zed 开发扩展。

## 路线图

### 错误诊断

下一个主要功能是基于官方 Stylus 编译器的 diagnostics-only language server。它会向 Zed 发布语法和编译错误，同时避免引入第二套不兼容的 parser。

### 语言智能

- CSS 属性和值补全
- Stylus 内置函数补全和 hover 文档
- 工作区变量、mixin、函数和参数补全
- 跳转到定义、引用查找和 document symbols

### Lint

编译器诊断稳定后可以集成 Stylelint。本扩展不会使用 `vscode-css-language-server`，因为缩进式 Stylus 不是合法 CSS，直接接入会产生误导性的错误诊断。

## 贡献

欢迎提交 issue 和 pull request。parser 问题请附带最小 `.styl` 样例，并尽可能说明 Stylus 编译器的预期行为。

grammar 问题请提交到 [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus)，Zed 集成问题请提交到本仓库。

## 致谢

本项目建立在以下项目和社区工作的基础上，谨致谢意：

- [Stylus](https://github.com/stylus/stylus)：语言、编译器、文档和兼容性测试样例
- [nib](https://github.com/stylus/nib)：真实 Stylus 项目的兼容性覆盖
- [Tree-sitter](https://github.com/tree-sitter/tree-sitter)：增量解析基础设施
- [Zed](https://github.com/zed-industries/zed) 与 [Zed Extensions](https://github.com/zed-industries/extensions)：编辑器和扩展平台
- [zed-less](https://github.com/jimliang/zed-less) 与 [tree-sitter-less](https://github.com/jimliang/tree-sitter-less)：为 Zed 语言扩展结构提供了有价值的参考
- [sinejoe/zed-stylus-extension](https://github.com/sinejoe/zed-stylus-extension)：较早探索了 Zed 的 Stylus 支持，并明确记录了缺少原生 grammar 的核心问题

本扩展不依赖之前 CSS fallback 实现中的代码；当前 parser 与查询均围绕原生 `tree-sitter-stylus` grammar 构建。

## 许可证

[MIT](LICENSE)
