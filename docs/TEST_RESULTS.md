# Test results — 20 October 2026

Status: Core local build verified. All 46 implemented automated tests pass; builds and the 100,000-event rehearsal also pass. Unverified alpha/public-release gates remain listed below.

## Completed checks

| Check                                                            | Actual result                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting/lint                                                  | Passed: pnpm lint                                                                                                                     |
| Workspace TypeScript                                             | Passed: pnpm typecheck                                                                                                                |
| API, contracts, archive/security, SDK and PostgreSQL integration | 22 tests passed across two files                                                                                                      |
| Browser journeys                                                 | Four journeys passed in real Microsoft Edge against the final built frontend (19.6 seconds)                                           |
| Native Android build                                             | testDebugUnitTest, assembleDebug and assembleDebugAndroidTest succeeded                                                               |
| Android JVM runtime-policy tests                                 | Three tests passed                                                                                                                    |
| Native Android instrumentation                                   | Four tests passed on API 35 emulator (76.605 seconds), including cookie isolation, uploaded bundle, repeated link and active takedown |
| Static CLI starter                                               | init -> validate -> login -> private deploy succeeded                                                                                 |
| TypeScript/Vite CLI starter                                      | install -> production build -> restricted bundle validation succeeded                                                                 |
| Event ingestion                                                  | 100,000 stored events / 1,000 sessions / 5,000 batches; expected counts matched                                                       |

The final cookie-isolated native four-test run completed in 76.605 seconds. The prior run completed in 52.812 seconds after the revocation thread fix. The initial three-test run completed in 58.222 seconds. It exercised native navigation/profile, Color Clash in the synthetic-origin WebView and Tiny Quiz completion through the restricted SDK into real backend analytics. The expanded run adds a newly uploaded, reviewed and published bundle, feedback and takedown, with completion assertions compared against a pre-run baseline.

Ingestion measurement: 44.35 seconds, batch p50 7 ms, batch p95 14 ms, process RSS 592 MB. This uses sequential Fastify injection and in-memory PostgreSQL, not network load or production hardware/capacity. Raw output: output/benchmark.json.

## ADB integration validation

The project ADB helper passed four regression tests covering device-list parsing, explicit/ambiguous/unauthorized device selection, port and argument validation, and instrumentation failure detection. `pnpm lint` passed after these changes.

Live validation used SDK Platform-Tools 37.0.1 on server port 5037 and emulator `127.0.0.1:5557`. `pnpm android:doctor` selected the workspace SDK rather than the old global ADB. `pnpm android:run` installed the existing debug APK, reversed API port 3001 and launched FirstTry. App-scoped log retrieval succeeded. `pnpm android:test` installed both APKs, reset the debug host, and passed all four native journeys in 74.63 seconds. The current raw result is `output/android-instrumentation.txt`.

The PowerShell native test entry point now delegates to the same Node helper. Normal install/run preserves app data; the explicit test command resets FirstTry debug host data. No physical USB device was available for validation. The ATD pixel-capture limitation below still applies. API, browser, build and JVM results above are from the preceding full validation; this ADB change reran the helper tests, native instrumentation and formatting.

## Developer deployment validation — 21 October 2026

Three new CLI tests passed: configuration boundaries, immutable version reuse/conflicts, and a subprocess lifecycle against a fixture HTTP API. The lifecycle executes login, configured build, private deploy, identical redeploy/submit, inspect, denied unapproved publication, approved publication/rollback, changed-version rejection and failed-build upload prevention.

A fresh generated TypeScript/Vite project was installed from the local package cache and deployed to the running local API. The CLI built Vite output, validated it and returned an authenticated Android preview link. An identical second deploy returned the same version ID and hash with `reused: true`. This rehearsal stayed private; no production integration was exercised.

Workspace type-checking and production build passed. The targeted real-Edge developer journey passed: onboarding/integration status, listing creation, ZIP upload, submission, moderator approval, publication, public metadata page, and pause cleanup. The screenshot `output/playwright/developer-dashboard.png` was visually inspected. Git integrations, cloud builders and self-service developer signup remain unimplemented; see DEVELOPER_DEPLOYMENT.md. The prior API/native tests were not rerun for this CLI/portal change.

## Published app navigation fix — 21 October 2026

RentalFlow v1.0.0 was confirmed published in the live public catalog. Its developer card opened deployment management, whose persistent quickstart obscured the distinction from consumer playback. The developer view now hides the quickstart after upload, shows authoritative live release status, marks the published version, refreshes after publish/pause, and provides public-listing, Android-launch and consumer-discovery links. Browser attempts to run an uploaded app now show a persistent Android launch dialog, and do not create an unused play session.

Validation: 22 API/SDK tests passed, including added current-release assertions across publish and rollback. Production build and formatting passed. The expanded publishing browser journey passed through publication, live status, public listing, discovery, Android-link dialog and pause cleanup. The first browser run encountered three Edge startup/page crashes; those three journeys all passed on a targeted retry. All four browser journeys therefore have passing results, with that local startup instability recorded.

The API restart initially encountered an embedded database recovery error after process termination. A full ignored copy was preserved at `.local/postgres-recovery-20261021`; the live database was opened diagnostically and closed cleanly, then the API restarted successfully. RentalFlow's existing public version was verified intact. No app data reset was performed.

RentalFlow was opened on emulator `127.0.0.1:5557` using its actual public deep link. UI hierarchy confirmed Agent/Tenant controls, 17 rental homes and the shortlist workflow. Evidence: `output/rentalflow-android-hierarchy.xml`. This verifies native content loading, not pixel-level visual acceptance; the ATD screenshot limitation remains.

## Desktop Android link handler — 21 October 2026

Added `android:open` for constrained public/preview deep links and per-user Windows protocol registration/unregistration commands. The handler invokes only the fixed FirstTry activity through the existing ADB helper and sets the API reverse tunnel; it does not install APKs or clear app data. Other protocol registrations are preserved, and unregister verifies workspace ownership.

All five ADB helper regression tests pass, including malformed URI and shell-character rejection. Live `android:open firsttry://mini/rentalflow` succeeded on `127.0.0.1:5557`. Windows ShellExecute (`Start-Process firsttry://mini/rentalflow`) then invoked the registered handler successfully; `.local/android-link.log` recorded exit 0 and the delivered Android VIEW intent. Browser permission prompts and embedded-browser external-protocol restrictions remain client-specific; direct `android:open` is the tested fallback. This change did not rerun the API/native/browser suites because runtime behavior is unchanged.

## App-specific discovery navigation — 21 October 2026

Renamed the developer dashboard link to View in discovery and made both it and the public listing link target `/?app=<slug>`. Consumer discovery resolves the app through the authenticated catalog endpoint and opens its detail screen, including after refresh. Back to discover clears the app parameter and returns to the general feed.

The production web build and changed-file formatting checks passed. The expanded real-Edge publishing journey passed, verifying the app-specific link, exact detail heading, refresh persistence, return to the feed and Android launch dialog. Existing published app state was preserved.

## Visible Android emulator validation — 21 October 2026

Installed the standard rendered AOSP Android API 35 x86_64 image and created the project-owned `firsttry-visual` AVD. The window is titled Android Emulator - firsttry-visual:5558; its ADB target is `emulator-5558`. Stopped the old headless firsttry-local ATD guest and removed duplicate TCP transports. The new repeatable `pnpm android:emulator` and `pnpm android:demo` commands open FirstTry or RentalFlow inside the visible Android host, install the existing debug APK and reverse the local API port.

All four native instrumentation journeys passed on the rendered emulator in 20.362 seconds. The first run had three passes and one failure because Fresh drops was outside the composed viewport of the lazy discovery list after closing Color Clash. The test now scrolls the native lazy list to the heading and asserts it is displayed. Rebuilt the instrumentation APK successfully, then reran all four tests with `OK (4 tests)`. No production runtime change was needed. Current raw result: output/android-instrumentation.txt.

Actual screen capture confirms RentalFlow rendered inside FirstTry's host capsule. Android touch input switched from Agent to Tenant, showing the rental cards. Further native touch navigation exercised close, optional feedback skip, Discover, search RentalFlow, native detail and Try now. Screenshots are in output/android/rentalflow-agent.png, rentalflow-tenant.png, firsttry-discovery.png and rentalflow-native-detail.png. These are Android screenshots, not browser mockups. PowerShell syntax validation and formatting of the helper/package documentation passed. Physical-device and full accessibility/visual acceptance remain separate gates.

## RentalFlow Android regression — 22 October 2026

The full native suite passed 8 tests in 83.945 seconds (four host and four RentalFlow workflows). The final RentalFlow APK, including an exact two-result budget/BHK filter assertion, passed all four RentalFlow tests again in 23.878 seconds. Six ADB helper tests passed, including matching local emulator alias selection; repository formatting and launcher PowerShell syntax passed. See RENTALFLOW_TEST_REPORT.md for the actual workflow matrix and demo limitations.

FirstTry now defaults to an isolated ADB server on port 5039, with the rendered emulator reachable as 127.0.0.1:5559. Historical commands above using 5037/emulator-5558 describe earlier runs. No browser or API suites were rerun for this RentalFlow native-test/launcher change.

## Environment and commands

Windows, Node 24.1.0, pnpm 11.25.0, Next.js 16.4.2, Fastify 5.12.7, persistent/local and in-memory PGlite, Temurin JDK 17.0.20.1+1, Gradle 8.11.1, Android SDK 35, build-tools 35.0.0 and AOSP ATD x86_64 API 35 emulator. Browser runner uses installed Microsoft Edge.

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
.\scripts\android.ps1 -Tasks testDebugUnitTest,assembleDebug,assembleDebugAndroidTest
pnpm --filter @firsttry/api exec tsx src/benchmark.ts
```

Native instrumentation is run directly with the workspace SDK ADB because the machine has a competing old ADB:

```powershell
# After starting the managed emulator on console port 5556:
$adb = '.\.local\android-sdk\platform-tools\adb.exe'
& $adb -P 5037 connect 127.0.0.1:5557
& $adb -P 5037 -s 127.0.0.1:5557 reverse tcp:3001 tcp:3001
& $adb -P 5037 -s 127.0.0.1:5557 install -r apps/android/app/build/outputs/apk/debug/app-debug.apk
& $adb -P 5037 -s 127.0.0.1:5557 install -r apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
& $adb -P 5037 -s 127.0.0.1:5557 shell pm clear app.firsttry.host
& $adb -P 5037 -s 127.0.0.1:5557 shell am instrument -w app.firsttry.host.test/androidx.test.runner.AndroidJUnitRunner
```

`pm clear` above applies only to this managed test host and resets its local accounts/preferences. Test backend state is kept for audit. Native runner output is retained in .local/android-instrumentation.txt; JVM XML reports are under apps/android/app/build/test-results.

## Browser evidence

- output/playwright/discover-desktop.png
- output/playwright/discover-mobile.png
- output/playwright/color-clash-player.png
- output/playwright/profile-mobile.png
- output/playwright/developer-dashboard.png
- output/playwright/moderator-dashboard.png

These are captures of implemented screens, not generated design concepts. Generated rehearsal listings are paused after testing so public discovery returns to the six intentional seeds. Browser traces/reports are retained when a test fails.

## Issues found and corrected

- Empty POSTs incorrectly advertised JSON bodies; fixed API client headers.
- Repeated rehearsal names made browser selectors ambiguous; tests now use unique app identity.
- Native lazy-list items required the real search flow; text-field and row matches were disambiguated.
- Drizzle embedded transaction adaptation and wrapped database errors were corrected.
- Android build memory pressure was mitigated with a single worker, in-process Kotlin compiler, smaller icon dependency and sequential build/device runs.
- Duplicate dependency resource metadata was excluded explicitly from Android packaging.
- Guest sign-in migration, complete recently-used metadata and telemetry limits received dedicated regression tests.
- Generated Vite starter now explicitly allows the required esbuild install script and disables module-preload network polyfills.

Additional regression findings: identical Android intent links require an event counter; reused URI state alone suppresses the second launch. Active revocation tests advance the Compose-controlled polling interval explicitly. That test also exposed a real worker-thread WebView cleanup violation; cleanup is now posted to the main looper, cancellation is rethrown and disposed views cannot affect new sessions. The final native run passed the active-takedown, cookie isolation and repeated-link assertions.

Optional standalone MinIO verification was attempted, but the official Windows binary URL returned HTTP 410 and Docker is unavailable. The S3 adapter is implemented but not certified here.

## Not yet certified

Physical Android device/low-memory tests, multiple OS/WebView versions, TalkBack/full accessibility audit, external PostgreSQL, real MinIO, backup/restore drills, production TLS/signing-key rotation, verified domain App Links, independent security review, legal/Play readiness and production deployment.

The local server explicitly refuses production startup. Local passing tests are not a claim that all 224 plan items, public release gates or Play approval are complete.

Native pixel QA limitation: the AOSP automated-test image returned a black screenshot and a first-draw wait timeout after standalone launch. Its native UI hierarchy and four instrumentation journeys are available, but the blank capture was discarded rather than presented as visual evidence. At that earlier checkpoint, native visual QA on a normal emulator/physical device was unverified. The rendered-emulator run below supersedes the normal-emulator limitation; physical-device and full visual/accessibility acceptance remain outstanding.
