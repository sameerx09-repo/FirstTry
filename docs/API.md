# API usage

Base: http://127.0.0.1:3001/api/v1. Endpoint inventory and shared JSON schemas: GET /openapi.json.

Every mutation requires x-firsttry-request: 1. Dashboard authentication uses HttpOnly ft_session cookies. Guest routes use a random HttpOnly ft_guest cookie. Browser origins are checked when supplied. Android runtime requests use Authorization: Bearer <payload>.<signature>, with no platform login token in mini-app content.

Consumer: catalog, catalog/:slug, saved, history, blocks, my-reports; mutations for saves, reports, feedback, creator blocks and data deletion.

Runtime: POST /sessions accepts appId and optional authenticated private preview/versionId. It returns a signed grant, asset inventory, bundle hash and bundle path. GET /sessions/:id/bundle checks the live grant. POST /sessions/:id/renew returns a newly signed grant; /end closes it. POST /events/batch accepts bounded allowlisted event IDs/names/properties and deduplicates IDs.

Developer: /developer/apps, /:id/versions, /:id/upload, /:id/versions/:vid/submit-review, /:id/release, /:id/pause, /:id/analytics and /:id/feedback. All enforce role and ownership. Upload body is {zipBase64}; release body is {versionId}.

Moderator: /admin/reviews, /admin/reviews/:id/decision, /admin/apps, /admin/apps/:id/suspend, /admin/versions/:id/disable, /admin/developers/:id/suspend, /admin/reports, /admin/reports/:id/resolve and /admin/audit. Decisions and suspension require reasons.

Errors use {error,details?}. Typical status codes: 400 invalid request/bundle, 401 missing/expired authentication, 403 denied role/release/capability, 404 hidden/missing resource, 409 duplicate version or illegal state, 429 abuse limits. Database details and stack traces are not public API responses.

OpenAPI currently includes the full route inventory and common schemas. Full endpoint-specific response/request composition remains on the alpha roadmap.
