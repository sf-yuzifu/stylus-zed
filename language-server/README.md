# Stylus Language Server

A diagnostics-only Language Server Protocol implementation backed by the
official [Stylus](https://github.com/stylus/stylus) compiler.

The server accepts `--stdio`, validates open documents after changes, and
publishes the first syntax or compiler error reported by Stylus. It does not
provide completion, hover, navigation, formatting, or lint rules.

```sh
npx stylus-language-server --stdio
```

This package is developed as part of
[stylus-zed](https://github.com/sf-yuzifu/stylus-zed).

## License

[MIT](LICENSE)
