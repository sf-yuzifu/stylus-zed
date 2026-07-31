import stylelint from "stylelint";

const SEVERITY = { error: 1, warning: 2 };
const SOURCE = "stylelint";

export const DEFAULT_STYLELINT_OPTIONS = {
  enable: "auto",
  config: undefined,
  configFile: undefined,
};

export function resolveStylelintOptions(initializationOptions) {
  const requested = initializationOptions?.stylelint;
  if (requested === undefined || requested === null) {
    return { ...DEFAULT_STYLELINT_OPTIONS };
  }
  if (typeof requested === "boolean") {
    return { ...DEFAULT_STYLELINT_OPTIONS, enable: requested };
  }
  if (typeof requested === "object") {
    return {
      enable: requested.enable ?? "auto",
      config: requested.config,
      configFile: requested.configFile,
    };
  }
  return { ...DEFAULT_STYLELINT_OPTIONS };
}

function toDiagnostic(warning) {
  const start = {
    line: Math.max(0, (warning.line ?? 1) - 1),
    character: Math.max(0, (warning.column ?? 1) - 1),
  };
  const end = warning.endLine
    ? {
        line: Math.max(0, warning.endLine - 1),
        character: Math.max(0, (warning.endColumn ?? warning.column ?? 1) - 1),
      }
    : start;

  return {
    range: { start, end },
    severity: SEVERITY[warning.severity] ?? 2,
    source: SOURCE,
    code: warning.rule,
    message: warning.text,
  };
}

export async function lintDocument(uri, text, options = DEFAULT_STYLELINT_OPTIONS) {
  if (options.enable === false) return [];

  const lintOptions = {
    code: text,
    codeFilename: uri.startsWith("file://") ? new URL(uri).pathname : undefined,
  };

  if (options.config) {
    lintOptions.config = {
      customSyntax: "postcss-styl",
      ...options.config,
    };
  } else if (options.configFile) {
    lintOptions.configFile = options.configFile;
  }

  let result;
  try {
    result = await stylelint.lint(lintOptions);
  } catch (error) {
    const message = String(error?.message ?? error);
    if (/No configuration|No stylelint config/i.test(message)) {
      return [];
    }
    if (!options.config && !options.configFile && /config/i.test(message)) {
      return [];
    }
    throw error;
  }

  const warnings = result.results?.[0]?.warnings ?? [];
  return warnings
    .filter((warning) => warning.rule !== "CssSyntaxError")
    .map(toDiagnostic);
}
