# Stylus for Zed

[简体中文](README.zh-CN.md)

Native [Stylus](https://stylus-lang.com/) language support for the [Zed](https://zed.dev/) editor, powered by [tree-sitter-stylus](https://github.com/sf-yuzifu/tree-sitter-stylus).

> Pre-release: syntax parsing and editor integration are available for development testing. Compiler diagnostics and language intelligence are planned before the first public release.

## Features

- Native Tree-sitter grammar for both indentation-based and brace-based Stylus
- Syntax highlighting for selectors, declarations, variables, mixins, functions, control flow, interpolation, hashes, at-rules, and operators
- Automatic indentation for nested rules, mixins, conditions, loops, at-rules, keyframes, anonymous functions, and block calls
- Bracket matching and context-aware bracket/quote autoclosing
- Document outline for selectors, mixins, variables, keyframes, and at-rules
- Vim text objects for rules, mixins, block calls, anonymous functions, at-rules, keyframes, and comments
- `.styl` file detection, comment toggling, two-space indentation, and Stylus word characters

The grammar is implemented specifically for Stylus. It does not use a CSS grammar as a fallback, so indentation-style Stylus and Stylus-specific constructs are parsed natively.

## Compatibility

This extension currently pins [`tree-sitter-stylus@8f00573`](https://github.com/sf-yuzifu/tree-sitter-stylus/commit/8f005731c15642c92db1235391b10f7e7c820a84). At that revision, the parser has been checked with:

- 21 focused [Tree-sitter corpus tests](https://github.com/sf-yuzifu/tree-sitter-stylus/blob/8f005731c15642c92db1235391b10f7e7c820a84/test/corpus/statements.txt), all passing
- The comprehensive [`example.styl`](example.styl) smoke-test fixture, parsed without `ERROR` or `MISSING` nodes
- A manual compatibility sweep of 501 non-empty real-world `.styl` files from the official Stylus repository and nib, parsed without `ERROR` or `MISSING` nodes
- Query compilation against the pinned grammar for highlights, brackets, indentation, outline, syntax overrides, and text objects

The grammar repository CI regenerates the parser and runs the corpus suite. The fixture, queries, and 501-file sweep are currently release checks rather than CI jobs; the real-world sweep is a recorded result until its runner and source revisions are checked in.

These results measure parser compatibility, not compiler equivalence. The official Stylus compiler remains the source of truth for semantic validity.

## Current Limitations

- No diagnostics or Problems panel integration yet
- No completion, hover documentation, references, or go-to-definition yet
- No formatter
- Pseudo-class and pseudo-element argument contents are parsed permissively as `pseudo_argument_text`, so nested arguments do not yet receive fully syntax-aware highlighting
- Parsing is intentionally permissive and does not replace compiler or linter validation

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
- This repository pins an immutable grammar commit and owns Zed metadata plus editor-specific queries such as outline and syntax overrides. Its Rust entry point is currently minimal and is reserved for future language-server integration.

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

Query compilation validates node names, but not Zed-specific capture semantics. Before release, install the repository as a dev extension, inspect `Zed.log` for query warnings, and smoke-test highlighting, Enter/dedent behavior, outline entries, bracket matching, quote insertion in strings/comments, and Vim text objects.

### Updating the Grammar

1. Update and test `tree-sitter-stylus`.
2. Commit and push the grammar changes.
3. Update `[grammars.stylus].rev` in [`extension.toml`](extension.toml) to the full commit SHA.
4. Synchronize the shared queries and `example.styl` when they changed.
5. Re-run the checks above and reinstall or reload the Zed dev extension.

## Roadmap

### Diagnostics

The next major feature is a diagnostics-only language server backed by the official Stylus compiler. It will publish syntax and compiler errors to Zed without introducing a second, incompatible parser.

### Language Intelligence

- CSS property and value completion
- Stylus built-in function completion and hover documentation
- Workspace variables, mixins, functions, and parameters
- Go-to-definition, references, and document symbols

### Linting

Stylelint integration may be added after compiler diagnostics. `vscode-css-language-server` is intentionally not used because indentation-style Stylus is not valid CSS and would produce misleading diagnostics.

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
