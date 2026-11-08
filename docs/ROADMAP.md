# Remaining delivery gates

## Local completion evidence

Use TEST_RESULTS.md for executed checks and IMPLEMENTATION_PLAN.md for detailed tasks. Do not infer all 224 items are complete because an interface exists.

## Controlled alpha

- [ ] Connect a physical Android phone and test touch/keyboard, backgrounding, renderer failure and low-memory behavior.
- [ ] Exercise several Android/WebView versions, including unsupported-feature denial and a lower-memory device.
- [ ] Complete onboarding interest persistence, dark theme and accessible pull-down recent launcher.
- [ ] Add invited tester management and moderator review checklists/screenshots per version.
- [ ] Add listing/settings edits with review-bound metadata snapshots and explicit re-review behavior.
- [ ] Expand complete OpenAPI request/response schemas, pagination and operation-specific rate limits.
- [ ] Add production-quality email/creator verification, consent records and appeals workflow.
- [ ] Implement privacy cohort thresholds, retention jobs and full data export.
- [ ] Verify external PostgreSQL, MinIO and backup/restore in the target operational environment.

## Public release prerequisites

- [ ] Independent Android/WebView and backend security review; resolve blocking findings.
- [ ] Replace debug key bootstrap with securely provisioned pinned keys and rotation/revocation strategy.
- [ ] Production TLS and origin infrastructure, private object storage policies and streaming isolated validation jobs.
- [ ] Robust idempotency and concurrent moderation/publish/revocation/load tests on external PostgreSQL.
- [ ] Operational monitoring, backups/restore drills, spend limits and incident/report staffing.
- [ ] Owned domain, verified Android App Links, authentic host store listing and release signing.
- [ ] Current Play target API/policies, legal/privacy/content-rating review, Data Safety and account deletion verification.
- [ ] Remove the explicit production startup block only once these prerequisites are reviewed and implemented.

## Later product work

- [ ] Cohort rollout and experiment comparison beyond full approved release/rollback.
- [ ] Quality-adjusted trending from adequate real samples; personalization and fraud controls.
- [ ] Graduated app verification/export guidance, creator following and broader localization.
- [ ] Independently reviewed persistent storage/native capabilities before expanding the runtime contract.
- [ ] Monetization only after product retention and policy validation.
