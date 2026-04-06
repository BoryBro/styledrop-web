import fs from "fs";
import path from "path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const routePath = path.join(root, "src/app/api/generate/route.ts");
const stylesPath = path.join(root, "src/lib/styles.ts");
const outDir = path.join(root, "src/lib/styles/general-card-prompts");

function extractObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Marker not found: ${marker}`);

  const braceStart = source.indexOf("{", markerIndex);
  if (braceStart === -1) throw new Error(`Opening brace not found: ${marker}`);

  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    const prev = source[i - 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (prev === "*" && ch === "/") blockComment = false;
      continue;
    }

    if (quote) {
      if (ch === quote && prev !== "\\") quote = null;
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }

  throw new Error(`Failed to extract object for: ${marker}`);
}

function extractTemplateConstant(source, name) {
  const startMarker = `const ${name} = \``;
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Template constant not found: ${name}`);

  const contentStart = start + startMarker.length;
  const end = source.indexOf("`;", contentStart);
  if (end === -1) throw new Error(`Template constant end not found: ${name}`);

  return source.slice(contentStart, end);
}

const routeSource = fs.readFileSync(routePath, "utf8");
const stylesSource = fs.readFileSync(stylesPath, "utf8");

const sharedScope = {
  STRICT_IDENTITY_LOCK: extractTemplateConstant(routeSource, "STRICT_IDENTITY_LOCK"),
  SELFIE_REALISM_LOCK: extractTemplateConstant(routeSource, "SELFIE_REALISM_LOCK"),
  HUMOR_REALISM_LOCK: extractTemplateConstant(routeSource, "HUMOR_REALISM_LOCK"),
};

const stylePromptsText = extractObject(routeSource, "const STYLE_PROMPTS");
const stylePrompts = Function(
  ...Object.keys(sharedScope),
  `return (${stylePromptsText});`
)(...Object.values(sharedScope));

const styles = [...stylesSource.matchAll(/id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"/g)].map((match) => ({
  id: match[1],
  name: match[2],
}));

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const summary = [];

for (const style of styles) {
  const variants = stylePrompts[style.id];
  if (!variants) continue;

  const lines = [
    `필터명: ${style.name}`,
    `스타일 ID: ${style.id}`,
    `소스: src/app/api/generate/route.ts -> STYLE_PROMPTS["${style.id}"]`,
    "",
  ];

  for (const [variant, prompt] of Object.entries(variants)) {
    lines.push(`===== VARIANT: ${variant} =====`);
    lines.push("");
    lines.push(String(prompt).replace(/\\n/g, "\n"));
    lines.push("");
  }

  const filename = `${style.id}.txt`;
  fs.writeFileSync(path.join(outDir, filename), `${lines.join("\n").trimEnd()}\n`);
  summary.push(`- ${style.name} (${style.id}) -> ${filename}`);
}

const readme = [
  "General Card Prompt Exports",
  "",
  "- Source: src/app/api/generate/route.ts",
  "- Each txt file contains the filter name, style id, and actual prompt content.",
  "- Styles with variants are grouped into one file with variant sections.",
  "",
  "Files",
  ...summary,
  "",
].join("\n");

fs.writeFileSync(path.join(outDir, "README.txt"), `${readme}\n`);
console.log(`Generated ${summary.length} prompt files in ${outDir}`);
