#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = {
    baseUrl: "http://127.0.0.1:4173",
    outDir: "",
    timeoutMs: 120_000,
    sceneOnly: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--base-url") {
      args.baseUrl = argv[index + 1] ?? args.baseUrl;
      index += 1;
      continue;
    }
    if (token === "--out-dir") {
      args.outDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--timeout-ms") {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.timeoutMs = Math.floor(parsed);
      }
      index += 1;
      continue;
    }
    if (token === "--scene-only") {
      args.sceneOnly = true;
      continue;
    }
  }

  if (!args.outDir) {
    throw new Error("Missing required --out-dir <path>.");
  }

  return args;
}

async function isChecked(locator) {
  try {
    return await locator.isChecked();
  } catch {
    return false;
  }
}

async function pressAltDigit(page, digit) {
  await page.keyboard.down("Alt");
  await page.keyboard.press(String(digit));
  await page.keyboard.up("Alt");
}

async function maybeDismissFirstRunModal(page) {
  const candidates = [/^Skip$/i, /^Dismiss$/i, /^Show Help$/i];
  for (const pattern of candidates) {
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 2_000 }).catch(() => undefined);
      await page.waitForTimeout(350);
    }
  }
}

async function captureScenarioShot(page, screenshotsDir, id, slug, notes, records) {
  const fileName = `${id}-${slug}.png`;
  const filePath = path.join(screenshotsDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  records.push({
    id,
    file: fileName,
    notes
  });
}

function extractNumeric(hudText, regex) {
  const match = hudText.match(regex);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

async function extractMetrics(page) {
  const hud = page.locator("section.debug-hud");
  if (!(await hud.isVisible().catch(() => false))) {
    return null;
  }

  const text = await hud.innerText();
  return {
    fps: extractNumeric(text, /FPS:\s*([0-9.]+)/i),
    frameP95Ms: extractNumeric(text, /Frame p95:\s*([0-9.]+)/i),
    hotspotPercent: extractNumeric(text, /\(([0-9.]+)%\)/i),
    drawCalls: extractNumeric(text, /Draw calls:\s*([0-9.]+)/i),
    triangles: extractNumeric(text, /Triangles:\s*([0-9.]+)/i)
  };
}

async function renameWalkthroughVideo(walkthroughDir) {
  const files = await readdir(walkthroughDir);
  const candidates = [];

  for (const file of files) {
    if (!file.endsWith(".webm")) {
      continue;
    }
    const fullPath = path.join(walkthroughDir, file);
    const info = await stat(fullPath);
    candidates.push({
      file,
      fullPath,
      mtimeMs: info.mtimeMs
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const source = candidates[0];
  const targetPath = path.join(walkthroughDir, "baseline-walkthrough.webm");
  if (source.fullPath !== targetPath) {
    await rename(source.fullPath, targetPath);
  }
  return path.basename(targetPath);
}

async function runAgentBrowser(args, commandLog) {
  const commandLine = `agent-browser ${args.map((part) => JSON.stringify(part)).join(" ")}`;
  commandLog.push(commandLine);
  try {
    const { stdout, stderr } = await execFileAsync("agent-browser", args, {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024
    });
    if (stdout?.trim()) {
      commandLog.push(stdout.trim());
    }
    if (stderr?.trim()) {
      commandLog.push(`[stderr] ${stderr.trim()}`);
    }
    return stdout ?? "";
  } catch (error) {
    const details =
      error instanceof Error && "stderr" in error && typeof error.stderr === "string"
        ? `${error.message}\n${error.stderr}`
        : error instanceof Error
          ? error.message
          : String(error);
    commandLog.push(`[error] ${details}`);
    throw error;
  }
}

function sanitizeAgentBrowserOutput(raw) {
  return raw
    .replace(/\u2713\s*/g, "")
    .replace(/^Done$/gim, "")
    .trim();
}

async function runSceneOnlyCaptureWithAgentBrowser({ baseUrl, outDir }) {
  const screenshotsDir = path.join(outDir, "screenshots");
  const walkthroughDir = path.join(outDir, "walkthrough");
  const runtimeDefectsPath = path.join(outDir, "runtime-defects.md");
  const summaryPath = path.join(outDir, "capture-summary.json");
  const commandLogPath = path.join(outDir, "command-log.txt");

  await mkdir(screenshotsDir, { recursive: true });
  await mkdir(walkthroughDir, { recursive: true });

  const session = `scene-only-${Date.now().toString(36)}`;
  const commandLog = [];
  const screenshots = [];

  const hideOverlayEval = `(() => {
    const root = document.querySelector('.overlay-root');
    if (!root) return 'overlay-missing';
    root.setAttribute('data-scene-capture-hidden', '1');
    root.style.visibility = 'hidden';
    return 'overlay-hidden';
  })()`;
  const showOverlayEval = `(() => {
    const root = document.querySelector('.overlay-root');
    if (!root) return 'overlay-missing';
    if (root.getAttribute('data-scene-capture-hidden') === '1') {
      root.style.visibility = '';
      root.removeAttribute('data-scene-capture-hidden');
    }
    return 'overlay-shown';
  })()`;

  const captureSceneShot = async (id, slug, notes) => {
    const fileName = `${id}-${slug}.png`;
    const filePath = path.join(screenshotsDir, fileName);
    await runAgentBrowser(["--session", session, "eval", hideOverlayEval], commandLog);
    await runAgentBrowser(["--session", session, "wait", "150"], commandLog);
    await runAgentBrowser(["--session", session, "screenshot", filePath], commandLog);
    await runAgentBrowser(["--session", session, "eval", showOverlayEval], commandLog);
    screenshots.push({ id, file: fileName, notes });
  };

  try {
    await runAgentBrowser(["--session", session, "open", baseUrl], commandLog);
    await runAgentBrowser(["--session", session, "wait", "4500"], commandLog);
    await runAgentBrowser(["--session", session, "errors", "--clear"], commandLog);
    await runAgentBrowser(["--session", session, "console", "--clear"], commandLog);
    await runAgentBrowser(["--session", session, "press", "Escape"], commandLog);
    await runAgentBrowser(["--session", session, "press", "Alt+0"], commandLog);
    await runAgentBrowser(["--session", session, "wait", "500"], commandLog);

    await captureSceneShot("VQA-01", "scene-only-default-view", "Default scene framing without overlay chrome.");

    await runAgentBrowser(
      [
        "--session",
        session,
        "eval",
        `(() => {
          const btn = document.querySelector('button.event-feed-item');
          if (!btn) return 'missing-event-item';
          btn.click();
          return 'clicked-event-0';
        })()`
      ],
      commandLog
    );
    await runAgentBrowser(["--session", session, "wait", "800"], commandLog);
    await captureSceneShot(
      "VQA-02",
      "scene-only-camera-focus",
      "Scene-only framing after deterministic event-feed focus."
    );

    await runAgentBrowser(
      [
        "--session",
        session,
        "eval",
        `(() => {
          const canvas = document.querySelector('canvas');
          if (!canvas) return 'missing-canvas';
          const rect = canvas.getBoundingClientRect();
          const points = [
            [rect.left + rect.width * 0.58, rect.top + rect.height * 0.72],
            [rect.left + rect.width * 0.42, rect.top + rect.height * 0.58]
          ];
          for (const [x, y] of points) {
            const target = document.elementFromPoint(x, y) ?? canvas;
            target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0 }));
            target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, button: 0 }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, button: 0 }));
          }
          return 'canvas-clicks-dispatched';
        })()`
      ],
      commandLog
    );
    await runAgentBrowser(["--session", session, "wait", "450"], commandLog);
    await captureSceneShot(
      "VQA-03",
      "scene-only-navigation",
      "Scene-only framing after deterministic canvas navigation clicks."
    );

    const pageErrors = sanitizeAgentBrowserOutput(
      await runAgentBrowser(["--session", session, "errors"], commandLog)
    );
    const consoleOutput = sanitizeAgentBrowserOutput(
      await runAgentBrowser(["--session", session, "console"], commandLog)
    );

    const runtimeDefectLines = [
      "# Runtime Defects",
      "",
      "## Capture mode",
      "- scene-only via `agent-browser`",
      "",
      "## Page Errors",
      pageErrors.length > 0 ? pageErrors : "No page errors captured.",
      "",
      "## Console Output",
      consoleOutput.length > 0 ? consoleOutput : "No console warnings/errors captured.",
      ""
    ];
    await writeFile(runtimeDefectsPath, `${runtimeDefectLines.join("\n")}`);

    const summary = {
      baseUrl,
      sceneOnly: true,
      capturedAt: new Date().toISOString(),
      screenshots,
      walkthrough: null,
      metrics: null
    };
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(commandLogPath, `${commandLog.join("\n")}\n`);
  } finally {
    await runAgentBrowser(["--session", session, "close"], commandLog).catch(() => undefined);
  }
}

async function main() {
  const { baseUrl, outDir, timeoutMs, sceneOnly } = parseArgs(process.argv);
  const screenshotsDir = path.join(outDir, "screenshots");
  const walkthroughDir = path.join(outDir, "walkthrough");
  const runtimeDefectsPath = path.join(outDir, "runtime-defects.md");
  const summaryPath = path.join(outDir, "capture-summary.json");

  await mkdir(screenshotsDir, { recursive: true });
  await mkdir(walkthroughDir, { recursive: true });

  if (sceneOnly) {
    await runSceneOnlyCaptureWithAgentBrowser({ baseUrl, outDir });
    const summaryEcho = await readFile(summaryPath, "utf8");
    process.stdout.write(summaryEcho);
    return;
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright is not available. Run with `npx -p playwright@1.51.0 node <script>`."
    );
  }

  const consoleDefects = [];
  const pageErrors = [];
  const screenshots = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: walkthroughDir,
      size: { width: 1280, height: 720 }
    }
  });
  const page = await context.newPage();

  page.on("console", (message) => {
    const type = message.type();
    if (type === "error" || type === "warning") {
      consoleDefects.push(`[${type}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: timeoutMs });
  } catch {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  }

  await page.waitForTimeout(4_500);
  await maybeDismissFirstRunModal(page);
  await page.keyboard.press("Escape");
  await pressAltDigit(page, "0");
  await page.waitForTimeout(500);

  await captureScenarioShot(
    page,
    screenshotsDir,
    "VQA-01",
    "hitbox-target-resolution",
    "Baseline idle view with clear focus.",
    screenshots
  );

  await pressAltDigit(page, "1");
  await page.waitForTimeout(500);
  const eventItems = page.locator("button.event-feed-item");
  const eventCount = await eventItems.count();
  if (eventCount > 0) {
    await eventItems.first().click({ timeout: 5_000 });
    await page.waitForTimeout(900);
  }

  await captureScenarioShot(
    page,
    screenshotsDir,
    "VQA-02",
    "camera-focus-panel-anchor",
    "POI focus transition triggered from Event Feed.",
    screenshots
  );

  if (eventCount > 1) {
    await eventItems.nth(1).click({ timeout: 5_000 });
    await page.waitForTimeout(700);
    await eventItems.first().click({ timeout: 5_000 });
    await page.waitForTimeout(700);
  }
  await captureScenarioShot(
    page,
    screenshotsDir,
    "VQA-03",
    "highlight-lifecycle",
    "Focus switched across events to exercise highlight reset/reapply behavior.",
    screenshots
  );

  await pressAltDigit(page, "1");
  await page.waitForTimeout(350);
  const maxClicks = Math.min(await eventItems.count(), 5);
  for (let index = 0; index < maxClicks; index += 1) {
    await eventItems.nth(index).click({ timeout: 5_000 });
    await page.waitForTimeout(450);
    const agentInspectorVisible = await page
      .getByRole("heading", { name: "Agent Inspector" })
      .first()
      .isVisible()
      .catch(() => false);
    if (agentInspectorVisible) {
      break;
    }
  }
  await captureScenarioShot(
    page,
    screenshotsDir,
    "VQA-04",
    "event-feed-linkage",
    "Event feed click linkage to focused context panels.",
    screenshots
  );

  const enableHud = page.locator("label.debug-toggle:has-text('Enable dev HUD') input[type='checkbox']").first();
  if ((await enableHud.count()) > 0 && !(await isChecked(enableHud))) {
    await enableHud.click({ force: true });
    await page.waitForTimeout(250);
  }

  for (const label of ["Path nodes overlay", "Blocked cells overlay", "Anchor issue overlay"]) {
    const checkbox = page.locator(
      `label.debug-toggle:has-text("${label}") input[type='checkbox']`
    ).first();
    if ((await checkbox.count()) > 0 && !(await isChecked(checkbox))) {
      await checkbox.click({ force: true });
      await page.waitForTimeout(200);
    }
  }

  const canvas = page.locator("canvas").first();
  if ((await canvas.count()) > 0) {
    const bounds = await canvas.boundingBox();
    if (bounds) {
      await page.mouse.click(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.72);
      await page.waitForTimeout(450);
      await page.mouse.click(bounds.x + bounds.width * 0.42, bounds.y + bounds.height * 0.58);
      await page.waitForTimeout(450);
    }
  }

  await captureScenarioShot(
    page,
    screenshotsDir,
    "VQA-05",
    "navigation-debug-overlays",
    "Debug HUD overlay toggles with navigation interaction.",
    screenshots
  );

  await pressAltDigit(page, "5");
  await page.waitForTimeout(500);
  await captureScenarioShot(
    page,
    screenshotsDir,
    "VQA-06",
    "agent-inspector",
    "Agent Inspector panel state snapshot.",
    screenshots
  );

  const metrics = await extractMetrics(page);

  await context.close();
  await browser.close();

  const walkthroughFile = await renameWalkthroughVideo(walkthroughDir);

  const runtimeDefectLines = [
    "# Runtime Defects",
    "",
    ...(pageErrors.length > 0 ? ["## Page Errors", ...pageErrors.map((line) => `- ${line}`), ""] : []),
    ...(consoleDefects.length > 0
      ? ["## Console Warnings/Errors", ...consoleDefects.map((line) => `- ${line}`), ""]
      : []),
    ...(pageErrors.length === 0 && consoleDefects.length === 0
      ? ["No runtime console/page defects captured during baseline run.", ""]
      : [])
  ];
  await writeFile(runtimeDefectsPath, `${runtimeDefectLines.join("\n")}`);

  const summary = {
    baseUrl,
    capturedAt: new Date().toISOString(),
    screenshots,
    walkthrough: walkthroughFile ? path.join("walkthrough", walkthroughFile) : null,
    metrics
  };
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  const summaryEcho = await readFile(summaryPath, "utf8");
  process.stdout.write(summaryEcho);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
