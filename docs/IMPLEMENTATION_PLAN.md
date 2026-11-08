# FirstTry implementation plan and acceptance checklist

Status: Core local milestones M0-M4 implemented. All implemented automated regressions pass; evidence is recorded in TEST_RESULTS.md; full M5/M6 acceptance still depends on the unverified checks below and ROADMAP.md.
Date: 20 October 2026
Product reference: ../miniapp_superapp_codex_master_spec.md, including the WeChat-inspired interface revision.

## 0. Scope, terminology and completion rules

- [x] Deliver an Android-first consumer discovery app, developer dashboard, moderator console, API, SDK and CLI.
- [x] Install only the Android host. Mini-apps are restricted HTML/CSS/JavaScript bundles, never individual native packages.
- [x] Use WeChat-inspired compact navigation, recent-app launcher, grouped lists, green accents and host-owned overflow/close controls.
- [x] Start with Color Clash, Tap Reflex and Decision Spinner; reach at least six working mini-apps for full MVP acceptance.
- [ ] Defer payments, advertising, messaging, public uploads, sensitive native capabilities and AI backends.
- [ ] Keep all checklist items unchecked until evidence exists. Record command, environment, result and artifact for completed checks.
- [ ] Separate functional local MVP completion, controlled-alpha readiness and production/Play release readiness.
- [ ] Track implementation choices in DECISIONS.md, future work in ROADMAP.md and results in TEST_RESULTS.md.

Terminology:
- **Build:** implementation and configuration work.
- **Test:** repeatable automated or manual checks of behavior, including failures.
- **Validation:** evidence required to accept the section.
- **Mock run:** a scripted rehearsal. Browser SDK mocks are simulated; the integrated local rehearsal uses the real API, database, bundle storage and Android host.

## 1. Workspace, prerequisites and reproducible development environment

### Build
- [x] Inspect workspace conventions and applicable instructions; preserve existing work.
- [x] Create pnpm workspaces: apps/web, apps/api, apps/android, packages/shared, packages/mini-sdk, packages/mini-cli and packages/mini-examples.
- [x] Create infra and docs directories, strict TypeScript configuration, formatting, linting and locked dependencies.
- [x] Check Node/pnpm, Docker, JDK, Android Studio, Android SDK and emulator availability; pin compatible supported versions and document missing prerequisites.
- [ ] Configure Docker Compose for PostgreSQL and MinIO with health checks and persistent development volumes.
- [x] Add .env.example, ignored local credentials, deterministic seed accounts and explicit development-only configuration guards.
- [ ] Document Windows PowerShell and Android Studio startup, shutdown and reset procedures. Reset must target only local development data.

### Test
- [x] Install dependencies from the lockfile; run lint, type checks and initial builds.
- [ ] Start infrastructure from a clean state; run migrations twice safely and verify seed idempotency.
- [x] Restart services and confirm development data persists.

### Validation
- [x] A clean checkout can start without paid cloud services; missing tools produce clear instructions.
- [ ] No credentials are committed; production cannot enable seed accounts or debug trust accidentally.

### Mock run
- [ ] Follow README on Windows: start services, seed data, open dashboards and start emulator; record actual commands and failures.

## 2. Product contracts and runtime decisions

### Build
- [ ] Define separate listing, validation, review, release and suspension states with legal transitions.
- [x] Separate public authorization from authenticated private-preview authorization. Preview requires automated validation and tester access, but not public approval.
- [ ] Define public launch authorization lifetime, renewal, revocation polling and fail-closed expiry behavior; document the offline takedown limitation.
- [x] Define signed metadata fields: app/version identity, bundle and per-file hashes, allowed origin, runtime version, capability grants, expiry and signing-key identifier.
- [ ] Define signature verification, trusted key distribution, rotation, revoked keys and replay protection.
- [ ] Decide minimum Android/WebView support and tested storage/profile fallback. Unsupported security prerequisites must prevent a launch.
- [ ] Define safe Back behavior, release pinning, meaningful completion per mini-app, guest identity and local/account data boundaries.

### Test
- [ ] Table-test legal and illegal transitions, authorization expiry and signature verification with deterministic clocks and fixtures.
- [ ] Test private preview access by owner, invited tester, unrelated developer and anonymous consumer.

### Validation
- [ ] Document state diagrams, trust boundaries and threat assumptions before accepting arbitrary uploaded bundles.
- [ ] Resolve spec ambiguities in DECISIONS.md; never silently reinterpret public approval requirements.

### Mock run
- [ ] Walk through upload, failed validation, preview, rejection, corrected version, approval, publication, rollback and suspension using example state records.

## 3. Database, shared schemas and API contracts

### Build
- [x] Implement migrations for users/guests, developer profiles, mini-apps, versions, releases, grants, sessions, events, saves, feedback, reports, blocks and audit records.
- [x] Add constraints for unique slugs/versions, valid release ownership, immutable bundle identity and transactional approved release pointers.
- [ ] Snapshot review-relevant metadata; changes to reviewed content require an appropriate new review.
- [ ] Create shared Zod schemas, generated JSON Schema/OpenAPI and generated Android-compatible API contracts.
- [ ] Define pagination, structured error codes, idempotency, event deduplication and server timestamps.
- [ ] Set telemetry retention and minimum cohort sizes for developer-visible analytics; distinguish operational logs from analytical data.

### Test
- [ ] Run migrations against clean PostgreSQL, verify constraints and test rollback-on-transaction-failure.
- [ ] Test concurrent publish/revoke attempts and stale review decisions.
- [ ] Validate request/response contracts and pagination with integration tests.

### Validation
- [ ] Database constraints and API checks jointly prevent cross-app release pointers and unauthorized public access.
- [ ] OpenAPI matches implemented endpoints and contains useful examples and errors.

### Mock run
- [ ] Seed one draft, one rejected version, one approved release and one suspended app; inspect expected database and API representations.

## 4. Authentication, roles and ownership

### Build
- [x] Implement dashboard sessions, secure cookie configuration, CSRF protection and logout/revocation.
- [x] Implement consumer, developer and moderator authorization plus app ownership checks on every relevant endpoint.
- [x] Implement limited CLI credentials and Android guest/account credentials; never expose them to mini-app JavaScript.
- [ ] Define guest-local saves/history/blocking, optional account synchronization and deletion behavior.
- [x] Provide development-only accounts for two distinct developers, a moderator, a consumer and a guest path.

### Test
- [ ] Test expired sessions, CSRF, unauthorized role access, credential revocation and repeated login abuse.
- [x] Attempt developer A reads/writes against developer B listings, bundles, analytics and feedback.

### Validation
- [ ] All protected endpoints fail safely without authentication and enforce ownership with valid authentication.
- [ ] Guest-to-account transitions preserve the documented data behavior without identity leakage.

### Mock run
- [ ] Use separate browser profiles for both developers and the moderator; demonstrate denied cross-account operations.

## 5. Three initial playable mini-apps

### Build
- [x] Color Clash: 30-second rounds, color/word challenge, score, completion, replay and concise instructions. Provide an accessible alternative and document color-dependent gameplay limits.
- [x] Tap Reflex: randomized ready signal, early-tap handling, reaction result, replay and in-session best. Enable persistent best only after storage isolation passes.
- [x] Decision Spinner: local choice entry/editing, input bounds, keyboard-friendly layout, selection animation and result/replay; never send entered choices as telemetry.
- [x] Give each app consistent icon/cover assets, manifest, useful empty/error states and a production build.
- [x] Make timers lifecycle-aware; define pause/reset behavior when backgrounded instead of promising background execution.

### Test
- [ ] Test scoring, timeout, replay, early taps, empty options, long text, duplicate submissions and deterministic selection fixtures.
- [ ] Check small screens, soft keyboard, large text, reduced motion and portrait resizing.

### Validation
- [x] Each app has a complete useful interaction, completion state and replay without backend code written by its developer.
- [x] Bundle validation succeeds and no external executable scripts or trackers are required.

### Mock run
- [ ] Play each app in a browser using explicit SDK mocks, then repeat inside the Android host. Label the two results separately.

## 6. Bundle validation, staging and immutable storage

### Build
- [ ] Implement bounded scoped upload authorization, staging uploads and a completion/validation job with idempotent retries.
- [ ] Enforce compressed size, expanded size, file count, path depth, processing time and MIME/type limits.
- [ ] Reject traversal, absolute paths, links, duplicate/ambiguous archive paths, executable native files and unsupported capabilities.
- [ ] Validate entrypoint, asset references, runtime compatibility, network policy and unsupported dynamic code loading.
- [ ] Generate canonical file inventories/hashes and restrictive serving headers/CSP; move accepted bundles into immutable storage.
- [x] Keep storage credentials private; scoped delivery must cover subresources without exposing a bucket or placing platform secrets in page URLs.
- [x] Prevent uploaded HTML from executing in the dashboard/admin origin. Show sanitized findings and screenshots instead of unsafe inline previews.

### Test
- [ ] Exercise corrupt ZIPs, zip bombs, zip-slip, symlinks, path case collisions, malicious MIME, remote scripts and missing entry files.
- [ ] Test interrupted uploads, duplicate completion, worker restart and timeouts.
- [x] Alter an uploaded asset and verify integrity failure blocks launch.

### Validation
- [x] Failed bundles never become executable public releases. Scanning is a review aid, not a guarantee of safe code.
- [ ] Processing remains bounded and failure reasons are actionable without leaking storage paths or secrets.

### Mock run
- [ ] Upload a valid Color Clash bundle and several hostile fixtures; compare validation results, stored artifacts and audit entries.

## 7. Android app shell and WeChat-inspired discovery

### Build
- [ ] Implement Compose theme tokens, four stable tabs and navigation/state restoration.
- [ ] Build guest-first onboarding, interest selection and optional sign-in without blanket permissions.
- [ ] Build Discover with search, genuine recently-used icons, category grid, restrained feature tile and compact app rows.
- [ ] Build details, curated Trending, Saved/history and grouped Profile settings; show truthful empty states until data exists.
- [ ] Connect screens to the real API; implement loading, retry, empty, retired, disabled and offline states.
- [ ] Preserve browse position after player exit; give Try controls a direct authorized launch path.
- [ ] Add pull-down recent/saved launcher after basic navigation works, with visible alternatives and clear refresh interaction.

### Test
- [ ] Run Compose navigation and UI smoke tests plus screenshot comparisons on agreed emulator configurations.
- [ ] Check TalkBack, large fonts, contrast, 48dp touch targets, keyboard overlap and gesture conflicts.
- [ ] Verify first seeded launch within three primary taps after onboarding and native Back behavior.

### Validation
- [ ] All visible controls function; no fake statistics, fake history or placeholder success states.
- [ ] Compare implementation against the approved visual direction; record any accessibility-driven adjustments.

### Mock run
- [ ] Fresh guest opens onboarding, chooses interests, finds Color Clash, plays, returns to the same feed position and saves another app.

## 8. Android runtime, isolated origins and secure delivery

### Build
- [x] Implement session authorization by app/version identity; reject arbitrary runtime URLs and untrusted deep-link parameters.
- [x] Verify signed metadata, grant lifetime and asset hashes before execution; pin each active session to one immutable version.
- [ ] Establish separate app origins, local HTTPS and debug-only certificate trust. Document emulator access through 10.0.2.2 and hostname/certificate routing.
- [x] Add the host-owned title/creator header and overflow/close capsule outside the WebView.
- [ ] Start with no native bridge; block file/content access, mixed content, popups, downloads, unexpected navigation and sensitive permission requests.
- [ ] Enforce restrictive CSP and host request checks, including subresources and redirects; explicitly test/document limits rather than promise perfect egress containment.
- [ ] Disable unnecessary storage/service-worker functionality initially; enable only with an explicit isolation and cleanup strategy.
- [ ] Implement renderer failure recovery, cache verification, app-scoped cleanup, expiry and online suspension enforcement.

### Test
- [ ] Test forged/expired signatures, wrong hashes, unknown origin, redirects, javascript URLs, popups, downloads and undeclared network attempts.
- [ ] Test app A-to-B cookie/storage leakage, service-worker persistence, deletion and cache reuse across versions.
- [ ] Test background/foreground, process recreation, renderer crash and rapid app switching.

### Validation
- [ ] Unsupported WebView security capabilities cause a safe refusal or a verified restricted fallback.
- [ ] Public sessions require approved active releases; private sessions require validated bundles and explicit tester authorization.
- [x] No mini-app triggers a native package installation or receives platform account credentials.

### Mock run
- [ ] Launch two real mini-apps sequentially, test storage boundaries, tamper with a cached asset, and attempt an unauthorized URL launch.

## 9. Catalog API and public share/deep-link flows

### Build
- [x] Implement catalog/detail/search with category filters, cursor pagination, editorial ordering, blocks and eligibility filtering.
- [x] Implement session start/end, save/unsave, report and block endpoints with guest/account rules.
- [x] Build public /m/:slug metadata pages with app description, QR/copy link and official host installation link when available.
- [ ] Implement Android deep-link routing and App Links configuration; require owned domain/signing details for verified-link acceptance.
- [ ] Keep unknown/uninstalled/retired-app routes understandable. Do not promise deferred deep linking through installation without a designed mechanism.
- [x] Use synthetic seed content explicitly in development; never invent public adoption metrics or Play listing URLs.

### Test
- [ ] Verify rejected/private/suspended versions are absent from public search and cannot be resolved through guessed identifiers.
- [ ] Test deep links with host installed, missing host, unknown slug, suspended app and malformed parameters.

### Validation
- [x] Share links resolve app identity through the API and cannot inject a player URL.
- [ ] Verified App Links are separately tested on a device with the actual domain configuration; local intent tests do not count as verification.

### Mock run
- [ ] Share Decision Spinner, open it on the emulator, then open its landing page in a browser; verify that uploaded JavaScript is not executed there.

## 10. Developer dashboard and CLI

### Build
- [x] Build app creation, editable draft metadata, icon/screenshots, upload progress, validation findings, version history and review submission.
- [x] Implement CLI init, validate, login, deploy and status with SDK-enabled templates.
- [ ] Support private previews with explicit owner/tester authorization and Android launch links.
- [x] Show real review states/reasons and approved-release publication, pause and rollback controls.
- [x] Handle auth expiry, network failure, duplicate versions and partial upload retries with useful errors.
- [x] Until package publication, document workspace CLI execution rather than claim npx firsttry is available publicly.

### Test
- [ ] Scaffold/build/deploy from a clean directory and exercise manifest failures and credential expiry.
- [ ] Run browser tests for listing creation, upload failure/retry and deployment/review status.
- [ ] Verify the CLI and dashboard cannot bypass public approval.

### Validation
- [x] A developer reaches an authorized Android preview without writing backend code.
- [x] Changed code requires a new immutable version and new public review.

### Mock run
- [ ] Developer A scaffolds a mini-app, deploys privately, opens Android preview, submits review and sees the moderator's decision.

## 11. Moderation, review, publishing and takedown

### Build
- [ ] Build review queue, validation findings, metadata snapshots and a manual functional/content checklist.
- [ ] Provide authenticated moderator testing in the restricted Android host; static dashboard previews never execute uploaded code.
- [x] Implement reasoned approve/reject, report triage, app/version disable, creator suspension, feature curation and audit views.
- [x] Publish only eligible approved versions transactionally; review approval alone does not automatically grant editorial public placement.
- [x] Permit rollback only to previously approved, currently eligible versions. Suspension overrides release pointers and cached grants at renewal.
- [x] Record actor, target version, action, reason and time in access-controlled audit records.

### Test
- [ ] Exercise repeated decisions, stale decisions, concurrent publish/suspend, cross-owner actions and rollback to rejected versions.
- [ ] Test launch denial and active-session shutdown under online, delayed-network and expired-offline conditions.

### Validation
- [x] Reports reach the queue; takedown effect is demonstrated and measured against the documented authorization/polling limits.
- [x] Internal moderator notes remain hidden from developers and reporters.

### Mock run
- [ ] Reject v1, approve corrected v2, publish v2, submit a report, suspend it and observe the consumer result plus audit trail.

## 12. SDK message protocol and real analytics

### Build
- [ ] Keep the first bridge-free player limited to host-observed starts/ends and host-owned feedback; label completion analytics as unavailable until implemented.
- [x] Add a narrowly scoped, feature-checked message transport for ready/context, allowed events, feedback request and close.
- [x] Validate sender origin/frame, session nonce, app/version, grant, method, schema, payload limits and rate; never provide generic native invocation.
- [x] Keep local browser mock transport explicit and excluded from real analytics.
- [ ] Implement bounded event batching, retry/deduplication and version-bound sessions, plus aggregate developer dashboards.
- [x] Define meaningful completion events for each seed; exclude entered spinner choices and other free text from telemetry.
- [x] Distinguish host-observed activity from developer-reported events, which are not proof of genuine user engagement.

### Test
- [ ] Test wrong-origin/frame messages, replay, stale nonces, unsupported methods, oversized payloads and spam.
- [x] Retry identical event batches and verify no double counting; test version separation and developer isolation.
- [ ] Test small-cohort suppression and retention deletion.

### Validation
- [x] SDK completion events appear only after authenticated protocol handling works on Android; no mock events enter production aggregates.
- [ ] Developers see actual permitted aggregates without cross-app identities or raw personal data.

### Mock run
- [ ] Finish Color Clash once, retry delivery, submit feedback and verify one session/completion and the correct version's dashboard totals.

## 13. Feedback, privacy, blocking and deletion

### Build
- [ ] Add optional exit feedback, rating/text bounds, frequency caps and non-blocking dismissal.
- [x] Implement report categories, abuse limits, reporter-visible status and creator blocking across search, catalog and launch.
- [ ] Add app-data cleanup and account deletion covering storage, sessions and linked data according to documented retention rules.
- [x] Redact developer-visible feedback and define handling/retention for user-entered personal information.
- [ ] Provide clear privacy copy and separate listing disclosures for each mini-app.

### Test
- [ ] Test feedback spam, malicious text, blank/long input, report retries and blocked-creator deep links.
- [ ] Verify deletion across database, host storage and retained aggregates; distinguish removed, anonymized and legally retained records.

### Validation
- [x] Feedback never prevents exit; block and delete controls have observable effects and truthful explanations.
- [x] No unsupported claim of universal anonymous telemetry or complete redaction.

### Mock run
- [ ] Guest reports an app, blocks its creator, confirms disappearance, clears local app data and exercises the account deletion route with a seeded account.

## 14. Complete seed inventory and consumer polish

### Build
- [x] Add Focus Sprint with foreground timer/completion, Tiny Quiz with bundled questions/results, and Meme Remix with bundled templates/local text preview.
- [x] Keep uploads, unsafe social publishing and background timer guarantees out of scope.
- [ ] Add optional Habit Check-In and Typing Sprint only after the six-app acceptance target is stable.
- [ ] Complete curated diversity, truthful durations, thumbnails, onboarding and loading/error consistency.

### Test
- [ ] Run every seed through validate, review, Android play, completion/replay and exit.
- [ ] Check Timer lifecycle behavior, quiz answer handling and template text layout on small phones.

### Validation
- [x] At least six genuinely usable reviewed mini-apps are discoverable; every visible Try works.

### Mock run
- [ ] New consumer tries two different categories, saves one, closes/reopens the host and revisits through recent/saved inventory.

## 15. Automated quality gates, performance and operations

### Build
- [ ] Configure CI for lint/type checks, unit/integration tests, web production build and Android build/instrumentation where runners permit.
- [x] Use Vitest for TypeScript, Playwright for browser flows and JUnit/Compose instrumentation for Android; keep screenshots and failure logs.
- [ ] Add structured redacted logs, request IDs, health checks, job metrics, retention jobs and dependency/secret scanning.
- [ ] Implement scoped upload/API limits, deployment separation, backup/restore procedure and storage cleanup.
- [ ] Define initial measured performance budgets for cold/warm launch, download size, memory and API ingestion. Record hardware, WebView version and network conditions.

### Test
- [ ] Run full developer-to-Android-to-dashboard flow; browser-only tests do not count as Android runtime proof.
- [ ] Benchmark constrained networks, 2GB/3GB device classes, repeated switching and renderer failure.
- [x] Run the specified 100k-event ingestion simulation with controlled concurrency; verify deduplication, latency, resource use and counts.
- [ ] Restore a development backup and rehearse worker/API interruption during upload/publication.

### Validation
- [ ] Critical functional/security checks pass; unresolved high-severity findings prevent public release.
- [ ] Record executed, passed, failed and blocked checks separately; unavailable emulator/device tooling is reported explicitly.

### Mock run
- [ ] Rehearse a service restart, upload failure, database restore and emergency app suspension, recording recovery and user-visible behavior.

## 16. Integrated local mock run: release candidate rehearsal

### Build
- [x] Provide one documented setup path, isolated seed credentials, fixture uploads and reset procedure; production config must reject local shortcuts.
- [ ] Provide emulator configuration and physical-device connectivity instructions with debug-only trust, scoped to the actual LAN/setup.

### Test and mock-run sequence
- [ ] Reset only development data; start database, storage, worker, API and web; check health.
- [ ] Launch the Android debug host and onboard as a guest.
- [ ] Developer A creates Color Clash and uploads a validated private v1.
- [ ] Developer A opens its private Android preview; an unrelated tester is denied.
- [ ] Moderator reviews and approves; developer publishes after any required curation decision.
- [ ] Guest finds Color Clash in Discover, launches in three or fewer primary taps after onboarding and plays a complete round.
- [ ] Guest exits without being trapped, leaves optional feedback, saves and shares the app.
- [ ] Confirm the actual session/completion/feedback in developer A's dashboard; developer B cannot access it.
- [ ] Upload v2; verify it cannot be public before approval and an existing session stays pinned to v1.
- [ ] Approve/publish v2, launch it in a new session and roll back to eligible approved v1.
- [ ] Report and suspend the app; verify new-launch denial and active-session enforcement within the documented limits.
- [ ] Try malicious fixtures, a forged deep link and an altered cached asset; verify rejection.
- [ ] Disconnect the network and exercise expiry/loading/error behavior; reconnect and verify recovery.
- [ ] Reopen Saved/history, test blocking and clear app data; collect logs, screenshots and database evidence.

### Validation
- [ ] Save a repeatable demo script with expected outcomes and actual test results.
- [ ] Repeat core flow on a physical Android phone; verified domain/App Links checks require real configuration.
- [ ] Confirm the only installed application package is the FirstTry host; mini-app bundles remain host-managed web content.

## 17. Delivery documentation and controlled-alpha/public-release gates

### Build
- [x] Deliver README, API.md, DECISIONS.md, ROADMAP.md, THREAT_MODEL.md, TEST_PLAN.md, TEST_RESULTS.md and PLAY_REVIEW_CHECKLIST.md.
- [ ] Document Windows commands, Android Studio setup, local HTTPS/origins, seed accounts, migrations, deployment/review and incident procedures.
- [x] Document SDK supported/unsupported behavior, native capability limits and developer bundle requirements.
- [x] Record external dependencies: acquired domain, release signing, host store listing, email verification and independent review.

### Test
- [ ] Follow quickstart from a clean environment; run final acceptance checklist and reproducible builds.
- [ ] Confirm release artifacts omit debug certificate trust, seed credentials and development bypasses.

### Validation
- [ ] **Local MVP:** six usable seeds, complete publish/play/feedback flow, negative authorization checks and reproducible local setup pass.
- [ ] **Controlled alpha:** invited identities, staffed review/report handling, operational monitoring, backup/restore and actual device testing are ready.
- [ ] **Public/Play release:** obtain independent Android/WebView and backend security review; resolve blocking findings and verify current policies/API targets.
- [ ] Prepare truthful privacy/Data Safety/content-rating disclosures, working deletion, reviewer access, signing and verified links. Store approval is external and not guaranteed.

### Mock run
- [ ] Rehearse both a consumer demonstration and a moderator safety incident using release-candidate configuration; record unresolved prerequisites explicitly.

## 18. Execution order and reviewable milestones

1. [ ] **M0 - Foundation:** Sections 1-4; local services, contracts, schema, auth and CI skeleton. Evidence: clean setup and authorization tests.
2. [ ] **M1 - First Android experience:** initial parts of Sections 5, 7-9; approved seeded Color Clash through the bridge-free real Android player. Evidence: emulator recording and runtime denial tests.
3. [ ] **M2 - Three-app host:** complete three seeds, basic saved/history, feedback and isolation. Evidence: all three playable on Android, no cross-app storage leakage.
4. [ ] **M3 - Publishing pipeline:** Sections 6, 10-11 plus private session authorization. Evidence: CLI upload -> private Android preview -> review -> public launch.
5. [ ] **M4 - SDK and validation loop:** Sections 12-13; narrow message protocol, actual analytics, reports, blocking and rollback. Evidence: completed-round analytics and suspension rehearsal.
6. [ ] **M5 - Full local MVP:** Sections 14-16; six usable seeds, accessibility, performance and complete integrated rehearsal. Evidence: acceptance matrix and recorded results.
7. [ ] **M6 - Alpha/release preparation:** Section 17; operations, independent review and domain/store prerequisites. Evidence: explicit readiness gates, with external approvals tracked separately.

Milestone discipline:
- [ ] At each checkpoint report files changed, journeys working, exact commands run, test evidence, blocked checks and the next bounded milestone.
- [ ] Do not substitute static screens for working behavior or declare a later milestone complete because its UI exists.
- [ ] Keep implementation sequential where security contracts are dependencies; narrow message capabilities follow the tested bridge-free runtime.
- [ ] Add scheduling estimates only after prerequisite checks and the first runtime/publishing spikes reveal actual constraints.