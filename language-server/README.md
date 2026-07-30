# Stylus Language Server

A Language Server Protocol implementation for [Stylus](https://stylus-lang.com/),
backed by the official [Stylus compiler](https://github.com/stylus/stylus).

The server accepts `--stdio` and provides:

- **Diagnostics** — the first error reported by the official compiler (syntax,
  evaluation, and `@import`/`@require` resolution), debounced while typing and
  refreshed on save. Errors inside imported files are published on that file's
  URI.
- **Completions** — CSS properties and values, Stylus built-in functions,
  at-rules, pseudo-classes and pseudo-elements, HTML tags, and the variables,
  mixins, and functions defined in the current file.
- **Hover** — variable declarations, mixin/function signatures, Stylus
  built-in documentation, and CSS property documentation with MDN links.
- **Color swatches** — hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, and named
  colors, including usages of variables assigned a literal color. The color
  picker offers hex, RGB, and HSL presentations.
- **Signature help** — user mixins with declared parameters and Stylus
  built-ins with runtime-accurate signatures, tracking the active parameter
  across nested calls.
- **Navigation** — go-to-definition, find-references, and rename for
  variables, mixins, and functions. Resolution is scope-aware: it understands
  indentation-based visibility, shadowing, parameters, and loop variables,
  and rename preserves each occurrence's `$` style.

CSS data comes from `@vscode/web-custom-data`; Stylus built-in signatures are
read from the installed compiler's own sources. File-local symbols use a
resilient line-based index that keeps working while the document is broken
mid-edit. The server does not provide navigation, formatting, or lint rules.

```sh
npx stylus-language-server --stdio
```

This package is developed as part of
[stylus-zed](https://github.com/sf-yuzifu/stylus-zed).

## License

[MIT](LICENSE)
