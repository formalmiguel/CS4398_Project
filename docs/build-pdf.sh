#!/usr/bin/env bash
#
# build-pdf.sh — render SRS-v2.md to a submission-ready PDF, with Mermaid diagrams.
#
#   Usage:   ./build-pdf.sh              # builds SRS-v2.md
#            ./build-pdf.sh OTHER.md     # builds a different markdown file
#
#   Output:  build/SRS-v2-CS4398.pdf
#
# WHY THIS EXISTS
#   Mermaid diagrams are code blocks in Markdown. Most Markdown-to-PDF exporters
#   do not render them — they emit the raw code, which is worse than no diagram.
#   This script pre-renders each diagram to SVG, inlines it, and prints with the
#   Chrome you already have. Nothing is downloaded at build time, so it cannot
#   break the night before the deadline because a plugin decided to update.
#
# REQUIREMENTS (all already present on this machine)
#   - Node.js + npx      (mermaid-cli and marked are fetched on first run, then cached)
#   - Google Chrome      (used headless to print; no separate Chromium download)
#
# SOURCE OF TRUTH
#   SRS-v2.md is the only file you edit. Everything under build/ is generated
#   and may be deleted at any time.
#
set -euo pipefail

SRC="${1:-SRS-v2.md}"
OUT_NAME="SRS-v2-CS4398"
BUILD="build"

# ---------------------------------------------------------------------------
# Environment detection.
#   This script runs under BOTH Git Bash and WSL, which disagree about
#   everything that matters here:
#       Git Bash : Windows drives are /c/...      , convert paths with cygpath
#       WSL      : Windows drives are /mnt/c/...  , convert paths with wslpath
#   Getting this wrong is why "no Chrome found" appears on a machine that
#   obviously has Chrome.
# ---------------------------------------------------------------------------
if command -v wslpath >/dev/null 2>&1; then
  ENVIRON="WSL";      WINROOT="/mnt/c"; to_win() { wslpath -w "$1"; }
elif command -v cygpath >/dev/null 2>&1; then
  ENVIRON="Git Bash"; WINROOT="/c";     to_win() { cygpath -w "$1"; }
else
  ENVIRON="POSIX";    WINROOT="/c";     to_win() { echo "$1"; }
fi

CHROME=""
for c in "$WINROOT/Program Files/Google/Chrome/Application/chrome.exe" \
         "$WINROOT/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
         "$WINROOT/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "$WINROOT/Program Files/Microsoft/Edge/Application/msedge.exe"; do
  [ -f "$c" ] && { CHROME="$c"; break; }
done

if [ ! -f "$SRC" ]; then
  echo "ERROR: '$SRC' not found. Run this from the folder that contains it:" >&2
  echo "       cd '$(dirname "$0")' && ./$(basename "$0")" >&2
  exit 1
fi
if [ -z "$CHROME" ]; then
  echo "ERROR: no Chrome or Edge found under $WINROOT/Program Files. (Detected environment: $ENVIRON)" >&2
  exit 1
fi
if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed in this shell. (Detected environment: $ENVIRON)" >&2
  echo "       Node may be installed on Windows but not inside WSL — they are separate." >&2
  echo "       Either install Node in WSL, or run this from Git Bash instead." >&2
  exit 1
fi

echo "==> Environment: $ENVIRON"
echo "==> Source:      $SRC"
mkdir -p "$BUILD"

# Reuse the installed Chrome instead of letting Puppeteer download its own Chromium.
export PUPPETEER_EXECUTABLE_PATH="$(to_win "$CHROME")"
export PUPPETEER_SKIP_DOWNLOAD=true
echo '{"args":["--no-sandbox"]}' > "$BUILD/puppeteer.json"

# 1. Render every Mermaid block to an SVG, and rewrite the Markdown to reference them.
echo "==> [1/4] Rendering Mermaid diagrams to SVG"
npx -y -p @mermaid-js/mermaid-cli mmdc \
    -i "$SRC" -o "$BUILD/$OUT_NAME.md" \
    -p "$BUILD/puppeteer.json" -b white 2>&1 | grep -E '✅|Found|ERROR' || true

# 2. Markdown -> HTML.
echo "==> [2/4] Converting Markdown to HTML"
( cd "$BUILD" && npx -y marked -i "$OUT_NAME.md" -o body.html )

# 3. Inline the SVGs and apply print styling.
echo "==> [3/4] Inlining diagrams and applying print CSS"
cat > "$BUILD/wrap.js" <<'NODE'
const fs = require('fs');
let body = fs.readFileSync('body.html', 'utf8');

// Inline each generated SVG so the PDF is fully self-contained.
let inlined = 0;
body = body.replace(/<img src="\.\/([^"]+\.svg)"[^>]*>/g, (m, f) => {
  try {
    let svg = fs.readFileSync(f, 'utf8').replace(/<\?xml[^>]*\?>/, '');
    inlined++;
    return '<div class="diagram">' + svg + '</div>';
  } catch (e) { return m; }
});

const css = `
@page { size: Letter; margin: 18mm 16mm 20mm 16mm; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.5; color: #111; }
h1 { font-size: 19pt; border-bottom: 2px solid #333; padding-bottom: 4px; margin-top: 0; page-break-before: always; }
h1:first-of-type { page-break-before: avoid; }
h2 { font-size: 14pt; margin-top: 1.3em; border-bottom: 1px solid #bbb; padding-bottom: 2px; }
h3 { font-size: 12pt; margin-top: 1.1em; }
h4 { font-size: 10.5pt; }
h1, h2, h3, h4 { page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; font-size: 8.5pt; margin: 8px 0; page-break-inside: avoid; }
th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #ececec; font-weight: bold; }
pre { background: #f7f7f7; border: 1px solid #ddd; padding: 8px; font-size: 7.5pt; line-height: 1.25;
      page-break-inside: avoid; white-space: pre; overflow: visible; }
code { font-family: Consolas, monospace; font-size: 9pt; background: #f2f2f2; padding: 1px 3px; }
pre code { background: none; padding: 0; font-size: 7.5pt; }
blockquote { border-left: 3px solid #777; margin-left: 0; padding: 2px 0 2px 12px; background: #fafafa; }
.diagram { text-align: center; page-break-inside: avoid; margin: 12px 0; }
.diagram svg { max-width: 100%; height: auto; }
li { margin: 2px 0; }
hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
`;

fs.writeFileSync('print.html',
  `<!doctype html><html><head><meta charset="utf-8">` +
  `<title>SRS — Adaptive Habit, Schedule &amp; Wellness System</title>` +
  `<style>${css}</style></head><body>${body}</body></html>`);

console.log('    diagrams inlined: ' + inlined);
if (inlined === 0) console.warn('    WARNING: no diagrams were inlined — check step 1.');
NODE
( cd "$BUILD" && node wrap.js )

# 4. Print to PDF with the installed Chrome.
#    --user-data-dir is not optional: without an isolated profile, headless Chrome
#    intermittently refuses to start when another Chrome is already running.
echo "==> [4/4] Printing PDF (with page numbers)"
BUILD_ABS="$(cd "$BUILD" && pwd)"
BUILD_WIN="$(to_win "$BUILD_ABS" | sed 's|\\|/|g')"   # chrome.exe wants a Windows path
PDF="$BUILD/$OUT_NAME.pdf"
rm -f "$PDF"

# We drive Chrome through Puppeteer rather than its command line, because
# `chrome --print-to-pdf` cannot produce a custom footer: it is all-or-nothing,
# and its default footer stamps the local file path onto every page. CSS cannot
# do it either — Chrome does not support @page margin boxes or counter(page).
# Puppeteer's footerTemplate is the only route to a clean "Page N of M".
npm install --silent --no-save --no-fund --no-audit --prefix "$BUILD" puppeteer-core >/dev/null 2>&1 || true

cat > "$BUILD/print.js" <<'NODE'
const puppeteer = require('puppeteer-core');
const FOOTER = `
<div style="width:100%;font-size:8pt;color:#555;font-family:Georgia,serif;
            padding:0 16mm;display:flex;justify-content:space-between;">
  <span>SRS — Adaptive Habit, Schedule &amp; Wellness System · CS 4398</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;
(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_EXE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.goto('file:///' + process.env.HTML_WIN, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: process.env.PDF_OUT,
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: FOOTER,
    margin: { top: '16mm', bottom: '20mm', left: '16mm', right: '16mm' },
  });
  await browser.close();
})().catch(e => { console.error('PUPPETEER_FAILED: ' + e.message); process.exit(2); });
NODE

set +e
CHROME_EXE="$(to_win "$CHROME")" \
HTML_WIN="${BUILD_WIN}/print.html" \
PDF_OUT="$PDF" \
NODE_PATH="$BUILD_ABS/node_modules" \
  node "$BUILD/print.js" 2>&1 | grep -v '^$'
PUPPETEER_RC=${PIPESTATUS[0]}
set -e

# Fallback: if Puppeteer could not drive Chrome (this can happen when Node runs in
# WSL but Chrome is a Windows binary), fall back to the plain CLI printer. The PDF
# is then produced WITHOUT page numbers, and we say so rather than pretend.
if [ ! -f "$PDF" ] || [ "$PUPPETEER_RC" -ne 0 ]; then
  echo "    (Puppeteer unavailable — falling back to Chrome CLI; PDF will have NO page numbers)"
  PROFILE_DIR="$BUILD_ABS/.chrome-profile"; mkdir -p "$PROFILE_DIR"
  "$CHROME" --headless=new --disable-gpu --no-first-run --no-pdf-header-footer \
            --user-data-dir="$(to_win "$PROFILE_DIR")" \
            --print-to-pdf="${BUILD_WIN}/${OUT_NAME}.pdf" \
            "file:///${BUILD_WIN}/print.html" 2>&1 \
    | grep -viE 'devtools|bluetooth|voice|registration|gpu|Fontconfig' || true
  for _ in 1 2 3 4 5; do [ -f "$PDF" ] && break; sleep 1; done
  rm -rf "$PROFILE_DIR" 2>/dev/null || true
  NUMBERED="no — see message above"
else
  NUMBERED="yes"
fi

if [ ! -f "$PDF" ]; then
  echo "ERROR: PDF was not produced. Open $BUILD/print.html in Chrome and print manually." >&2
  exit 1
fi

PAGES="?"
if command -v pdftotext >/dev/null 2>&1; then
  PAGES=$(pdftotext -layout "$PDF" - 2>/dev/null | tr -cd '\f' | wc -c | tr -d ' ')
fi

echo
echo "    ✅ $PDF   (${PAGES} pages, page numbers: ${NUMBERED})"
echo
echo "    Sanity-check before submitting:"
echo "      - the four diagrams appear as PICTURES, not code"
echo "      - a 'Page N of M' footer is on every page"
echo "      - no table is split across a page break mid-row"
echo "      - the Index cites section numbers (§3.8.4), not page numbers — deliberate"
