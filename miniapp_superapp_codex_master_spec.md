# PROJECT MASTER SPEC — Mini-App Discovery Super-App + Instant Developer Deployment

**Status:** Product definition and build instructions (v1.1, 20 October 2026; WeChat-inspired interface revision)  
**Working name:** FirstTry (placeholder; do not assume domain/trademark availability)  
**Target:** Android first, India-friendly/global-ready.  
**Audience:** Codex coding agent, engineering team, product/design, security reviewers.  
**Directive:** Start implementing a functional vertical slice following the acceptance criteria, not just producing mockups.

---

## 0. HOW CODEX SHOULD USE THIS DOCUMENT

You are building a real product, not a landing-page demo. Start by inspecting the repository and following its conventions. If the repository is empty, create the monorepo defined below. Build incrementally: infrastructure, data models, seed mini-apps, developer deployment, consumer discovery UI, Android runtime, analytics, and administration. Produce working code, migrations, automated tests, environment example files, local development instructions, and a concise decisions log. Keep credentials out of git; do not invent API keys. Record deviations from this spec in `docs/DECISIONS.md`.

**Non-negotiable:** Only the platform's Android host app is installed. No developer mini-app is an APK, AAB, DEX, JAR, SO, native executable, dynamic plugin, or separately installed Android package. Mini-apps are strictly hosted, reviewed HTML/CSS/JS experiences executed inside isolated and tightly restricted host-managed WebViews. Mini-app content may be cached in host storage for performance, but it has no independent Android package, OS identity, permissions or file access. The super-app enforces security, privacy, moderation, discovery and trust.

**Clarification of product thesis:** Consumers install the super-app because it is a compelling **destination for discovering and using a continual stream of new mini-apps**—games, memes, creative experiences, AI tools, productivity and playful experiments. They do not install it merely to test somebody else's prototype. Developers contribute content to the ecosystem, get immediate distribution and feedback, and learn whether a product is worth developing into a standalone application. The super-app has its own consumer network effect.

**Default build assumptions:** English UI first with i18n-ready structure; Android phones first; portrait responsive design; 18+ beta to simplify initial moderation; no payments/ads/chat/user uploads in MVP; invited developers; publicly discoverable *reviewed* mini-apps, plus invite-only testing; one active mini-app session at a time; default no sensitive device permissions; guest browsing with optional login; no arbitrary third-party script origin access. Local run should work without paid cloud accounts via mocks/emulators. These choices are not claims about future permanent product scope.

---

## 1. BUSINESS IDEA AND DIFFERENTIATION

### 1.1 The problem

**For developers:** An MVP idea takes minutes or hours to prototype, but distributing native Android releases, recruiting users, soliciting feedback and comparing iterations is cumbersome. Existing developer products handle builds or invitation lists but seldom provide an engaged consumer discovery network. 

**For consumers:** App stores favor stable, polished applications; trying a curious one-off game, interactive meme or micro-utility entails installs, permissions, storage, updates and clutter. People want an easy place to discover clever new experiences instantly, rate them, share them and influence what gets built.

### 1.2 The solution

A trusted host app containing a curated and eventually algorithmic feed of mini-apps. A user taps **Try Now** and runs the experience instantly in a contained WebView without installing an APK. Within the host, users can explore categories, save apps, follow creators, try something trending, share a deep link, and submit short feedback. Developers deploy versioned mini-app bundles from a CLI or dashboard, review analytics, iterate rapidly, manage exposure, and optionally graduate a validated idea to a separate published app.

### 1.3 Two-sided marketplace

- Supply: indie developers, students, AI-assisted builders, small game makers, solo founders, agencies and hackathon participants.
- Demand: curious consumers, gamers, early adopters, meme creators, productivity enthusiasts and people who like trying new experiences.
- Exchange: developers supply fast, inventive experiences; consumers supply attention, organic sharing, signals of interest, feedback and retention; platform supplies infrastructure, discovery, safety and trust.
- Feedback loop: more high-quality mini-apps -> consumer discovery value -> engaged users -> more valuable validation -> more developers -> improved variety. **The loop fails if the feed fills with low-quality prototypes.** Curate aggressively at first.

### 1.4 Positioning

Consumer: **One app. Endless new things to try. No individual app downloads.**
Developer: **Deploy a mini-app in minutes. Reach real users. Learn what to build next.**
Brand personality: playful, fresh, curious, credible, privacy-first, not a dumping ground for broken demos.

### 1.5 Competitors and risks

- WeChat Mini Programs / Telegram Mini Apps: show host-based distribution works; have entrenched audiences; our initial differentiation is independent discovery of *new experiments* + explicit developer analytics, iteration and graduation. Do not assert the underlying technology is novel.
- Poki, CrazyGames, itch.io: instant games and indie discovery; our focus includes useful micro-apps and creative experiments, not just games.
- Product Hunt: product discovery; ours is **try in place**, not merely follow a link.
- Expo Go and Firebase App Distribution: developer testing workflows, not a consumer discovery destination.
- Browser + Vercel/PWA: low-friction URLs, but no dedicated trusted consumer destination/community; strong substitute for simple use cases.
- Key risks: retention, content quality, network-effect cold start, creator incentives, platform liability, JavaScript bridge vulnerabilities, spoofed apps, Play Store policy compliance, monetization.

### 1.6 Business model: hypotheses, not validated demand

**Phase 1:** free consumers, free capped developer tier; success metric is consumer retention and repeat cross-mini-app use, not revenue.  
**Phase 2:** paid developer experiments ($15–$49/mo hypotheses) for expanded analytics, private cohorts, A/B experiments, deployment history and insights. Optionally usage-based campaign credits.  
**Phase 3:** featured discovery placements clearly disclosed, creator revenue share for approved experiences, sponsored challenges, curated brands/partnerships. Add payments only after policy, consumer protection and merchant flows are properly designed. Do not implement monetization in initial MVP.

### 1.7 Metrics

North-star: **weekly engaged users who meaningfully use two or more distinct mini-apps**. Avoid raw opens as a vanity metric.
Consumer: DAU/WAU, first-app launch success, browse-to-try conversion, meaningful action completion, D1/D7/D30 retention, unique mini-apps/user, cross-app exploration, save/share/follow rates, explicit satisfaction, safety reports.
Developer: time from repo to approved preview, deployment success, approval turnaround, unique qualified testers, repeat deployment ratio, version comparison, validated ideas, paying conversion.
Marketplace: active vetted mini-apps, supply by category, click-through by category, editorial quality score, abuse reports/1000 sessions, median review time, diversification, inventory freshness.
Guardrails: crash-free sessions, suspicious outbound requests, privacy complaints, WebView process kills, review backlog, time-to-takedown.

---

## 2. PRODUCT SURFACES AND INFORMATION ARCHITECTURE

### 2.1 Android consumer super-app (primary user destination)

Tabs:
1. **Discover** — WeChat-inspired search, recently-used mini-app launcher, category grid, restrained featured tile and compact curated app rows; see Section 5.
2. **Trending** — time-window-ranked experiences by quality-adjusted engagement; filters Games / Fun / AI / Utility / Creative.
3. **Saved** — bookmarked mini-apps and optionally history/recently tried; offline placeholder handling.
4. **Profile** — account, preferences, consent and privacy settings, feedback history, blocked developers, support, report history, terms.

Global features: search, deep-link handling, mini-app detail pages, mini-app container/player, persistent host toolbar, share sheet, report/block controls, feedback sheet, app status (new / trending / experimental / graduated), tasteful onboarding.

**Mini-app card:** icon/thumbnail, title, two-line utility or hook, category, approximate interaction length ('30 sec', '2 min'), creator, trust badge only when grounded in verification, try button, save button, age/content rating where relevant, optional number of tries but never fabricated.

**Player:** Always hosted, visibly branded shell; native app title/creator and a WeChat-inspired overflow/close capsule; overflow includes report / privacy details / clear app data / block creator; loading and error states; safe WebView contained below trusted native header. Detailed behavior is defined in Section 5. On exit prompt optionally: 'Was that fun/useful?' with quick rating and optional feedback; frequency capped.

**Onboarding:** Welcome emphasizing discovery (not 'test apps'), explain no per-app downloads and host-controlled access; select 2–3 interests; optional sign-in; transparent privacy and data-use explanation; don't ask blanket Android permissions during onboarding.

### 2.2 Developer web dashboard

Routes: `/developer`, `/developer/apps`, `/developer/apps/new`, `/developer/apps/:id`, `/:id/deployments`, `/:id/analytics`, `/:id/feedback`, `/:id/audience`, `/:id/settings`, `/developer/account`.

Functions: verified developer registration, create draft listing, upload bundle via CLI/browser, manifest validation, security checks, private preview link, review submission, immutable versions, review status, visibility (private/unlisted/curated-public), launch experiment, traffic funnels, cohorts, feedback, stop/pause/delete, rollback to previous **approved** bundle, graduation link.

### 2.3 Moderator/admin console

Routes `/admin/review`, `/admin/apps`, `/admin/reports`, `/admin/developers`, `/admin/audit`, `/admin/flags`, `/admin/featured`.

Functions: application and version queue, scan findings, static previews, manual test checklist, approve/reject with reason, per-version publish/disable, account suspension, content report triage, feed curation, kill switch, audit log. Restrict to admin roles, no public access.

### 2.4 Public website and share landing

Public pages explain ecosystem and developer workflow. Mini-app link `/m/:slug` resolves to an Android App Link; if host installed, launch inside host; if not installed, show authentic mini-app description, screenshots and official host installation link. A browser **marketing preview** may be offered for eligible apps but must never substitute arbitrary untrusted execution or contradict host-only deployment policy. For the first MVP, do not run uploaded mini-app JavaScript in an uncontrolled browser preview. Provide QR and copy link.

---

## 3. JOURNEYS AND DETAILED WALKTHROUGHS

### Journey A: New consumer discovers app organically

1. Consumer sees a shared link or Play listing: 'Try 100s of new micro-experiences'.
2. Installs the single verified super-app from Google Play.
3. Opens host -> 3-screen lightweight onboarding -> choose categories -> optional guest path.
4. Discover feed populated with reviewed mini-apps: 2 puzzle games, 2 memes/creative apps, 2 utilities, 1 AI demo, plus more.
5. Opens '30-second Color Clash'. Host displays clear creator identity; mini-app executes inside the host with no APK or broad permissions.
6. Completes game; host logs controlled launch/action events and asks one optional feedback question; consumer rates, saves, shares.
7. Returns to discovery; next session opens another app; saved list lets them revisit.
8. Later sees new experiments and trending rankings. Platform is compelling even without a developer inviting them.

Acceptance: first launch of a seeded app with <=3 primary taps after onboarding, no Android installation other than host; feedback never blocks exiting.

### Journey B: Returning consumer browses mini-app categories

1. Open super-app -> `For You` and `New` cards.
2. Switch to `Games` category; filter to quick games.
3. Tap card -> detail -> Try now -> player; back to category preserves scroll position.
4. Bookmark; optionally follow developer for updates. If app is retired, show graceful 'experiment ended' page and recommendations.
5. Share deep link; recipient opens exact mini-app after host install/launch.

### Journey C: Developer launches first experiment

1. Visit developer website and read SDK limits.
2. Create account; accept developer terms and content policy; verify email/identity according to beta program.
3. Use `npx firsttry init` to scaffold TypeScript/Vite mini-app using platform SDK.
4. Build UI in local browser preview; API mocks for platform events and storage.
5. Run `npx firsttry validate` for manifest/assets/bundle CSP/API restrictions.
6. Run `npx firsttry deploy` (or dashboard ZIP upload) -> upload -> immutable version -> private preview link. Preview is hosted in same Android shell; available only to authorized accounts/testers.
7. Developer tests on Android and submits metadata/icon/screenshots/age rating; clicks Submit for Review.
8. Automated validation + human review; status `approved`/`rejected` with rationale. **No public release of arbitrary code before approval.**
9. Switch visibility to curated public after approval and editorial selection, or share invite-only testing link.
10. Dashboard displays starts, completed meaningful events, D1 repeat use, feedback, crashes; developer iterates with new reviewed version; compare cohorts.
11. Success -> 'Graduated' badge and external Play Store link only if developer has genuinely published a compliant independent app; app can remain in super-app with suitable policy or be archived.

Acceptance: first developer can go from starter template to reviewable preview without writing backend code; rejected code cannot go public.

### Journey D: Developer releases v2

1. Modify mini-app, bump version and deploy new immutable bundle.
2. Security and policy scans rerun; approval **does not carry over to changed code**.
3. Developer chooses launch cohort or full replacement only after approval.
4. Host reads signed manifest with version hash; active sessions remain pinned to immutable version; new sessions get new published version.
5. Compare versions (start rate, completion, repeat usage); rollback means remapping active release to a previously **approved** bundle. Audit all changes.

### Journey E: User feedback and reports

1. After player exit, host asks quick satisfaction thumbs up/down and optional 140-character text.
2. User chooses Send; consumer consent handling and anti-spam limits apply.
3. Developer sees feedback in aggregate and redacted form; never raw personally identifying device IDs.
4. Any user can open host menu -> Report mini-app (harmful, scam, privacy, IP complaint, other).
5. Report immediately enters admin queue; safety-severity rules trigger provisional suspension or review escalation.
6. Moderator investigates immutable version and audit; publishes decision and reason; users can block developer/app.

### Journey F: Host permission request

1. Mini-app calls approved SDK operation, e.g. `firsttry.media.pickImage()`.
2. Host checks declared capability, developer approval and current app policy, then displays host-controlled permission explanation.
3. If Android OS permission needed, host asks only when necessary, using least-privileged picker APIs.
4. User denies -> SDK gets structured denial; mini-app remains usable where feasible.
5. If allowed, send only selected media URI/content under a short-lived constrained operation, not a general filesystem permission.
6. Log capability invocation with privacy-safe metadata; enable user revocation/clear data.

MVP recommendation: implement **no camera, location, microphone, clipboard or contacts bridge at first**; implement theme, haptics where safely possible, app-scoped ephemeral identifier, host-driven feedback and simple storage only after security review.

### Journey G: Malicious or broken mini-app

1. Developer uploads bundle with suspicious external scripts, obfuscated code or undeclared network destination.
2. Validation fails or review blocks release; developer sees precise actionable reason.
3. A previously approved mini-app is reported for malicious behavior -> admin disables version/app server-side.
4. Host enforces deny on launch and stops/purges affected sessions/cache as soon as reliable control signal arrives; show user-safe notice.
5. Moderator records incident; revoke developer credentials and review impacted data/notifications.
6. **Never promise impossible guarantees**: installed host, OS WebView and JavaScript engine must still be maintained and audited; remote kill switches require network reachability, so default to short cached authorizations and safe offline deny for untrusted expired releases.

### Journey H: App graduation

1. Developer marks app 'Ready to graduate'.
2. Dashboard shows summary: qualified tries, cohorts, engagement, satisfaction and leading user requests.
3. Provide source and platform compatibility/export guidance. The mini-app is **not** automatically an Android-native app; native packaging requires a separate build, testing and Play submission process.
4. On verified standalone launch, add outbound link and a transparent 'Graduated' status. Respect Google Play payments and outbound-linking rules applicable at the time.

---

## 4. MVP VS PHASED ROADMAP

### Phase 0 — Functional local vertical slice (START HERE)

- Working monorepo with PostgreSQL, backend API, React dashboard, native Kotlin Android host, SDK and CLI.
- Seed 6–10 realistic mini-app bundles, not empty placeholders: Color Clash (puzzle), Tap Reflex (game), Meme Mixer (static template-based, no public upload), Focus Sprint (timer), Decision Spinner, Habit Check-In, Typing Sprint and Unit Quiz; prioritize 3 polished seed experiences.
- Discover, detail, player, save/history, search, feedback, report, minimal profile, deep links, and public link landing.
- Developer create app, manifest upload, private preview, submit review, admin approve, publish, view events; no automatic unreviewed publishing.
- Immutable asset manifests, deploy version, host loading only approved versions for public listings.
- End-to-end test: developer publish -> admin approve -> consumer sees card -> launches mini-app -> event -> feedback -> developer dashboard.

### Phase 1 — Controlled alpha (invited developers and users)

- Better onboarding and curated category feed; identity and moderation; privacy/settings; login; app blocking; data deletion.
- Restricted native capability broker only after threat modeling and tests.
- Version rollout/rollback and analytics comparison.
- Play testing-track submission plus policy/legal/security review.

### Phase 2 — Public marketplace

- More developer sign-ups with reputation and verification; scalable moderation; ranking and recommendations with diversity, freshness and quality guards.
- Creator profiles and follows; badges, experiments/challenges, carefully managed notifications.
- Revenue experiments, if justified by measured consumer retention and developer payment behavior.

### Phase 3 — Mature ecosystem

- Controlled SDK expansion, opt-in cohorts, campaign targeting, experiment outcomes, developer monetization and compliant in-host payments, advanced discovery, localization, creator partnerships, branded collections. Features require separate privacy, policy and security review.

**Explicitly out of scope for v1:** APK sideloading or native code execution; arbitrary Flutter/React Native binaries; arbitrary remote URLs inside privileged WebView; unrestricted JavaScript bridges; payments; AI code generation; messaging/social DMs; user-posted public media; creator revenue distribution; push spam; app-store scraping; unreviewed direct-to-public deployments; background mini-app execution.

---

## 5. UX / VISUAL DESIGN SYSTEM

### 5.1 Primary reference: WeChat

**User-directed design revision (20 October 2026): borrow heavily from WeChat for the interface.** WeChat is the primary reference for the host's navigation, visual density, mini-app launcher, grouped lists, restrained color, and persistent mini-app controls. This replaces the earlier direction favoring large, vibrant editorial cards and a visually elaborate discovery feed. Retain FirstTry's own name, assets, copy and creator identity.

Adapt these interaction patterns to a discovery-first product: the default screen opens useful mini-app inventory immediately. Keep the four MVP tabs **Discover / Trending / Saved / Profile**. Messaging, contacts, payments and a social timeline remain outside MVP scope. This is an interface direction; the runtime remains the restricted HTML/CSS/JS contract in Sections 6 and 7, with no WeChat SDK/runtime dependency.

### 5.2 Visual language

- Default light theme: neutral gray canvas `#EDEDED`, white grouped surfaces `#FFFFFF`, primary text `#191919`, secondary text `#737373`, subtle separators `#E5E5E5`, and a restrained green primary accent `#07A160`. Validate final contrast before delivery, especially text on green controls.
- Dark theme follows system preference: near-black canvas, dark grouped surfaces, readable text and the same restrained accent. Do not introduce violet/cyan gradients as the host's default visual identity.
- Use Android system typography, clear page titles, compact supporting text, simple line icons and familiar native back navigation.
- Use flat grouped lists, thin dividers, modest 8-12dp surface corners, and rounded-square app icons. Reserve expressive color and illustration for mini-app icons, thumbnails and mini-app content.
- Keep spacing calm and compact, while preserving accessible 48dp touch targets, readable text scaling and visible focus states. Secondary copy remains legible rather than becoming decorative microtext.
- Bottom navigation has four stable destinations, labeled icons and a restrained selected accent. Avoid floating navigation bars, glass effects and excessive shadows.
- Motion is brief and functional, approximately 150-250ms, with reduced-motion support.

### 5.3 Discover and mini-app launcher

Initial screen order:
1. Compact native header with FirstTry title and search access.
2. Search field for mini-app names, categories and creators.
3. **Recently used**: a compact row of rounded-square app icons with short labels; show only real history. Hide this section for a new user without history.
4. **Categories**: a compact icon grid for Games, Fun, Creative and Utility; show AI only when eligible inventory exists.
5. **Featured**: at most one restrained editorial tile with a real playable experience.
6. **New mini-apps** and **Recommended**: compact white grouped rows with icon, name, short hook, creator/category, approximate duration and clear Try action. Recommendations are curated initially.

A row opens app details; its explicit Try action launches the authorized app directly. The recently-used launcher also opens the authorized app directly. Keep save available on details and in the host menu instead of crowding every compact row. No fake activity counts or fake recents.

Add a pull-down launcher for Recently used and Saved, inspired by the mini-program taskbar pattern. The visible Recently used section and Saved tab provide equivalent access without a gesture. Treat the launcher as a secondary enhancement after the basic Android journey works. Distinguish it from refresh and test gesture arbitration, accessibility and accidental activation.

Trending uses a compact ranked list with category filters and actual quality-qualified signals; do not fabricate rankings before data exists. Saved combines saved apps and recently used views, with explicit empty and retired-app states.

### 5.4 Details and trusted player shell

- Detail page: app icon, title, creator, short description, duration/category/rating, privacy summary, screenshots when available, primary Try button and secondary Save/Share actions. Keep the layout straightforward and native-feeling.
- Use a persistent **host-owned top bar** with app title/creator and a compact right-side capsule containing overflow and close controls, drawing from the WeChat mini-program control pattern. Give both controls accessible labels and 48dp hit areas even if the visible capsule is smaller.
- The header lives outside the WebView and cannot be covered or replaced by mini-app content. App-specific visual styling starts below it; host chrome remains recognizable and consistent.
- Overflow opens a native bottom sheet with Save/Unsave, Share, Feedback, Privacy details, Clear app data, Report and Block creator, as supported by the current milestone. Do not display non-functional controls.
- Close returns to the prior discovery context with scroll position preserved. Android Back first follows the defined safe in-app navigation policy, then exits to the host. Neither path traps the user behind feedback.
- Show host-controlled launch progress, retry, disabled/expired authorization and renderer-error screens rather than an empty WebView.

### 5.5 Profile, supporting surfaces and accessibility

Profile uses grouped settings rows with leading icons, text and trailing chevrons: account/guest status, interests, privacy, app data, blocked creators, reports, support and legal pages. Feedback uses a small native sheet with optional rating/text and a clearly available dismiss action.

Developer and admin dashboards use the same restrained typography, neutral surfaces and green action accent, with desktop-appropriate side navigation, tables and review forms. Consumer familiarity should not reduce scanability of moderation queues or deployment details.

Consumer screens to implement in order: onboarding -> Discover -> category/results -> mini-app details -> player -> feedback -> saved -> profile/privacy -> blocked/report status. Developer screens: overview -> app creation -> deployment -> review status -> analytics -> feedback -> settings. Admin screens: queue -> app detail -> decision -> report triage -> audit.

Verify TalkBack, large font sizes, keyboard navigation on web/admin, adequate contrast, native Back, scroll restoration and accessible alternatives to gestures. Every visible Try control must open a working authorized mini-app. Public web share pages remain metadata/install pages; these design changes do not authorize execution of uploaded unreviewed JavaScript in a public browser.

### 5.6 Reference notes

Reference the interaction patterns rather than asserting an exact copy of a particular WeChat release; layouts vary by platform, region and version. Sources consulted for this design direction:
- Tencent product overview: https://www.tencent.com/products/weixin-wechat/
- Tencent CloudBase documentation identifies pull-down entries for Recently Used and My Mini Programs: https://docs.cloudbase.net/en/lowcode/components/wedaUI/src/docs/compsdocs/wxOpen/WdOfficialAccount
- UX analysis of the mini-program launcher pattern: https://www.nngroup.com/articles/wechat-mini-programs/

---
## 6. TECHNICAL ARCHITECTURE

### 6.1 Stack

- Monorepo: pnpm workspaces + Turborepo (or pnpm scripts if simpler), TypeScript strict mode.
- `apps/web`: Next.js App Router for marketing + developer + admin dashboards, responsive design.
- `apps/api`: NestJS or Fastify + TypeScript + Zod validation + OpenAPI; choose **Fastify** initially for simplicity.
- `apps/android`: native Kotlin, Jetpack Compose, modern Android WebView, Android App Links, Material 3. Build with current stable Android SDK; verify target API against current Play rules before release.
- `packages/mini-sdk`: typed browser SDK, event protocol, capability manifest schema and local mocks.
- `packages/mini-cli`: Node CLI, build/upload/validate/init commands.
- `packages/shared`: schemas/types, generated API clients.
- `packages/mini-examples`: polished independent Vite mini-apps.
- DB: PostgreSQL with Drizzle ORM (or Prisma if existing repo standard).
- Object storage: local MinIO in dev, S3/R2-compatible private origin in cloud with controlled CDN serving.
- Queue: optional Redis + BullMQ; in initial MVP a DB-backed job runner can suffice, but review/publish tasks must be idempotent.
- Auth: role-based server sessions for dashboard; Android guest-token/session and optional accounts; JWT only where appropriate, short-lived and rotated; never embed admin secrets in app.
- Logs and observability: structured logs, Sentry optional, OpenTelemetry where cheap.

### 6.2 Monorepo layout

```text
/
  apps/
    web/
    api/
    android/
  packages/
    shared/
    mini-sdk/
    mini-cli/
    mini-examples/
  infra/
    docker-compose.yml
    migrations/
  docs/
    DECISIONS.md
    API.md
    THREAT_MODEL.md
    PLAY_REVIEW_CHECKLIST.md
    TEST_PLAN.md
    ROADMAP.md
  .env.example
  pnpm-workspace.yaml
  README.md
```

### 6.3 Core flow

```text
Developer source -> firsttry CLI -> static build -> manifest validation
 -> upload temp private object -> file integrity checks + scanners
 -> immutable version + private preview -> admin review
 -> approved/published release pointer -> CDN/origin with scoped URLs
 -> Android host resolves app ID + approved version -> secure WebView
 -> controlled SDK events/feedback -> platform API -> DB/analytics
 -> developer dashboard + curator/admin oversight
```

### 6.4 Runtime boundaries (critical)

Android OS boundary: only host package installed. Mini-app cannot install packages, execute DEX/native plugins, access Android internals or grant itself device permissions.

Web execution: one controlled WebView per active session; default JavaScript enabled only for vetted mini-app origin, no privileged `addJavascriptInterface` on content from arbitrary URLs. Consider `WebViewCompat.addWebMessageListener` with strict allowed origin rules for a narrowly scoped message channel and confirm security implications in current AndroidX APIs. Avoid file://, content:// and cleartext loads as arbitrary navigation destinations. Block file access and universal file URL access; disable DOM storage only if functionality allows, otherwise partition carefully. Prevent mixed content, third-party cookies, downloads and popups by default. Restrict navigation to app origin; external links explicitly exit through safe host UI. Set strict WebView settings and target platform fixes. Don't assume single WebView profiles magically isolate cookies/localStorage: use dedicated per-app origins and a documented session strategy; assess Android WebView process and profile APIs based on min supported API/version. Sensitive data should not be persisted through untrusted browser storage without design review.

Isolation level: separate domain **per app** such as `app-<opaque-id>.mini.example` (domain reserved only when acquired), never share origin across mutually untrusted apps. The browser same-origin policy provides a boundary, but **does not by itself prevent malicious JS sending network requests**. Apply network constraints server-side (strict CSP `connect-src`, frame restrictions, script-src with hashed bundled scripts) and defense-in-depth host request controls. Because WebView request interception and CSP have blind spots, don't claim perfect egress containment: perform security review, restrict permissions, and avoid passing sensitive user data to mini-apps.

Sensitive capability bridge: begin with zero native capabilities; expand through an independently reviewed host-owned API. Every call validated against origin, app identity, version, capability manifest, user consent, request schema, rate limit, session nonce, operation TTL and audit. Only send minimal response payload. Never pass identity tokens, unrestricted file paths, location data or contacts directly to arbitrary developer JS.

Content integrity: immutable deployment hashes, server-side approved version pointer, signed metadata, TLS, no client-controlled publish status, reasonable cache TTL, deny-list checked online prior to session or via short-lived signed authorization. Rollback only to approved versions. In an offline scenario no newly authenticated unknown app should start.

Abuse controls: verified developer accounts, upload scanning, code size limits, no eval/dynamic code loading in v1, no unapproved external script tags or trackers, rate limits, malware/phishing heuristics, human moderation, user reports, emergency disable, incident audit and retention policy. Any mini-app uses platform-mediated API proxies only when safely constrained; do not build an open proxy or SSRF engine.

**Security gate:** Before public release, obtain independent Android/WebView and backend security review and test with hostile mini-app bundles. A sandbox is not a substitute for review and policy enforcement.

---

## 7. MINI-APP SDK AND MANIFEST

### 7.1 Manifest example

```json
{
  "$schema": "https://docs.example.invalid/firsttry/mini-manifest-v1.schema.json",
  "id": "color-clash",
  "name": "Color Clash",
  "description": "A 30-second color matching game",
  "version": "1.0.0",
  "runtime": "webview-v1",
  "entry": "index.html",
  "category": "games",
  "estimatedDurationSeconds": 30,
  "ageRating": "general",
  "capabilities": ["host.theme", "host.feedback", "host.analytics"],
  "network": { "allowedDomains": [] },
  "assets": { "icon": "icon.png", "cover": "cover.webp" }
}
```

In production, app identity and capability grants are assigned/approved **server-side**, not trusted from self-declared manifest. Verify each file's hash, MIME and path, reject zip-slip and oversized archives. The `$schema` URL above is illustrative; implement a local shared JSON schema and point to a real hosted schema later.

### 7.2 Mini SDK API (safe default)

```ts
import { firsttry } from '@firsttry/mini-sdk';

await firsttry.ready();
const context = await firsttry.context();
// context: appId, approvedVersion, theme, locale, sessionId (ephemeral)
await firsttry.analytics.track('round_completed', { scoreBucket: 'medium' });
await firsttry.feedback.prompt({ reason: 'completed_task' });
await firsttry.ui.close();
```

All analytics event names whitelisted or constrained; payload limited size and types, no freeform PII, full IP, advertising identifiers or cross-app identity. Bridge calls must be authenticated and controlled by host—not a generic JavaScript-to-native invocation mechanism. For local browser preview, SDK uses an explicit mock transport that is never mistaken for real device permission.

### 7.3 CLI commands

```bash
npx firsttry init my-first-mini
cd my-first-mini
npm install
npm run dev
npx firsttry validate
npx firsttry login
npx firsttry deploy --visibility private
npx firsttry status
```

In monorepo development, use `pnpm --filter mini-cli ...` until package publishing. Implement CLI error handling for missing manifest, oversized bundle, unsupported capability, auth expiry and network failure. CLI can publish private preview versions but **cannot bypass approval for public visibility**.

---

## 8. DATABASE MODEL

Use UUID PKs, timestamps, soft-deletion where appropriate, unique constraints, migrations and strict role-level authorization. Suggested tables:

- `users(id, status, display_name, email_nullable, role, created_at, deleted_at)`; role consumer/developer/admin; guest sessions separate.
- `developer_profiles(id, user_id, verification_status, public_name, policy_accepted_at, created_at)`.
- `mini_apps(id, developer_id, slug_unique, title, summary, category, age_rating, icon_asset_id, cover_asset_id, listing_status, visibility, created_at, updated_at)`.
- `mini_versions(id, app_id, semver, bundle_hash, object_key, manifest_json, validation_status, review_status, approved_by, approved_at, created_at)`; unique(app_id, semver); immutable bundle fields.
- `app_releases(app_id, channel, version_id, published_at)`; transactional approved-version pointer; channels `private`, `beta`, `public`.
- `app_capability_grants(app_id, version_id, capability, approved_at)`.
- `app_sessions(id, app_id, version_id, pseudonymous_user_key, started_at, ended_at, exit_reason, client_version)`.
- `events(id, session_id, app_id, event_name, event_props_json, occurred_at, received_at)` with event allowlist and retention.
- `saved_apps(user_id, app_id, saved_at)`.
- `app_feedback(id, app_id, version_id, user_id_nullable, rating, body_redacted, created_at)`.
- `content_reports(id, reporter_id_nullable, app_id, version_id, category, detail_redacted, status, created_at, resolved_at)`.
- `blocked_entities(user_id, entity_type, entity_id, created_at)`.
- `moderation_decisions(id, actor_id, app_id, version_id_nullable, action, reason, created_at)`.
- `audit_logs(id, actor_id, action, entity_type, entity_id, metadata_json, created_at)` append-only.
- `feature_flags(key, value_json, enabled, updated_at)`.
- `app_ranking_daily(app_id, day, impressions, starts, meaningful_actions, saves, reports)` aggregated.
- `share_links(id, app_id, code_unique, channel, created_at, expires_at)` optional.

Important rules: no public read of unpublished versions; no developer access to another developer's analytics/feedback; use aggregate counts for small cohorts carefully to reduce reidentification; expose report status to reporter without leaking moderators' internal notes.

---

## 9. BACKEND API CONTRACT (V1)

All endpoints under `/api/v1`. Define request/response schemas, auth and HTTP errors; generate OpenAPI docs. Examples:

**Consumer**
- `GET /catalog?category=&sort=&cursor=` — only published, active, compliant items, filtered for blocks and age eligibility.
- `GET /catalog/:slug` — full listing + current approved release metadata.
- `GET /search?q=&cursor=` — public searchable catalog.
- `POST /sessions` — server authorizes specific approved app/version, returns short-lived session token and resolved asset origin; never accepts arbitrary runtime URL.
- `POST /sessions/:id/end` — exit reason.
- `POST /events/batch` — validated size-limited telemetry, dedupe with idempotency key.
- `POST /apps/:id/save` and `DELETE /apps/:id/save`.
- `POST /apps/:id/feedback`.
- `POST /apps/:id/report`.
- `POST /developers/:id/block`.
- `DELETE /me/app-data/:appId` / `DELETE /me` with consent and deletion requirements.

**Developer**
- `POST /developer/apps` / `GET /developer/apps` / `PATCH /developer/apps/:id`.
- `POST /developer/apps/:id/uploads/start` — scoped presigned upload to staging; rate-limited.
- `POST /developer/apps/:id/uploads/complete` — validation workflow.
- `GET /developer/apps/:id/versions` / `GET /developer/apps/:id/versions/:versionId`.
- `POST /developer/apps/:id/versions/:versionId/submit-review`.
- `POST /developer/apps/:id/release` — may only point to approved version and allowed channel.
- `POST /developer/apps/:id/pause`.
- `GET /developer/apps/:id/analytics?from=&to=&version=`.
- `GET /developer/apps/:id/feedback?cursor=`.

**Admin**
- `GET /admin/reviews` / `GET /admin/reviews/:versionId`.
- `POST /admin/reviews/:versionId/decision` (approve/reject and reason).
- `GET /admin/reports` / `POST /admin/reports/:id/resolve`.
- `POST /admin/apps/:id/suspend` / `POST /admin/developers/:id/suspend`.
- `GET /admin/audit`.
- `PATCH /admin/featured` editorial slots.

All mutating endpoints enforce auth, CSRF protections for cookie sessions, RBAC + ownership and idempotency for deployments/approvals. Return understandable API errors, not stack traces.

---

## 10. FEED, RANKING AND DISCOVERY

**MVP:** Curated feed first. Ranking should not optimize only for raw clicks. Mix fresh apps, editorial picks, category diversity and quality signals. Suppress high report-rate, crash-heavy, deceptive or broken apps. Avoid the rich-get-richer effect using capped exposure for popular apps and exploration slots for qualified new ones.

Illustrative subsequent score:
`score = 0.20*normalizedStartRate + 0.25*meaningfulCompletion + 0.20*repeatUse + 0.15*saveShare + 0.10*positiveFeedback + 0.10*freshness - riskPenalty`.

The formula is a **placeholder**, not a validated recommender. Use minimum sample size and fraud/rate-abuse filters; cold starts use curation. Never expose sensitive individual behavior to developers.

Seeded content must actually be playable/usable. Give each at least one memorable interaction and distinct identity. Show real metrics or omit counts; never insert fake '2.4k plays' in production UI.

---

## 11. MODERATION, PRIVACY AND PLAY STORE READINESS

### 11.1 Content policy

Prohibit malware, phishing, impersonation, pornographic content, illegal sales, threats/harassment, discriminatory abuse, deceptive monetization, unauthorized IP reuse, dangerous functionality, unauthorized personal data collection, invasive tracking and unapproved user-generated social functionality. Verified developer terms and a moderation appeal process are needed before wider launch. Age restrictions and child-safety rules need explicit legal/policy assessment; initial 18+ onboarding does not automatically exempt the platform from laws or Google Play's Families requirements.

### 11.2 Review process

Static lint + manifest checks + archive integrity + dependency/source map scrutiny as available + network/script policy + human visual/function review on emulator/physical device. Report and block in host UI. Maintain audit and emergency takedown. No guarantee of perfect malware detection; handle incidents actively.

### 11.3 Privacy principles

Platform controls host permissions; per-app pseudonymous identities (no cross-app advertising ID), data minimization, consent, retention schedules, deletion and export requests where applicable. Developer analytics aggregated by default. No blanket access to contacts/location/camera; avoid SDKs with hidden trackers; use a transparent privacy policy for host and listing-level privacy disclosures for mini-apps. Proactively classify telemetry as personal data where applicable. Review Indian DPDP obligations and other jurisdictions prior to public launch.

### 11.4 Google Play considerations (verify when submitting)

Google's policy allows an exception for interpreted code such as JavaScript in WebView but does **not** waive responsibilities for developer-supplied code. It forbids downloading remotely sourced native executable code such as DEX/JAR/SO. Its User-Generated Content requirements include reasonable ongoing moderation, in-app reporting and blocking appropriate to content type. A risky JavaScript interface connected to untrusted or unverified URLs is an explicit danger. The app must accurately disclose its dynamic content, data handling, content rating, moderation, target audience and host functionality. Do not assume the project is preapproved. Seek specialist security and policy review before production listing.

Sources (official, checked October 2026):
- Device & Network Abuse: https://support.google.com/googleplay/android-developer/answer/16559646
- Developer policies / UGC: https://support.google.com/googleplay/android-developer/answer/18258653
- UGC specifics: https://support.google.com/googleplay/android-developer/answer/9876937
- AI-generated content, if supporting AI mini-apps: https://support.google.com/googleplay/android-developer/answer/13985936

### 11.5 Play review delivery checklist

- Proper app category, content rating, privacy URL, terms URL, functioning account deletion, truthful Data Safety form.
- Reviewer account or deterministic public demo route plus at least 3 working seeded mini-apps.
- Explain why the host is itself a functional discovery destination, not just a WebView wrapper.
- Demonstrate end-user report/block, creator identity, moderation, and immediate app disable.
- Target current Android API level, validate SDK behavior, sign AAB via official process, test on low-spec device and multiple Android versions.
- No third-party APK installation or hidden download of executable native code.
- Confirm all downloaded JS is restricted and moderated; verify no arbitrary elevated bridge.

---

## 12. INFRASTRUCTURE, COST AND PERFORMANCE

### 12.1 Architectural operating assumptions

Rendering executes on each user's device; platform serves small immutable JS bundles and API responses. Host Android app is an ordinary Play-distributed application. No remote per-user emulators or GPU instances are required. Mini-app bundles cached after integrity checks. Aim for small starter apps (<2 MB compressed on first download when practical), fast cached launches, <=1 active runtime, and robust handling of renderer crashes. Avoid unsupported promises on exact RAM, APK size or latency; benchmark real devices.

### 12.2 Example infrastructure

Local: Docker Postgres + MinIO + API + Next.js + emulator. Cloud (later): inexpensive managed Postgres, container/API instance, R2/S3 object store, CDN, error monitoring, DNS and backups. Hosting cost alone may be tens of USD monthly for small alpha but cannot be promised without usage; moderation and abuse/security operations could be larger. AI backend costs belong to mini-app developer or strictly limited platform quota, not unlimited host subsidy.

### 12.3 Operational safeguards

Staging vs production separation, least privilege, bucket private origins, signed presigned upload boundaries, cost ceilings, rate limiting, backups and restore drills, data retention jobs, abuse reporting SLA, health checks, dashboards, error budget and kill switches. Use basic privacy-preserving analytics before buying a heavyweight stack.

---

## 13. QUALITY, SECURITY AND TEST PLAN

Unit: schema validation; manifest permission rejects; ownership and RBAC; release-state transitions; ranking eligibility; feedback moderation rules.
Integration: upload -> scan -> review -> publish; consumer catalog only shows approved; deep link maps to app ID; pause takes effect; reports reach queue; rate limit; delete personal data.
Android UI: onboarding, feed, search, app details, player, back behavior, feedback/report/save, dynamic links, no install requests, process recreation, offline/error handling, renderer crash fallback, low-memory behavior.
Security adversarial fixtures: archive traversal (`../`), zip bombs/huge files, XSS in metadata, remote script injection, navigation to unapproved domain, mixed content, popup attempts, storage bleed across apps, unauthorized bridge message, forged session, event spam, arbitrary `javascript:` navigation, token leakage, CSP bypass attempt, open redirects, server-side URL fetch/SSRF attempts, stale revoked version.
Performance: cold/warm mini-app launches, 2G/3G constrained-network tests, memory on 2GB/3GB RAM devices, repeated app switching, 100k small API events ingestion simulation. Declare initial SLO hypotheses and verify with measured data.

**Release gates:** all critical security tests pass, no known severity-high vulnerabilities, reports and takedowns demonstrably work, public apps review-approved, core journeys pass E2E and Play forms are truthful.

---

## 14. WORK BREAKDOWN AND CODEX EXECUTION ORDER

**Milestone M0 — Repo bootstrapping**
1. Inspect existing project; create monorepo only if empty.
2. Write README quickstart, architecture map, `.env.example`, docker-compose and CI lint/test/typecheck.
3. Create shared Zod schemas and OpenAPI; DB migrations/seed fixtures.
4. Ensure `pnpm install && pnpm dev` runs web/API and Android builds independently via Gradle.

**M1 — Consumer discovery web + API**
1. Seed authentic mini-app records and playable static web bundles.
2. Implement consumer catalog, details, search/categories, save and reporting API.
3. Build responsive web visual previews of consumer UI for design iteration (not as a substitute for Android host).
4. Implement React developer/admin dashboard skeleton with functioning auth/roles.

**M2 — Android host**
1. Compose navigation + Discover/Trending/Saved/Profile.
2. Fetch real catalog API; handle error/loading/offline states.
3. Safe WebView runner for explicitly seeded and approved app origins; no bridge initially; handle error/cancellation; enforce external navigation rules.
4. Deep-link route to app ID/slug; persistent host toolbar, feedback/report.
5. No APK installation flows.

**M3 — Developer upload and review**
1. Build CLI init/validate/deploy + local SDK.
2. Upload private immutable bundles with scanner and manifest validator.
3. Review/approve/reject in admin; publish release pointer; host only loads approved public builds.
4. Build deployment versioning, developer app detail, private previews.

**M4 — Instrumentation and polish**
1. Session and telemetry capture, rate limiting, aggregate developer analytics.
2. Feedback and report moderation, creator block and kill switch.
3. UI polish, E2E, security fixtures, docs, Play checklist.
4. Demo script and seed content polished to consumer-ready quality.

When interrupted, complete the current milestone, report working files and commands, outstanding blockers, tests run, and next bounded milestone. Do not silently replace actual functionality with non-functional UI.

---

## 15. COMPLETE ACCEPTANCE CRITERIA (DEFINITION OF DONE FOR MVP)

- [ ] Single Android host APK/AAB contains marketplace UI and loads only approved HTML/JS mini-app versions.
- [ ] A consumer can open Discover, browse at least 6 seeded usable mini-apps, open any, return, save and share without individual APK installs.
- [ ] An Android deep link to a mini-app opens correct approved experience when host installed; no-host landing routes to official host listing.
- [ ] Host shows creator identity, exit control, report, block and app-data controls; safe loading/error/disabled screens.
- [ ] Developer can create mini-app, validate CLI bundle, upload private version, submit review and see reasoned decision.
- [ ] Reviewer can approve/reject version, pause an app and audit actions. Rejected versions never appear in public catalog.
- [ ] Host rejects any arbitrary runtime URL, unapproved version and unsigned/invalid manifest.
- [ ] No arbitrary JavaScript-native bridge, no dynamic native executable/code downloads, no unapproved permissions.
- [ ] Developer analytics show actual (non-faked) sessions/starts and feedback, with data isolation.
- [ ] Basic security fixtures, unit/integration and Android UI smoke tests pass.
- [ ] Readme covers development, emulator setup, seed data, accounts, publishing, threats and deployment.
- [ ] API and DB migrations are reproducible without paid services.
- [ ] Documentation explicitly describes residual security and Play approval uncertainty.

---

## 16. SAMPLE MINI-APPS TO BUILD AS REAL EXPERIENCES

1. **Color Clash** (game): 30-second timed matching, score and replay. Needs no permissions.
2. **Tap Reflex** (game): reaction-time challenge, personal best in app-scoped storage (if storage not ready, in-session only).
3. **Meme Remix** (fun): select from bundled templates, choose text, render preview; no unrestricted user upload or sharing of unsafe generated content for v1.
4. **Focus Sprint** (productivity): customizable 5-minute focus countdown, animation, completion prompt; no background execution guarantees.
5. **Decision Spinner** (utility): local custom options spinner; inputs not sent to developer server.
6. **Habit Check-In** (productivity): simple in-session streak demo, optional app-scoped persistent state if security verified.
7. **Typing Sprint** (game/productivity): timed mobile keyboard test.
8. **Tiny Quiz** (educational): handful of locally bundled quizzes, end summary and replay.

These are production-like seed apps, not simply screenshots. Each has an attractive thumbnail, tight instructions, loading handling, core action, completion state, replay and exit support.

---

## 17. DESIGN ASSUMPTIONS THAT CODEX MUST NOT MISINTERPRET

1. **This is not just a beta-distribution SaaS.** The consumer super-app itself must be enjoyable, browsable and worth returning to. 
2. **No developer-installed native apps**—ever in the core architecture. The host runs reviewed web mini-apps and owns security/privacy.
3. **No assumption that every Android capability works.** Restricted runtime limitations are an accepted tradeoff for MVP discovery/testing.
4. **No Telegram dependency as core runtime.** Telegram can be a competitive benchmark, but build an independent consumer host.
5. **No fabricated adoption statistics** in UI or business claims. Use explicit `DEMO` badges only in fixtures and development screenshots.
6. **No auto-publication after upload.** Version review is mandatory for public discovery.
7. **Do not promise Google Play approval.** Build to a defensible security/policy posture and document risks.
8. **Users return for discovery**, not developer obligation. Consumer delight and feed quality are first-class deliverables.
9. **Analytics are for product validation**, with privacy limits, not covert surveillance.
10. **One approved runtime contract** from day one; reject incompatible mini-apps rather than trying to silently support arbitrary native frameworks.

---

## 18. FIRST CODEX PROMPT — EXECUTE NOW

> Read this entire `miniapp_superapp_codex_master_spec.md` as the binding product specification. Inspect the repository. If empty, initialize the monorepo described in Section 6. Prioritize a working vertical slice over mock screens. Implement M0 and as much of M1/M2 as possible in this run: seed three polished playable HTML5 mini-apps (Color Clash, Tap Reflex, Decision Spinner), Fastify + PostgreSQL catalog and version models, responsive consumer Discover/detail/preview, a Kotlin/Compose Android host with Discover/detail and strictly constrained WebView player for **approved seeded origins only**, plus README, environment examples and runnable tests. Never create an APK installation flow for mini-apps or an arbitrary privileged JS bridge. After completing code, run available checks and present: file tree, implemented journeys, build/run commands for Windows and Android Studio, tests/results, blockers, and next steps. Preserve all decisions and future items in `docs/DECISIONS.md` and `docs/ROADMAP.md`.

---

## 19. OPEN DECISIONS (DON'T BLOCK IMPLEMENTATION)

- Final product name/domain/trademark (working name only).
- Whether user accounts are optional permanently or only for guest-first onboarding.
- Which initial category leads acquisition (games likely easier to validate than generic utilities; measure rather than assume).
- Creator verification threshold and review staffing.
- Long-term per-app storage strategy and SDK permissions.
- Hosting provider; choose local development first and abstract storage.
- Feed personalization, ranking and fraud defenses.
- Monetization and payments; deliberately defer.
- Graduated app data export and migration contracts.
- Jurisdiction-specific legal review and Play policy review before production.

**End of master specification.**
