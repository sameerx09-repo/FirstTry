import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { makeZip } from "../../apps/api/src/bundles";
const password = "FirstTry-local-2026!";
async function login(page: any, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    email.startsWith("admin") ? /\/admin$/ : /\/developer$/,
  );
}
async function launch(page: any, name: string) {
  await page
    .locator(".app-row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Try", exact: true })
    .click();
  await expect(page.getByTitle(name + " playable preview")).toBeVisible();
  return page.frameLocator("iframe");
}
async function close(page: any) {
  await page
    .getByRole("button", { name: "Close mini-app", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip for now" }).click();
}
test("consumer discovers, saves, plays and submits feedback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect
    .poll(() => page.locator(".app-row").count())
    .toBeGreaterThanOrEqual(6);
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({
    path: "output/playwright/discover-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".app-row")
    .filter({ hasText: "Color Clash" })
    .getByRole("button")
    .first()
    .click();
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await page.getByRole("button", { name: "Back to discover" }).click();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    page.locator(".app-row").filter({ hasText: "Color Clash" }),
  ).toHaveCount(1);
  const game = await launch(page, "Color Clash");
  await expect(
    game.getByText("Match the COLOR", { exact: true }),
  ).toBeVisible();
  await game.getByRole("button", { name: "BLUE", exact: true }).click();
  await expect(game.locator("#score")).toHaveText(/Score \d/);
  await page.screenshot({
    path: "output/playwright/color-clash-player.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close mini-app" }).click();
  await page.getByLabel("Feedback", { exact: true }).fill("A fun little break");
  await page
    .getByRole("button", { name: "Send feedback", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Thanks");
  expect(errors).toEqual([]);
});
test("all remaining seeds have real working interactions", async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() => page.locator(".app-row").count())
    .toBeGreaterThanOrEqual(6);
  let frame = await launch(page, "Decision Spinner");
  await frame.getByLabel("Choices").fill("Tea\nCoffee");
  await frame.getByRole("button", { name: "Spin the wheel" }).click();
  await expect(frame.locator("#result")).toHaveText(/^(Tea|Coffee)$/);
  await close(page);
  frame = await launch(page, "Tap Reflex");
  await frame.getByRole("button", { name: "Tap to start" }).click();
  await expect(frame.getByRole("button", { name: "TAP NOW" })).toBeVisible();
  await frame.getByRole("button", { name: "TAP NOW" }).click();
  await expect(frame.locator("#target")).toContainText("ms");
  await close(page);
  frame = await launch(page, "Focus Sprint");
  await frame.getByRole("button", { name: "Start sprint" }).click();
  await expect(
    frame.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Pause", exact: true }).click();
  await close(page);
  frame = await launch(page, "Tiny Quiz");
  for (const answer of ["Mars", "Page structure", "Dolphin", "Six"])
    await frame.getByRole("button", { name: answer, exact: true }).click();
  await expect(frame.getByText("Curiosity rewarded")).toBeVisible();
  await expect(frame.locator(".large")).toHaveText("4");
  await frame.getByRole("button", { name: "Play again" }).click();
  await expect(frame.getByText("QUESTION 1 OF 4")).toBeVisible();
  await close(page);
  frame = await launch(page, "Meme Remix");
  await frame
    .getByLabel("Caption", { exact: true })
    .fill("When all tests pass");
  await expect(frame.locator("#caption-out")).toHaveText("When all tests pass");
  await frame.getByRole("button", { name: "Looks good!" }).click();
  await expect(frame.locator("#notice")).toContainText("Remix complete");
  await close(page);
});
test("mobile layout, search, reporting, profile and blocking", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect
    .poll(() => page.locator(".app-row").count())
    .toBeGreaterThanOrEqual(6);
  await page.getByLabel("Search mini-apps").fill("spinner");
  await expect(page.locator(".app-row")).toHaveCount(1);
  await page.getByLabel("Search mini-apps").fill("");
  await page.screenshot({
    path: "output/playwright/discover-mobile.png",
    fullPage: true,
  });
  await page
    .locator(".app-row")
    .filter({ hasText: "Decision Spinner" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("button", { name: "Report this mini-app" }).click();
  await page.getByLabel("Report category").selectOption("privacy");
  await page.getByLabel("Report details").fill("Local report rehearsal");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("status")).toContainText("Report sent");
  await page.getByRole("button", { name: "Back to discover" }).click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/profile-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "My reports", exact: true }).click();
  await expect(page.locator(".sheet")).toContainText("Decision Spinner");
  await page.getByRole("button", { name: "Close settings" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("developer upload and moderator approval become a public release", async ({
  page,
  browser,
}) => {
  await login(page, "developer@firsttry.local");
  await expect(page.getByText("Your mini-apps")).toBeVisible();
  const guide = page.getByRole("region", { name: "Deployment quickstart" });
  await expect(guide).toContainText("pnpm cli deploy hello-mini");
  await guide.getByText("Integrations and supported projects").click();
  await expect(guide).toContainText("GitHub/GitLab imports");
  await expect(guide).toContainText("Planned");
  await page.screenshot({
    path: "output/playwright/developer-dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create mini-app", exact: true })
    .click();
  const slug = "browser-" + Date.now();
  const appName = "Rehearsal " + slug;
  await page.getByLabel("App name", { exact: true }).fill(appName);
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page
    .getByLabel("Short description", { exact: true })
    .fill("A complete browser publishing rehearsal");
  await page
    .getByRole("button", { name: "Create listing", exact: true })
    .click();
  await expect(
    page.getByText("Your first deployment starts here."),
  ).toBeVisible();
  const zip = makeZip({
    "manifest.json": JSON.stringify({
      id: slug,
      name: "Browser Rehearsal",
      description: "A complete browser publishing rehearsal",
      version: "1.0.0",
      runtime: "webview-v1",
      entry: "index.html",
      category: "games",
      estimatedDurationSeconds: 30,
      ageRating: "general",
      capabilities: [],
      network: { allowedDomains: [] },
      assets: {},
    }),
    "index.html":
      "<!doctype html><title>Rehearsal</title><h1>Hello mini-app</h1>",
  });
  await page.getByLabel("Upload ZIP", { exact: true }).setInputFiles({
    name: "mini.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zip),
  });
  await expect(page.getByText("validated", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(page.getByText("pending", { exact: true })).toBeVisible();
  const context = await browser.newContext();
  const moderator = await context.newPage();
  await login(moderator, "admin@firsttry.local");
  const row = moderator.getByRole("row").filter({ hasText: appName });
  moderator.once("dialog", (d) =>
    d.accept("Reviewed locally for the publishing rehearsal"),
  );
  await row.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(moderator.getByRole("status")).toContainText("recorded");
  await moderator.screenshot({
    path: "output/playwright/moderator-dashboard.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button").filter({ hasText: appName }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish / rollback" }).click();
  await expect(page.getByRole("status")).toContainText("published");
  await expect(
    page.getByRole("heading", { name: "Live on FirstTry" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Published", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("region", { name: "Deployment quickstart" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "View in discovery", exact: true }),
  ).toHaveAttribute("href", "/?app=" + slug);
  await page
    .getByRole("link", { name: "View public listing", exact: true })
    .click();
  await expect(page).toHaveURL("/m/" + slug);
  await expect(page.getByRole("heading", { name: appName })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page
    .getByRole("link", { name: "View in discovery", exact: true })
    .click();
  await expect(page).toHaveURL("/?app=" + slug);
  await expect(
    page.getByRole("heading", { name: appName, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: appName, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to discover", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  const publishedRow = page.locator(".app-row").filter({ hasText: appName });
  await expect(publishedRow).toBeVisible();
  await publishedRow.getByRole("button", { name: "Try", exact: true }).click();
  const androidLaunch = page.getByRole("dialog", {
    name: "Open " + appName + " on Android",
  });
  await expect(androidLaunch).toBeVisible();
  await expect(
    androidLaunch.getByRole("link", { name: "Open in FirstTry for Android" }),
  ).toHaveAttribute("href", "firsttry://mini/" + slug);
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.goto("/developer");
  await page.getByRole("button").filter({ hasText: appName }).click();
  await page.getByRole("button", { name: "Pause public release" }).click();
  await expect(page.getByRole("status")).toContainText("paused");
  await expect(
    page.getByRole("heading", { name: "No public release yet" }),
  ).toBeVisible();
  await context.close();
});
test("CLI device login is approved from the dashboard and previews render a QR", async ({
  page,
}) => {
  const headers = { "x-firsttry-request": "1" };
  const start = await (
    await page.request.post("/api/v1/auth/device", { headers, data: {} })
  ).json();
  await page.goto("/device?code=" + start.userCode);
  await expect(page.getByText("Sign in as a developer first.")).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("developer@firsttry.local");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/device\?code=/);
  await expect(page.getByLabel("Code")).toHaveValue(start.userCode);
  const pending = await page.request.post("/api/v1/auth/device/token", {
    headers,
    data: { deviceCode: start.deviceCode },
  });
  expect(pending.status()).toBe(428);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approved.")).toBeVisible();
  const issued = await page.request.post("/api/v1/auth/device/token", {
    headers,
    data: { deviceCode: start.deviceCode },
  });
  expect(issued.status()).toBe(200);
  expect((await issued.json()).token).toMatch(/^ft_/);
  // Open-redirect guard: only same-site paths are honoured after login.
  await page.request.post("/api/v1/auth/logout", { headers, data: {} });
  await page.goto("/login?next=//evil.example");
  await page
    .getByLabel("Email", { exact: true })
    .fill("developer@firsttry.local");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/developer$/);

  await page.goto("/preview?app=abc-123&version=def-456");
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open in FirstTry" }),
  ).toHaveAttribute("href", "firsttry://preview/abc-123?version=def-456");
  await page.goto("/preview?app=%3Cscript%3E&version=x");
  await expect(
    page.getByText("Missing or invalid preview link."),
  ).toBeVisible();
});
