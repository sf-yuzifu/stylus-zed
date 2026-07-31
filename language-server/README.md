# Stylus Language Server

A Language Server Protocol implementation for [Stylus](https://stylus-lang.com/),
backed by the official [Stylus compiler](https://github.com/stylus/stylus).

The server accepts `--stdio` and provides:

- **Diagnostics** — the first error reported by the official compiler (syntax,
  evaluation, and `@import`/`@require` resolution), debounced while typing and
  refreshed on save. Errors inside imported files are published on that file's
  URI.
- **Stylelint** — optional style diagnostics via bundled Stylelint 16 and
  `postcss-styl` (with the official `stylelint-stylus` plugin available to
  configurations). Disabled unless a project stylelint configuration is
  discoverable or explicitly enabled through initialization options.
- **Completions** — CSS properties and values, Stylus built-in functions,
  at-rules, pseudo-classes and pseudo-elements, HTML tags, and the variables,
  mixins, and functions defined in the current file.
- **Hover** — variable declarations, mixin/function signatures, Stylus
  built-in documentation, and CSS property documentation with MDN links.
- **Color swatches** — hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, named colors,
  usages of color-valued variables, and **compiler-evaluated expressions**
  such as `lighten(#3498db, 10%)` or `rgba($primary, 0.5)`. The color picker
  offers hex/RGB/HSL replacements for literal color text only.
- **Signature help** — user mixins with declared parameters and Stylus
  built-ins with runtime-accurate signatures, tracking the active parameter
  across nested calls.
- **Navigation** — go-to-definition, find-references, and rename for
  variables, mixins, and functions. Resolution is scope-aware: it understands
  indentation-based visibility, shadowing, parameters, and loop variables,
  and rename preserves each occurrence's `$` style.
- **Cross-file symbols** — root-level variables and mixins from `@import`ed
  files appear in completions, hover, and go-to-definition, which jumps into
  the dependency. Resolution follows the compiler's lookup rules: relative
  paths, `index.styl`, `node_modules` packages (including `package.json`
  `main` and scoped packages), and glob imports, with cycle protection. The
  index tracks imported files' modification times.
- **Workspace references** — find-references and rename span every `.styl`
  file that can transitively import the declaration, using a reverse import
  graph over the workspace, while honoring each file's own scoping rules.
- **Document symbols** — file-local variables and mixins/functions.
- **Formatting** — three engines: a from-scratch style-preserving `indent`
  engine (default) verified by structural, compiler, and idempotency checks;
  [stylus-supremacy](https://github.com/ThisIsManta/stylus-supremacy) behind
  safety guards; and a minimal whitespace engine. Range formatting is
  supported for whole documents and selections.

CSS data comes from `@vscode/web-custom-data`; Stylus built-in signatures are
read from the installed compiler's own sources. File-local symbols use a
resilient line-based index that keeps working while the document is broken
mid-edit. The server does not provide navigation, formatting, or lint rules.

```sh
npx stylus-language-server --stdio
```

This package is developed as part of
[stylus-zed](https://github.com/sf-yuzifu/stylus-zed).

## Security Notes

`npm audit` currently reports 4 high and 3 moderate advisories, all inside
`stylint` — an unmaintained transitive dependency of `stylus-supremacy`
(`brace-expansion`, `minimatch`, `glob`, `yargs`/`yargs-parser`). Those
advisories affect stylint's command-line file globbing and CLI argument
parsing, which this server never executes: formatting runs in-process through
`stylus-supremacy.format()` on document text only, and no glob patterns or
CLI input reach the vulnerable code. The fixable advisory in the chain
(`mout`) is already overridden to a patched version. If `stylus-supremacy`
drops or replaces its `stylint` dependency in a future release, the remaining
advisories disappear.

## Acknowledgements

- [Stylus](https://github.com/stylus/stylus) — the official compiler behind
  diagnostics and the source of built-in function signatures.
- [stylus-supremacy](https://github.com/ThisIsManta/stylus-supremacy) — the
  formatting engine.
- [Stylelint](https://github.com/stylelint/stylelint),
  [postcss-styl](https://github.com/stylus/postcss-styl), and
  [stylelint-stylus](https://github.com/stylus/stylelint-stylus) — style
  linting for Stylus sources.
- [vscode-custom-data](https://github.com/microsoft/vscode-custom-data) —
  CSS/HTML data for completions and hover.
- [color-name](https://github.com/colorjs/color-name) — the CSS named-color
  table.
- [vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node) —
  the LSP protocol implementation.

## License

[MIT](LICENSE)
