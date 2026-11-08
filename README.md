# FirstTry

A working local Android mini-app discovery platform with a WeChat-inspired consumer interface, six usable mini-apps, a developer dashboard, moderator console, CLI and signed runtime grants.

**Local development MVP. Public deployment is deliberately disabled.** Domain verification, release credentials, independent security review, current Play policy checks and production operations are separate release gates. See docs/ROADMAP.md and docs/TEST_RESULTS.md for actual coverage and remaining work.

## Stack and layout

- Android: Kotlin, Jetpack Compose, AndroidX WebKit, native host chrome and a restricted WebView.
- Web: Next.js, React, TypeScript, CSS tokens and Lucide icons.
- API: Fastify, Zod/OpenAPI and server-side role/ownership checks.
- Database: PostgreSQL through Drizzle parameterized SQL. Local default uses persistent embedded PostgreSQL (PGlite); DATABASE_URL selects an external PostgreSQL server.
- Objects: immutable content-addressed ZIPs in .local/bundles by default; optional private MinIO/S3-compatible adapter.
- SDK/CLI: typed constrained message protocol; shared manifest/archive validation.

```text
apps/api/             API, persistence, signatures, integration/security tests
apps/web/             Consumer design preview, developer/admin UI, share pages
apps/android/         Real Kotlin/Compose Android host and runtime tests
packages/shared/      Manifest, API validation and bounded ZIP scanner
packages/mini-sdk/    Host transport and explicitly separate browser mock
packages/mini-cli/    init / validate / login / deploy / status
packages/mini-examples/runtime/  Six independent seeded experiences
infra/                SQL migration and optional Docker Compose services
tests/e2e/            Real browser journey tests
scripts/              Windows Android build helper
output/playwright/    Captured browser screenshots
```

## Windows quickstart

Prerequisites: Node 22+ (tested with Node 24), pnpm 11.25.0, and a modern browser. Android builds need JDK 17, Gradle 8.11.1 and Android SDK 35/build-tools 35.0.0. Docker is optional for the local default.

From the repository root:

```powershell
# On machines using Windows-managed certificate authorities:
$env:NODE_USE_SYSTEM_CA = '1'
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm dev
```

Open http://127.0.0.1:3000. The API listens at http://127.0.0.1:3001/api/v1. Start seeds automatically on first API run; subsequent starts preserve reviews, versions and activity. Do not start two API processes against the same embedded database directory.

Routes: `/`, `/developer`, `/admin`, `/login`, `/m/:slug`. Browser play executes only the bundled first-party seeds in a sandboxed iframe. Uploaded mini-apps execute only in the Android host. This browser surface is not a replacement for Android runtime tests.

The six seeds are Color Clash, Tap Reflex, Decision Spinner, Focus Sprint, Tiny Quiz and Meme Remix. No external paid service is needed.

### Development accounts

All these local accounts use password `FirstTry-local-2026!`:

| Email                    | Role                                   |
| ------------------------ | -------------------------------------- |
| developer@firsttry.local | Owner of seed apps                     |
| other@firsttry.local     | Separate developer for isolation tests |
| admin@firsttry.local     | Moderator                              |
| consumer@firsttry.local  | Consumer                               |

These credentials are fixtures, never production credentials. The server refuses NODE_ENV=production. Guest browsing works without signing in; guest data merges into an account on login.

### Optional Docker PostgreSQL and MinIO

```powershell
docker compose -f infra/docker-compose.yml up -d
```

Set DATABASE_URL from .env.example to use the external database. Set FIRSTTRY_STORAGE=s3 and the documented S3_* variables to use MinIO. Both modes use the same SQL migration and bundle hashes. Docker/MinIO availability and adapter test status are recorded in TEST_RESULTS.md; a successful embedded test does not certify those external services.

## Run the real Android super-app

For this workspace's prepared Android SDK and rendered emulator, keep the local API running and use:

```powershell
pnpm android:emulator   # Visible FirstTry app: discover and open mini-apps inside it
pnpm android:demo       # Visible FirstTry app with RentalFlow opened inside the host
```

These Windows helpers use the standard AOSP API 35 image, create the project-owned `firsttry-visual` device if needed, wait for boot, install the debug host and configure the API tunnel. The default device transport is `127.0.0.1:5559` on the isolated FirstTry ADB server (port 5039); the window is firsttry-visual:5558. The initial SDK prerequisite is `.local/android-sdk/system-images/android-35/default/x86_64` (install with the local Android CLI's `sdk install system-images/android-35/default/x86_64`). Emulator logs live in `output/emulator-visual*.log`. First launch shows native onboarding. Build the debug APK first if it is missing or stale. `android:run` installs an APK on an already running device; it does not create or display an emulator.

To shut down this specific emulator cleanly, use the window's close control or the workspace ADB command `.local/android-sdk/platform-tools/adb.exe -P 5039 -s 127.0.0.1:5559 shell reboot -p`. This preserves its app data. Browser pages remain useful for developer/moderator management and browser-specific checks; Android is the primary surface for testing uploaded mini-apps.

## Android Studio and local device run

1. Open `apps/android` in Android Studio; select JDK 17 and install Android SDK 35.
2. Configure the SDK path through Studio or ignored local.properties.
3. Start the API before launching the host.
4. Build the `app` debug configuration, then run `pnpm android:run`. This installs the host, tunnels the local API and launches FirstTry.
5. For several devices, pass `--serial <device-id>` to select the target.

This workspace also has ignored local tool downloads under .local/tools and .local/android-sdk. The helper uses them when present:

```powershell
.\scripts\android.ps1 -Tasks testDebugUnitTest,assembleDebug
.\scripts\android.ps1 -Tasks assembleDebugAndroidTest
```

APK output: apps/android/app/build/outputs/apk/debug/app-debug.apk.

### Integrated ADB commands

Start the API with `pnpm dev`, then use these commands from the repository root:

```powershell
pnpm android:doctor              # ADB path/version, devices and APK availability
pnpm android:devices             # Device IDs and authorization status
pnpm android:run                 # Install, tunnel API port 3001 and launch
pnpm android:run --serial <device-id>
pnpm android:logs                # Last 200 log lines for the running host
pnpm android:test                # Install both APKs, reset debug host data, run native tests
pnpm test:adb                    # ADB helper regression tests; no device required
```

For a USB phone, enable Developer options and USB debugging, connect it, unlock it and accept the computer authorization prompt. Run `pnpm android:devices` to confirm its status is `device`. The API stays bound to the computer's loopback address; the reverse tunnel makes it available to the debug host without exposing it on the LAN. Mini-apps run inside the installed host; they do not need separate APKs.

The helper prefers `.local/android-sdk/platform-tools/adb` over older global installations, then checks ANDROID_HOME, ANDROID_SDK_ROOT, the Windows user SDK location and PATH. Set FIRSTTRY_ADB to an explicit executable path if needed. It requires ADB protocol 41 or newer. Set FIRSTTRY_ADB_PORT or pass `--port 5038` to use another server port. The default server port is 5039, isolated from older tools using 5037. It does not terminate other ADB servers. ANDROID_SERIAL can select a device; ambiguous or unauthorized devices produce an error.

For an already configured TCP emulator, connect explicitly, for example `pnpm android:connect 127.0.0.1:5557`. This command does not enable network debugging on a phone. USB devices are discovered automatically. Individual steps are available as `android:install`, `android:reverse` and `android:launch`. `android:run` preserves app data. `android:test` clears only the FirstTry debug package's data and requires the local API and both debug APKs. Reports are saved to `output/android-instrumentation.txt`; JUnit failures cause a failing command even when ADB itself exits successfully.

On a Windows development computer, register the browser link bridge once:

```powershell
pnpm android:register-links
pnpm android:open firsttry://mini/rentalflow
```

Registration applies only to the current Windows user and forwards supported `firsttry://mini/...` and `firsttry://preview/...` links through ADB to the installed Android host. It also restores the local API reverse tunnel. Keep the local API running. If no device is ready, the registered handler starts the prepared visible FirstTry emulator automatically. If startup fails it displays an error instead of silently exiting. A browser may ask permission to open the external handler. Embedded browsers can block external protocols; use `android:open` directly in that case. Handler diagnostics are in `.local/android-link.log`. Use `pnpm android:unregister-links` to remove only this workspace's registration. Another application's existing handler is preserved. Registration depends on this workspace's path; register again after moving it.

The older firsttry-local ATD image disables rendering and remains suitable for headless automation only. The firsttry-visual emulator uses a standard rendered image for hands-on Android checks and screenshots; physical-device acceptance remains separate.

Runtime origins are synthetic per-app HTTPS origins served entirely from verified in-memory bundle bytes via WebView interception. They do not resolve to public DNS. The debug native API connection is cleartext loopback through ADB; debug trust bootstraps the signing public key from that local API. Release execution refuses to start without a configured pinned key, and release networking disallows cleartext. Production needs real TLS, key provisioning/rotation and independent review.

No file:// loader, generic JavaScript-to-native interface, camera/location/contact permissions or mini-app APK installation flow is implemented. Native Compose dependencies may contain host-packaged libraries; developers cannot upload native executable mini-app payloads.

## CLI workflow

The deployment quickstart and integration status are in [Developer deployment](docs/DEVELOPER_DEPLOYMENT.md). Saved build settings, repeat-deploy reuse and inspect/submit/publish/rollback commands are available locally. Hosted Git imports and push-to-deploy are planned.

The CLI is a workspace package, not an already published npx package.

```powershell
pnpm cli init hello-mini
pnpm cli validate hello-mini
$env:FIRSTTRY_PASSWORD = 'FirstTry-local-2026!'
pnpm cli login developer@firsttry.local
Remove-Item Env:FIRSTTRY_PASSWORD
pnpm cli deploy hello-mini
pnpm cli status
```

For a TypeScript/Vite starter, use `pnpm cli init hello-vite --vite`, run `pnpm --dir hello-vite install` and `pnpm --dir hello-vite build`, then run `pnpm cli deploy hello-vite`. The generated firsttry.json builds and selects dist automatically; `--skip-build` reuses existing output. Module-preload polyfills are disabled to preserve the runtime's no-network policy. Static starters remain dependency-free.

Run `pnpm cli login` with no email for a device login (approve the printed code at `/device`); `FIRSTTRY_TOKEN` supplies a CI deploy token instead (`pnpm cli token create`). CLI login is stored in ignored `.firsttry/session.json` in the invocation directory. Do not commit or share it. Deploy prints a private Android preview link. Sign into the host as the owner or moderator to use it. In the dashboard, submit the version; in the moderator console, review and approve; then publish the approved version. Changed bundles require a new semantic version and fresh public approval.

## Tests and mock run

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Browser tests default to installed Microsoft Edge on this Windows machine. Elsewhere install Chromium with `pnpm exec playwright install chromium`, then set `PLAYWRIGHT_CHANNEL=chromium` before testing. Test pages use 127.0.0.1 consistently; do not mix guest cookies across localhost and 127.0.0.1.

Run Android tests after the host/test APK builds with `pnpm android:test`. The existing `./scripts/test-android.ps1` delegates to the same ADB helper and accepts `-Serial` and `-AdbPort`. See docs/TEST_RESULTS.md for the exercised setup.

Read docs/DEMO.md for the complete publish/play/feedback/takedown rehearsal. Browser SDK mocks never emit real completion analytics; native instrumentation verifies the actual constrained message channel separately.

## Data and reset

Development database, bundles and signing key live under ignored .local. CLI sessions live under ignored .firsttry. Stop the API before backup or reset. Preserve the whole database, bundles and signing-key set together when taking a local snapshot. Use a new FIRSTTRY data setup or explicitly rename those task-specific directories for a clean environment; do not delete unrelated SDK/tool downloads or user data.

The automated API suite uses a fresh in-memory PostgreSQL instance and never resets the running development database. Browser rehearsals create uniquely named apps and leave review/audit evidence in the local database.
