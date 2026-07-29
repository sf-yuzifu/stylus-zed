import "stylus";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const stylusFunctions = require("stylus/lib/functions/index.js");
const stylusUtils = require("stylus/lib/utils.js");

const CURATED = {
  abs: ["abs(n)", "Returns the absolute value of n."],
  min: ["min(a, b)", "Returns the smaller of a and b."],
  max: ["max(a, b)", "Returns the larger of a and b."],
  ceil: ["ceil(n, precision = 0)", "Rounds n up to the given precision."],
  floor: ["floor(n, precision = 0)", "Rounds n down to the given precision."],
  round: ["round(n, precision = 0)", "Rounds n to the given precision."],
  sum: ["sum(nums)", "Returns the sum of the list nums."],
  avg: ["avg(nums)", "Returns the average of the list nums."],
  percentage: ["percentage(num)", "Converts a unitless number to a percentage."],
  "percent-to-decimal": ["percent-to-decimal(n)", "Converts 50% to 0.5."],
  odd: ["odd(n)", "Whether n is odd (works on % units)."],
  even: ["even(n)", "Whether n is even (works on % units)."],
  sin: ["sin(n)", "Sine of the given angle."],
  cos: ["cos(n)", "Cosine of the given angle."],
  tan: ["tan(n)", "Tangent of the given angle."],
  asin: ["asin(n)", "Arc sine of n."],
  acos: ["acos(n)", "Arc cosine of n."],
  atan: ["atan(n)", "Arc tangent of n."],
  "radians-to-degrees": ["radians-to-degrees(angle)", "Converts radians to degrees."],
  "degrees-to-radians": ["degrees-to-radians(angle)", "Converts degrees to radians."],
  math: ["math(n, method)", "Performs the given Math method on n."],
  "base-convert": ["base-convert(num, base, width)", "Converts num to another base."],
  light: ["light(color)", "Whether the color is light (lightness >= 50%)."],
  dark: ["dark(color)", "Whether the color is dark (lightness < 50%)."],
  lighten: ["lighten(color, amount)", "Lightens color by amount."],
  darken: ["darken(color, amount)", "Darkens color by amount."],
  saturate: ["saturate(color = '', amount = 100%)", "Saturates color by amount."],
  desaturate: ["desaturate(color, amount)", "Desaturates color by amount."],
  "fade-in": ["fade-in(color, amount)", "Increases the alpha of color by amount."],
  "fade-out": ["fade-out(color, amount)", "Decreases the alpha of color by amount."],
  spin: ["spin(color, amount)", "Rotates the hue of color by amount."],
  mix: ["mix(color1, color2, weight = 50%)", "Mixes two colors by weight."],
  invert: ["invert(color = '')", "Inverts red, green and blue channels."],
  complement: ["complement(color)", "Returns the complementary color."],
  grayscale: ["grayscale(color = '')", "Removes all saturation from color."],
  tint: ["tint(color, percent)", "Mixes color with white by percent."],
  shade: ["shade(color, percent)", "Mixes color with black by percent."],
  adjust: ["adjust(color, prop, amount)", "Adjusts a hue/saturation/lightness/alpha channel."],
  hue: ["hue(color[, value])", "Gets or sets the hue channel."],
  saturation: ["saturation(color[, value])", "Gets or sets the saturation channel."],
  lightness: ["lightness(color[, value])", "Gets or sets the lightness channel."],
  alpha: ["alpha(color[, value])", "Gets or sets the alpha channel."],
  red: ["red(color[, value])", "Gets or sets the red channel."],
  green: ["green(color[, value])", "Gets or sets the green channel."],
  blue: ["blue(color[, value])", "Gets or sets the blue channel."],
  luminosity: ["luminosity(color)", "Returns the relative luminance of color."],
  contrast: ["contrast([top[, bottom]])", "Returns a contrasting color pair."],
  blend: ["blend(top[, bottom])", "Blends two colors like a layer mode."],
  transparentify: ["transparentify(top[, bottom[, alpha]])", "Computes the alpha needed over a background."],
  component: ["component(color, name)", "Returns a named channel of color."],
  rgb: ["rgb(r, g, b)", "Creates a color from red, green and blue."],
  rgba: ["rgba(r, g, b, a | color, alpha)", "Creates a color with an alpha channel."],
  hsl: ["hsl(h, s, l)", "Creates a color from hue, saturation and lightness."],
  hsla: ["hsla(h, s, l, a | color, alpha)", "Creates an HSL color with alpha."],
  unit: ["unit(n[, type])", "Returns n with the given unit type."],
  "remove-unit": ["remove-unit(n)", "Strips the unit from n."],
  unquote: ["unquote(str)", "Returns str without quotes."],
  s: ["s(format, args...)", "sprintf-style string formatting."],
  "list-separator": ["list-separator(list)", "Returns the list separator (, or space)."],
  length: ["length(expr)", "Returns the number of nodes in an expression."],
  push: ["push(list, args...)", "Appends values to list."],
  append: ["append(list, args...)", "Alias of push."],
  prepend: ["prepend(list, args...)", "Prepends values to list."],
  unshift: ["unshift(list, args...)", "Alias of prepend."],
  pop: ["pop(list)", "Removes and returns the last item."],
  shift: ["shift(list)", "Removes and returns the first item."],
  slice: ["slice(list, start[, end])", "Returns a sub-list."],
  index: ["index(list, value)", "Returns the index of value in list."],
  last: ["last(expr)", "Returns the last node of an expression."],
  keys: ["keys(pairs)", "Returns the keys of a hash."],
  values: ["values(pairs)", "Returns the values of a hash."],
  join: ["join(delim, vals...)", "Joins values with a delimiter."],
  split: ["split(delim, val)", "Splits val by delimiter."],
  substr: ["substr(val, start[, length])", "Returns a substring."],
  replace: ["replace(pattern, val[, repl])", "Replaces pattern matches in val."],
  match: ["match(pattern, val[, flags])", "Matches val against a pattern."],
  type: ["type(node)", "Returns the node type."],
  typeof: ["typeof(node)", "Alias of type."],
  "type-of": ["type-of(node)", "Alias of type."],
  range: ["range(start, stop[, step])", "Returns a list of numbers."],
  lookup: ["lookup(name)", "Looks up a variable by dynamic name."],
  clone: ["clone(object)", "Deep-copies a hash."],
  merge: ["merge(object, ...objects)", "Merges hashes."],
  remove: ["remove(object, key)", "Removes a key from a hash."],
  json: ["json(path[, options])", "Imports a JSON file as Stylus values."],
  use: ["use(path[, options])", "Loads a Stylus plugin."],
  define: ["define(name, expr[, global])", "Defines a variable from a plugin."],
  "image-size": ["image-size(path)", "Returns width and height of an image."],
  "opposite-position": ["opposite-position(positions)", "Returns the opposite positions."],
  selector: ["selector()", "Returns the current compiled selector."],
  selectors: ["selectors()", "Returns the current selector stack."],
  "selector-exists": ["selector-exists(sel)", "Whether the selector exists."],
  "current-media": ["current-media()", "Returns the current @media query string."],
  "add-property": ["add-property(name, expr)", "Adds a property to the nearest block (plugins)."],
  "prefix-classes": ["prefix-classes(prefix)", "Prefixes class selectors."],
  operate: ["operate(op, left, right)", "Performs a binary operation."],
  extend: ["extend(dest, ...sources)", "Assigns properties of sources to dest."],
  convert: ["convert(str)", "Evaluates a Stylus string into a value."],
  basename: ["basename(path[, ext])", "Returns the basename of path."],
  dirname: ["dirname(path)", "Returns the dirname of path."],
  extname: ["extname(path)", "Returns the extension of path."],
  pathjoin: ["pathjoin(...paths)", "Joins path segments."],
  warn: ["warn(msg)", "Prints a warning without stopping."],
  error: ["error(msg)", "Throws with the given message."],
  trace: ["trace()", "Prints the current Stylus stack trace."],
  p: ["p(...args)", "Debug-prints values and returns them."],
};

const INTERNAL = new Set(["cache", "p", "trace"]);

function isInternal(name) {
  return name.startsWith("-") || name.startsWith("require-") || INTERNAL.has(name);
}

function stylusDefinedSignatures() {
  const path = require.resolve("stylus/lib/functions/index.styl");
  const source = readFileSync(path, "utf8");
  const signatures = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = /^([a-zA-Z][\w-]*)\(([^)]*)\)/.exec(line);
    if (match && !isInternal(match[1])) {
      signatures.set(match[1], `${match[1]}(${match[2]})`);
    }
  }
  return signatures;
}

function jsDefinedSignatures() {
  const signatures = new Map();
  for (const [name, fn] of Object.entries(stylusFunctions)) {
    if (isInternal(name) || typeof fn !== "function") continue;
    let params = [];
    try {
      params = stylusUtils
        .params(fn)
        .filter((param) => param && param !== "fn" && param !== "raw");
    } catch {
      params = [];
    }
    signatures.set(name, `${name}(${params.join(", ")})`);
  }
  return signatures;
}

function buildBuiltins() {
  const builtins = new Map();

  for (const [name, signature] of jsDefinedSignatures()) {
    builtins.set(name, { name, signature });
  }
  for (const [name, signature] of stylusDefinedSignatures()) {
    builtins.set(name, { name, signature });
  }

  for (const [name, [signature, description]] of Object.entries(CURATED)) {
    const existing = builtins.get(name);
    if (existing) {
      existing.signature = signature;
      existing.description = description;
    } else {
      builtins.set(name, { name, signature, description });
    }
  }

  return builtins;
}

const BUILTINS = buildBuiltins();

export function getBuiltin(name) {
  return BUILTINS.get(name);
}

export function listBuiltins() {
  return [...BUILTINS.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
}
