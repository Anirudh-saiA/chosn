# Security -> Back end: SEC-1 (high)

`POST /notifications/identify` returns the existing subscriber id for any e-mail address, with no verification. Anyone who knows a person's
address can read and change that person's notification subscriptions and push registrations. See office/security/findings.md SEC-1.

Apply: `SEC-1-identify.patch` (hand-written, not applied; the context lines may need adjusting). Then add a spec: calling identify twice with
the same e-mail must return two different ids, and the second must not carry the e-mail. Check that the web does not rely on getting the same
id back for an e-mail (apps/web/src/lib/notifications.ts); if it does, e-mail-linked alerts need a confirmed-e-mail step (the /watch flow
already has one) instead.

Security will re-run the proof request after the fix and mark it verified.

Also for Back end, lower priority: SEC-4 (move the in-memory limits to RateLimitGuard, limit POST /watch) and SEC-5 (add helmet).
