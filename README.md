# Stylus for Zed

[简体中文](README.zh-CN.md)

Native [Stylus](https://stylus-lang.com/) language support for the [Zed](https://zed.dev/) editor, powered by [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus).

> Pre-release: syntax parsing, editor integration, and compiler diagnostics are available for development testing. Language intelligence (completion, hover, navigation) is planned before the first public release.

## Features

- Native Tree-sitter grammar for both indentation-based and brace-based Stylus
- Syntax highlighting for selectors, declarations, variables, mixins, functions, control flow, interpolation, hashes, at-rules, and operators
- Automatic indentation for nested rules, mixins, conditions, loops, at-rules, keyframes, anonymous functions, and block calls
- Bracket matching and context-aware bracket/quote autoclosing
- Document outline for selectors, mixins, variables, keyframes, and at-rules
- Vim text objects for rules, mixins, block calls, anonymous functions, at-rules, keyframes, and comments
- Compiler diagnostics from the official Stylus compiler, shown in the editor and the Problems panel as you type
- Context-aware completions for CSS properties and values, Stylus built-in functions, at-rules, pseudo-classes and pseudo-elements, HTML tags, and the variables, mixins, and functions defined in the current file
- Hover documentation for variables, mixins, functions, Stylus built-ins, and CSS properties with MDN links
- Color swatches for literal colors and color-valued variables, with hex/RGB/HSL conversion through the color picker
- Signature help for user mixins and Stylus built-in functions, tracking the active parameter
- Go-to-definition and find-references for variables, mixins, and functions, with scope-aware resolution that understands shadowing, parameters, and loop variables
- Rename refactoring that preserves each occurrence's `$` style
- `.styl` file detection, comment toggling, two-space indentation, and Stylus word characters

The grammar is implemented specifically for Stylus. It does not use a CSS grammar as a fallback, so indentation-style Stylus and Stylus-specific constructs are parsed natively.

## Feature Matrix

Measured against the feature table published by [sinejoe/zed-stylus-extension](https://github.com/sinejoe/zed-stylus-extension) (as of July 2026), this extension fully covers 10 of the 11 rows; only formatting remains on the roadmap:

| Feature | This extension | sinejoe/zed-stylus-extension |
| --- | --- | --- |
| Syntax highlighting | ✅ Native `tree-sitter-stylus` grammar, both indentation and brace styles | ⚠️ Partial (CSS grammar as a stand-in) |
| Diagnostics / linting | ✅ Live errors from the official Stylus compiler in the editor and Problems panel | ⚠️ Untested |
| Completions | ✅ CSS properties/values, Stylus built-ins, at-rules, pseudo selectors, tags, and file-local variables/mixins/functions | ⚠️ Untested |
| Hover documentation | ✅ Variables, mixins, functions, Stylus built-ins, and CSS properties | ⚠️ Untested |
| Signature help | ✅ User mixins and Stylus built-ins with active-parameter tracking | ⚠️ Untested |
| Go-to definition | ✅ Scope-aware, understands shadowing and parameters | ⚠️ Untested |
| Find references | ✅ Scope-aware, including rename refactoring | ⚠️ Untested |
| Document symbols | ✅ Outline panel via the Tree-sitter outline query (not LSP `documentSymbol`) | ⚠️ Untested |
| Folding ranges | ✅ Syntax-driven folding via Tree-sitter | ⚠️ Untested |
| Color picker | ✅ Swatches for literals and color-valued variables, with hex/RGB/HSL presentations | ⚠️ Untested |
| Formatting | ❌ Planned | ⚠️ Untested |

Diagnostics currently report the compiler's first error per validation pass and do not include style linting. Document symbols and folding are provided by the Tree-sitter grammar rather than the language server.

## Compatibility

This extension currently pins [`tree-sitter-stylus@8f00573`](https://github.com/sf-yuzifu/tree-sitter-stylus/commit/8f005731c15642c92db1235391b10f7e7c820a84). At that revision, the parser has been checked with:

- 21 focused [Tree-sitter corpus tests](https://github.com/sf-yuzifu/tree-sitter-stylus/blob/8f005731c15642c92db1235391b10f7e7c820a84/test/corpus/statements.txt), all passing
- The comprehensive [`example.styl`](example.styl) smoke-test fixture, parsed without `ERROR` or `MISSING` nodes
- A manual compatibility sweep of 501 non-empty real-world `.styl` files from the official Stylus repository and nib, parsed without `ERROR` or `MISSING` nodes
- Query compilation against the pinned grammar for highlights, brackets, indentation, outline, syntax overrides, and text objects

The grammar repository CI regenerates the parser and runs the corpus suite. The fixture, queries, and 501-file sweep are currently release checks rather than CI jobs; the real-world sweep is a recorded result until its runner and source revisions are checked in.

These results measure parser compatibility, not compiler equivalence. The official Stylus compiler remains the source of truth for semantic validity, and it is also what powers the diagnostics below.

## Diagnostics

The extension ships a diagnostics-only language server, [`stylus-language-server`](language-server/), backed by the official Stylus compiler (`stylus@0.64.0`). It validates the full compiler pipeline — parsing, evaluation, and `@import`/`@require` resolution — and publishes the first error Stylus reports:

- Errors are shown inline and in the Problems panel, debounced by 200 ms while typing and refreshed immediately on save
- Errors caused by an imported file are reported on that file's URI, so jumping to the problem opens the actual dependency
- The server intentionally reports the compiler's first error instead of guessing additional ones from the Tree-sitter parse tree, avoiding diagnostics that disagree with the real compiler

The extension downloads the pinned server package from npm on first use and caches it in Zed's extension work directory; subsequent starts work offline. A server already on the user's `PATH` is not required.

## Language Intelligence

Completions and hover are provided by the same language server:

- CSS property, value, at-rule, and pseudo-selector data comes from [`@vscode/web-custom-data`](https://www.npmjs.com/package/@vscode/web-custom-data) (the same data set VS Code uses), including MDN reference links — only the data is reused, never its CSS parser, which would misread indentation-style Stylus
- Stylus built-in function signatures are read at runtime from the installed compiler's own sources (`functions/index.styl` and `functions/index.js`), so they always match the compiler in use; descriptions for common built-ins are curated
- Variables, mixins, and functions are collected from the current file by a resilient line-based indexer, so completions keep working while the document is temporarily broken mid-edit
- Hover shows variable declarations, mixin/function signatures (with the doc comment above the definition), built-in documentation, and CSS property documentation

Completion items are context-aware: values after a property, variables after `$`, at-rules after `@`, pseudo selectors after `:`, call arguments inside `()`, and properties/mixins/tags in statement position.

Color swatches come from the same literal analysis the compiler performs: hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, and the 148 CSS named colors are recognized, and variables assigned a literal color carry their swatch to every usage site. The color picker offers hex, RGB, and HSL replacement presentations. Colors produced by functions such as `lighten()` are not evaluated, so they do not get swatches yet.

Signature help resolves the innermost call at the cursor — user mixins with their declared parameters, or Stylus built-ins with runtime-accurate signatures — and highlights the active parameter as you type across nested calls.

Navigation is scope-aware: the indexer computes the visibility range of every declaration from the indentation tree, so go-to-definition, find-references, and rename all understand shadowing. A variable declared inside a rule shadows the outer one only within its block, parameters and loop variables win inside their function bodies, and references that resolve to a different (shadowed) declaration are excluded. Rename preserves the `$` prefix style of each individual occurrence.

## Current Limitations

- Diagnostics report the compiler's first error per validation pass, not every error at once
- Symbols and navigation are file-local; cross-file symbols (from `@import`ed files) are not indexed yet
- The scope model is indentation-based and approximate: it does not model Stylus evaluation order, conditional redefinition, or property lookups (`@width`)
- No formatter
- Pseudo-class and pseudo-element argument contents are parsed permissively as `pseudo_argument_text`, so nested arguments do not yet receive fully syntax-aware highlighting
- The Tree-sitter parser is intentionally permissive; compiler diagnostics are the authoritative error signal

## Installation

The extension has not been published to the Zed extension registry yet.

### Development Installation

1. Clone this repository.
2. Open Zed.
3. Run `zed: install dev extension` from the command palette.
4. Select the repository directory.
5. Open a `.styl` file and select `Stylus` if language detection has not refreshed yet.

Zed automatically compiles the extension and the Tree-sitter grammar revision pinned in [`extension.toml`](extension.toml). Zed downloads the required WASI SDK for grammar compilation when needed.

## Architecture

The implementation is split between two repositories:

- [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus) owns `grammar.js`, the external indentation scanner, generated parser sources, corpus tests, the full-language fixture, and reusable base queries.
- This repository pins an immutable grammar commit and owns Zed metadata, editor-specific queries such as outline and syntax overrides, the Rust extension entry point that installs and launches the language server, and the language server itself.

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

Queries in this repository must match the node types produced by the pinned grammar revision. The shared highlight, bracket, indent, and text-object queries should remain synchronized with the grammar repository.

## Development

Requirements:

- Zed for integration testing
- Rust installed through `rustup` and the `wasm32-wasip2` target for manual extension builds
- Node.js, npm, and the Tree-sitter CLI when changing the grammar
- A WASI SDK when compiling the grammar outside Zed

Zed installs the Rust target and WASI SDK automatically. For a manual Rust build:

```sh
rustup target add wasm32-wasip2
cargo build --locked --target wasm32-wasip2
```

Run the language-server checks (requires Node.js 20 or newer):

```sh
cd language-server
npm install
npm run check
npm test
```

With `stylus-zed` and `tree-sitter-stylus` checked out as sibling directories, run the parser checks from the grammar repository:

```sh
cd ../tree-sitter-stylus
npm install
npx tree-sitter generate
npx tree-sitter test
npx tree-sitter parse --quiet --stat example.styl
```

Compile the grammar-owned queries and the Zed-only queries against the fixture:

```sh
for query in queries/*.scm; do
  npx tree-sitter query "$query" example.styl >/dev/null
done

npx tree-sitter query ../stylus-zed/languages/stylus/outline.scm example.styl >/dev/null
npx tree-sitter query ../stylus-zed/languages/stylus/overrides.scm example.styl >/dev/null
```

Query compilation validates node names, but not Zed-specific capture semantics. Before release, install the repository as a dev extension, inspect `Zed.log` for query warnings, and smoke-test highlighting, Enter/dedent behavior, outline entries, bracket matching, quote insertion in strings/comments, Vim text objects, and compiler diagnostics in the Problems panel.

### Updating the Grammar

1. Update and test `tree-sitter-stylus`.
2. Commit and push the grammar changes.
3. Update `[grammars.stylus].rev` in [`extension.toml`](extension.toml) to the full commit SHA.
4. Synchronize the shared queries and `example.styl` when they changed.
5. Re-run the checks above and reinstall or reload the Zed dev extension.

## Roadmap

### Diagnostics — done in v0.2

A diagnostics-only language server backed by the official Stylus compiler publishes syntax, evaluation, and import errors to Zed without introducing a second, incompatible parser. Stylelint integration may be added later for style rules the compiler does not cover. `vscode-css-language-server` is intentionally not used because indentation-style Stylus is not valid CSS and would produce misleading diagnostics.

### Language Intelligence — started in v0.3

- CSS property and value completion — done in v0.3
- Stylus built-in function completion and hover documentation — done in v0.3
- File-local variables, mixins, functions, and parameters — done; navigation is scope-aware since v0.5
- Signature help and color swatches/presentations — done in v0.4
- Go-to-definition, references, and rename — done in v0.5
- Cross-file symbol indexing (following `@import`) and workspace-wide references
- LSP document symbols for variables/mixins/functions (the Tree-sitter outline already covers selectors)
- Evaluated colors (e.g. `lighten()` results) for swatches

### Formatting and Linting

A formatter and optional Stylelint integration are planned after the language-intelligence work settles.

## Contributing

Issues and pull requests are welcome. Parser bugs should include a minimal `.styl` sample and, when possible, the expected Stylus compiler behavior.

Please report grammar issues in [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus) and Zed integration issues in this repository.

## Acknowledgements

This project builds on and is grateful to:

- [Stylus](https://github.com/stylus/stylus), for the language, compiler, documentation, and compatibility fixtures
- [nib](https://github.com/stylus/nib), for real-world Stylus compatibility coverage
- [Tree-sitter](https://github.com/tree-sitter/tree-sitter), for incremental parsing infrastructure
- [Zed](https://github.com/zed-industries/zed) and [Zed Extensions](https://github.com/zed-industries/extensions), for the editor and extension platform
- [zed-less](https://github.com/jimliang/zed-less) and [tree-sitter-less](https://github.com/jimliang/tree-sitter-less), which provided useful reference points for Zed language extension structure
- [sinejoe/zed-stylus-extension](https://github.com/sinejoe/zed-stylus-extension), for earlier exploration of Stylus support in Zed and for documenting the missing native grammar problem

No code from the prior CSS-fallback implementation is required by this extension; the parser and queries here are built around the native `tree-sitter-stylus` grammar.

## License

[MIT](LICENSE)
