import namedColors from "color-name";

const NAMED = new Map(Object.entries(namedColors));

export function isNamedColor(word) {
  return NAMED.has(word.toLowerCase());
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function makeColor(red, green, blue, alpha = 1) {
  return {
    red: clamp01(red),
    green: clamp01(green),
    blue: clamp01(blue),
    alpha: clamp01(alpha),
  };
}

function parseHex(text) {
  const hex = text.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

  let parts;
  if (hex.length === 3 || hex.length === 4) {
    parts = [...hex].map((char) => parseInt(char + char, 16));
  } else if (hex.length === 6 || hex.length === 8) {
    parts = [];
    for (let i = 0; i < hex.length; i += 2) {
      parts.push(parseInt(hex.slice(i, i + 2), 16));
    }
  } else {
    return null;
  }

  const [red, green, blue, alpha = 255] = parts;
  return makeColor(red / 255, green / 255, blue / 255, alpha / 255);
}

function parseChannel(text) {
  const trimmed = text.trim();
  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed);
    return Number.isNaN(percent) ? null : percent / 100;
  }
  const value = Number.parseFloat(trimmed);
  return Number.isNaN(value) ? null : value / 255;
}

function parseAlpha(text) {
  const trimmed = text.trim();
  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed);
    return Number.isNaN(percent) ? null : percent / 100;
  }
  const value = Number.parseFloat(trimmed);
  return Number.isNaN(value) ? null : value;
}

function parseHue(text) {
  const trimmed = text.trim().toLowerCase();
  const value = Number.parseFloat(trimmed);
  if (Number.isNaN(value)) return null;
  if (trimmed.endsWith("turn")) return value * 360;
  if (trimmed.endsWith("rad")) return (value * 180) / Math.PI;
  if (trimmed.endsWith("grad")) return value * 0.9;
  return value;
}

function parsePercent(text) {
  const trimmed = text.trim();
  if (!trimmed.endsWith("%")) return null;
  const value = Number.parseFloat(trimmed);
  return Number.isNaN(value) ? null : value / 100;
}

function splitArgs(source) {
  const normalized = source.replace(/\s*\/\s*/, " / ");
  if (normalized.includes(",")) {
    return normalized.split(",").map((part) => part.trim());
  }
  return normalized.split(/\s+/).filter((part) => part.length > 0);
}

function parseRgb(name, argsSource) {
  const args = splitArgs(argsSource).filter((part) => part !== "/");
  if (args.length < 3 || args.length > 4) return null;
  if (name === "rgb" && argsSource.includes(",") && args.length === 4) {
    // rgba() with commas is valid; rgb() with 4 comma args is handled by CSS too,
    // but Stylus treats rgb() with alpha through rgba(). Accept both.
  }

  const channels = args.slice(0, 3).map(parseChannel);
  if (channels.some((channel) => channel === null)) return null;
  const alpha = args.length === 4 ? parseAlpha(args[3]) : 1;
  if (alpha === null) return null;

  return makeColor(channels[0], channels[1], channels[2], alpha);
}

function hslToRgb(hue, saturation, lightness) {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = clamp01(saturation);
  const l = clamp01(lightness);

  if (s === 0) return [l, l, l];

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const convert = (t0) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return [convert(h + 1 / 3), convert(h), convert(h - 1 / 3)];
}

function parseHsl(name, argsSource) {
  const args = splitArgs(argsSource).filter((part) => part !== "/");
  if (args.length < 3 || args.length > 4) return null;

  const hue = parseHue(args[0]);
  const saturation = parsePercent(args[1]);
  const lightness = parsePercent(args[2]);
  if (hue === null || saturation === null || lightness === null) return null;
  const alpha = args.length === 4 ? parseAlpha(args[3]) : 1;
  if (alpha === null) return null;

  const [red, green, blue] = hslToRgb(hue, saturation, lightness);
  return makeColor(red, green, blue, alpha);
}

export function parseColor(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("#")) return parseHex(trimmed);

  const fnMatch = /^(rgba?|hsla?)\((.*)\)$/is.exec(trimmed);
  if (fnMatch) {
    const name = fnMatch[1].toLowerCase();
    const args = fnMatch[2];
    return name.startsWith("rgb") ? parseRgb(name, args) : parseHsl(name, args);
  }

  const named = NAMED.get(trimmed.toLowerCase());
  if (named) {
    return makeColor(named[0] / 255, named[1] / 255, named[2] / 255);
  }

  return null;
}

function to255(channel) {
  return Math.round(clamp01(channel) * 255);
}

function hexPart(value) {
  return to255(value).toString(16).padStart(2, "0");
}

export function formatHex(color) {
  const base = `#${hexPart(color.red)}${hexPart(color.green)}${hexPart(color.blue)}`;
  if (color.alpha >= 1) return base;
  return `${base}${hexPart(color.alpha)}`;
}

export function formatRgb(color) {
  const red = to255(color.red);
  const green = to255(color.green);
  const blue = to255(color.blue);
  if (color.alpha >= 1) return `rgb(${red}, ${green}, ${blue})`;
  const alpha = Math.round(color.alpha * 1000) / 1000;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function rgbToHsl(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) return [0, 0, lightness];

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue;
  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
  }
  return [hue * 60, saturation, lightness];
}

export function formatHsl(color) {
  const [hue, saturation, lightness] = rgbToHsl(
    clamp01(color.red),
    clamp01(color.green),
    clamp01(color.blue),
  );
  const h = Math.round(hue);
  const s = Math.round(saturation * 100);
  const l = Math.round(lightness * 100);
  if (color.alpha >= 1) return `hsl(${h}, ${s}%, ${l}%)`;
  const alpha = Math.round(color.alpha * 1000) / 1000;
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}
