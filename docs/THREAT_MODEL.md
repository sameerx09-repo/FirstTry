# Local runtime threat model

Assets: host account credentials, reviewer actions, immutable bundle identity, user feedback, app-scoped sessions and review state.

Untrusted actors: malicious mini-app developer, compromised content, forged clients, unrelated developer, abusive guest and hostile upload/archive. Local machine administrators and compromised Android/WebView engines are outside the enforceable application boundary.

Boundaries: dashboard to API, API to database/object store, Android network client to API, native host to WebView, and one mini-app origin to another.

Controls:

- Server ownership/RBAC, cookie session expiry, mutation header and allowed Origin checks.
- Immutable SQL trigger for bundle fields, unique app/version identity and composite release/version ownership.
- Manifest allowlist, compressed/expanded/file-count/path limits, prohibited native payloads, static code heuristics and manual review.
- Signed version-bound grants and per-file hashes; no client-selected runtime URL; denied inactive app/developer/version; renewal checks.
- Host-owned exit/report controls outside the WebView; no sensitive device permissions or generic native invocation.
- Per-app synthetic HTTPS origins, verified in-memory assets, no file/content loader, restrictive CSP, denied unknown network resources and disabled browser storage/service workers and all WebView cookies.
- Origin/main-frame/nonce/method/capability checks on messages; bounded event schemas and per-session event limits.
- HTML metadata is rendered through React/Compose text; browser preview is restricted to bundled seeds with sandboxing.

Residual risks:

- WebView/JS engine bugs and containment blind spots require engine maintenance and independent security testing.
- Static source checks cannot prove code benign or eliminate obfuscation. Native archive link metadata and all parser edge cases need deeper review.
- Local debug API/key bootstrap uses an ADB loopback tunnel, not production TLS/pinning. Release execution is blocked without configuration.
- Cookie isolation is not a claim of separate OS processes. DOM storage is deliberately disabled; app-origin fingerprints and covert signals are not eliminated.
- No remote takedown can work without connectivity. This host closes on failed renewal checks rather than offering indefinite offline play.
- App-reported completions can be forged. Analytics are product signals, not billing or proof of unique human behavior.
- Text redaction is heuristic; entered feedback must be handled as potentially personal data.
- Exact small-cohort analytics and seeded credentials are local-only; production is disabled.

Security tests and their actual results are recorded separately; no claim of a complete independent audit is made.
