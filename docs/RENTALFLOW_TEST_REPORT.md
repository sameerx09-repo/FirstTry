# RentalFlow Android test report — 22 October 2026

Result: PASS for the exercised local Android demo workflows.

Tested the published RentalFlow v1.0.0 bundle (`bbd8ba8098229579df27ea9084e1801b3429272805d2d4df1a5d8b903ae28d3f`) inside FirstTry on the rendered AOSP Android 35 x86_64 emulator. The super-app publication was preserved; tests changed only session-local fictional selections and appointments.

## Results

| Area                   | Verified behavior                                                                                                                                               | Result |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Launch and runtime     | Public RentalFlow link loads in the signed native runtime, with the expected isolated origin and FirstTry SDK bridge                                            | Pass   |
| Browse and search      | 17 rental snapshots; Kondapur locality search; unknown search shows an empty state                                                                              | Pass   |
| Budget and BHK filters | Up to 50,000 rupees and 2 BHK returns exactly two matching homes                                                                                                | Pass   |
| Commute snapshots      | Saved SVG route opens; morning/evening selection changes; dated/non-live traffic disclosure remains visible; dialog closes                                      | Pass   |
| Shortlist              | Smart builder selects three; fourth selection is denied; publishing an empty shortlist is rejected; three selected homes publish within the demo session        | Pass   |
| Message draft          | Source/availability text is present and the UI explicitly says no WhatsApp message is sent                                                                      | Pass   |
| Tenant feedback        | Interested/pass states toggle and update within the shared demo session                                                                                         | Pass   |
| Preferences            | Invalid budget rejected; valid budget/BHK/commute change accepted and flags published shortlist for review                                                      | Pass   |
| Visits                 | Future request accepted; past time and duplicate request rejected; confirmation requires acknowledgement; confirmed appointments within 30 minutes are rejected | Pass   |
| Reset and lifecycle    | Reset clears published selections; SDK close exits the mini-app; reopening starts with no saved shortlist/visits                                                | Pass   |
| Host regression        | Existing native navigation, Color Clash isolation/cookies, quiz SDK analytics, upload/review/publish and active takedown journeys                               | Pass   |

The complete Android instrumentation run passed **8 tests** in **83.945 seconds**: four host tests and four RentalFlow tests. After strengthening the filter assertion to require exactly two results, the four RentalFlow tests passed again in **23.878 seconds** with the final APK.

A read of the real developer analytics showed RentalFlow completions increase from 4 to 8 during the final four-test run, matching publish/confirm events from the actual Android SDK bridge.

The tests drive the real DOM controls through Android WebView instrumentation and assert the resulting rendered state. They do not substitute a desktop browser runtime. Native touch and pixel checks are complementary; this is not a complete keyboard/date-picker, accessibility, physical-phone or performance certification.

## Evidence

- Native test source: apps/android/app/src/androidTest/java/app/firsttry/host/RentalFlowTest.kt
- Full eight-test run: output/android-instrumentation.txt
- Final four-test RentalFlow run: output/rentalflow-instrumentation.txt
- Final rendered Android screenshot: output/android/rentalflow-tested-20261022.png
- Rendered Android screenshots: output/android/

## Launch issues found during testing

An older global ADB installation interfered with the SDK server. FirstTry now defaults to its own server port 5039. The same local emulator can appear as both `emulator-5558` and `127.0.0.1:5559`; the helper now treats those matching aliases as one device while still requiring selection for genuinely different devices. All six ADB helper tests pass.

The desktop handler now validates the link before doing anything, checks the local API, starts the prepared visible emulator when no device is ready, reconnects an already running guest, opens the app and requests emulator-window activation. Errors are surfaced instead of silently swallowed. A real Windows URI activation was tested from a fully stopped emulator: the handler started the visible guest, installed/launched FirstTry, opened RentalFlow, activated the emulator window and recorded Exit: 0 in .local/android-link.log. The cold-start check also exposed the AVD shutdown lock race; startup now waits for the previous guest to exit. Emulator subprocesses use the workspace SDK on PATH so they cannot pick the old global ADB binary. The local API must still be running. PowerShell syntax and repository formatting checks passed.

## Scope limits

RentalFlow is an offline, session-only demonstration with dated rental and commute snapshots. Availability is unverified. Visits are fictional, and no owners, tenants or external messaging services are contacted. Closing/reloading intentionally discards demo selections, feedback and visits. Live listings, real booking, persistent accounts and cross-device collaboration were not tested and are not provided by this bundle.
