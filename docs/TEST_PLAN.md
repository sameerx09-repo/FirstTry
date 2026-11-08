# Test strategy

- Unit/contracts: manifest/capability restrictions, legal review transitions, archive integrity/bounds and signatures.
- Database/API integration: fresh real PostgreSQL engine, reviewed catalog eligibility, ownership, signed session lifecycle, deduplication, rollback and takedown.
- Browser journeys: real Edge/Chromium pages, six working seeds, mobile layout, save/feedback/report, developer upload and moderator approval/publication.
- Android JVM: URL/origin/path policy and known hash vectors.
- Android instrumentation: native navigation and profile, verified synthetic-origin Color Clash player, Tiny Quiz SDK completion reaching actual backend analytics.
- Manual/device gates: physical low-memory phone, multiple Android/WebView versions, TalkBack/large fonts, network constraints, memory/renderer failures and verified App Links.
- Operations/security release gates: external PostgreSQL/MinIO, isolated scanning, key rotation, backup/restore, event ingestion scale and independent review.

Store run commands, versions, durations, pass/fail/blocked state and screenshots in TEST_RESULTS.md. A passing browser test is not proof of Android sandbox behavior. A passing local security fixture is not an independent audit or Play approval.
