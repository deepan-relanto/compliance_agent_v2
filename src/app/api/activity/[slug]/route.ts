import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getActivitySearchDirs(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "..", "activity"),
    path.resolve(cwd, "public", "activity"),
    path.resolve(cwd, "activity"),
  ];
}

function resolveActivityFile(rawSlug: string): string | null {
  const slug = decodeURIComponent(rawSlug).replace(/\.html$/, "");
  const searchDirs = getActivitySearchDirs();

  const isPromptEng =
    slug === "prompt-engineering" ||
    slug === "prompt_engineering" ||
    slug === "prompt-engineering-essentials";

  const candidateNames = isPromptEng
    ? [
        "prompt-engineering.html",
        "index.html",
        path.join("prompt-engineering", "index.html"),
        "prompt_engineering.html",
      ]
    : [`${slug}.html`, path.join(slug, "index.html"), `${slug}.htm`];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    for (const fileName of candidateNames) {
      const fullPath = path.join(dir, fileName);
      try {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          return fullPath;
        }
      } catch {
        /* skip */
      }
    }
  }

  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const filePath = resolveActivityFile(slug);

    if (!filePath) {
      return new NextResponse("Activity not found", { status: 404 });
    }

    let html = fs.readFileSync(filePath, "utf-8");

    // 1. Inject embed styles if not already present
    if (!html.includes(".app-header{display:none!important}")) {
      const embedCss = `
<style id="compliance-embed-style">
.app-header { display: none !important; }
body::before { top: 0 !important; }
.prog-bar { top: 0; position: sticky; }
.viewport { min-height: calc(100vh - 40px); }
</style>
`;
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${embedCss}\n</head>`);
      } else {
        html = `${embedCss}\n${html}`;
      }
    }

    // 2. Inject postMessage embed bridge if missing
    if (!html.includes("notifyParentComplete")) {
      const bridgeScript = `
<script id="compliance-embed-bridge">
function notifyParentComplete(totalScore) {
  try {
    window.parent.postMessage({
      type: 'ACTIVITY_COMPLETE',
      source: 'prompt-lab',
      score: totalScore,
      maxScore: 100
    }, '*');
  } catch (e) {}
}
</script>
`;
      if (html.includes("</body>")) {
        html = html.replace("</body>", `${bridgeScript}\n</body>`);
      } else {
        html = `${html}\n${bridgeScript}`;
      }
    }

    // 3. Inject auto-start to skip welcome screen if not already hooked
    if (!html.includes("/* Auto-start: skip welcome screen") && html.includes("startLab")) {
      const autoStartScript = `
<script id="compliance-embed-autostart">
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initDragDrop === 'function') initDragDrop();
  if (typeof initAct3 === 'function') initAct3();
  if (typeof startLab === 'function') startLab();
});
</script>
`;
      if (html.includes("</body>")) {
        html = html.replace("</body>", `${autoStartScript}\n</body>`);
      } else {
        html = `${html}\n${autoStartScript}`;
      }
    }

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load activity";
    return new NextResponse(message, { status: 500 });
  }
}
