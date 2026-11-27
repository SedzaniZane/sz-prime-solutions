# Security review — 27 November 2026

**Launch decision: keep real payments disabled.** Engineering checks passed as described below. Staff MFA enrollment, recovery readiness and platform account checks remain launch requirements. This is a targeted source/configuration review with controlled tests, not an independent penetration-test certificate.

## Scope and evidence

Reviewed the current repository, project-memory and roadmap documents, relevant previous project conversations, production HTTP responses, database RLS/policies/function grants, Supabase authentication/network/backup settings, GitHub security settings and the Yoco payment implementation. Used GitHub, Vercel and Supabase connectors, local tests/npm audit, and official provider documentation. Prior chat claims were checked against current code/configuration where access allowed. Private keys were not printed or added to the repository.

Vercel Security Review findings endpoint returned 404; it is not evidence of a clean scan. Plugin discovery did not supply a connected independent penetration scanner. GitHub CodeQL and secret-scanning alert queries returned no open alerts at review time; scans were newly enabled and coverage is not comprehensive.

## Findings and fixes

| Finding | Severity | Action |
|---|---|---|
| Staff credentials could directly insert/update/delete payment rows and alter financial evidence | High | Removed direct ledger write privileges and permissive write policy. Staff read the ledger; checked EFT/reservation RPCs and server settlement perform writes. |
| Signed webhook did not compare provider amount/currency with the stored checkout | High | Added checked settlement RPC with exact cents, ZAR currency, mode and payment identity verification; old settlement entry point revoked. Duplicate delivery remains a no-op. |
| Browser clients could attach arbitrary HTTPS checkout destinations | High | Attachment is server-role only; provider response amount, currency and mode are validated and destinations must be HTTPS on c.yoco.com. |
| Staff could delete or rewrite request event history | Medium | Removed update/delete privileges; staff may append events attributed to their authenticated identity. Administrative database access remains privileged. |
| Public registration enabled in a staff-only application; recovery URL set to localhost; minimum password length six | Medium | Disabled public signup, configured production URL with narrow redirect allowlist, required 12 characters for new/changed passwords. Existing passwords are not automatically changed. |
| Staff authentication lacked an enrollment/challenge flow | High before real payments | Added /ops/security enrollment and /login/mfa challenge. Once a factor is verified, middleware and RLS require AAL2. Owner must enroll; no factor was enrolled during review. |
| Database connections did not require SSL | Medium | Enabled SSL enforcement and confirmed appliedSuccessfully with database=true. |
| Missing browser defence headers and trusted origin construction | Medium | Nonce-based CSP, frame denial, nosniff, referrer/permissions policy, private no-store operational pages, server-controlled payment return origin. Dynamic rendering supports per-response nonces. |
| Oversized or malformed webhook data was unbounded | Medium | Bounded body stream to 64 KiB and validate successful payment structure before database access. |
| PostCSS dependency advisories | High dependency finding; app-specific exploitability not demonstrated | Overrode PostCSS to 8.5.34; pinned Next.js to the patched 15.5.29 line; added a lockfile and CI audit/tests/build. |
| Repository secret and code scanning were disabled | Medium | Enabled GitHub secret scanning, push protection and extended CodeQL default setup; added Dependabot update configuration. Dependabot alerts toggle could not be enabled through the permitted connector. |

No live key was activated. Both creation and reuse of live checkouts require BILLING_LIVE_ENABLED=true in addition to live credentials. Keep that flag absent until launch checks are completed.

## Validation

- 27 Node regression tests: signature tampering/expiry, malformed/oversized webhooks, settlement payload, redirect allowlist, active-staff and MFA gate, checkout reservation and PDF/payment totals.
- Production build and TypeScript check pass.
- npm audit --omit=dev: zero known vulnerabilities after the dependency override. This is a registry check of the locked dependency set, not proof that the application is vulnerability-free.
- Transactional SQL tests passed: mismatched amount/currency/mode rejected; authentic duplicate is a no-op; anonymous users cannot read any of the 13 business tables; authenticated non-staff cannot read customers/invoices; clients cannot directly write the ledger, settle Yoco or delete audit events. Test writes were rolled back.
- Before changes, production /ops and an invoice PDF redirected anonymous requests to login. Follow-up HTTP checks verify the deployed protections after release.
- Supabase email confirmation enabled, OTP expiry one hour, anonymous auth disabled, refresh-token rotation enabled; no sensitive business tables in Realtime publication.

## Remaining launch requirements

1. **Enroll the owner authenticator** at /ops/security and test sign-out/sign-in plus recovery procedure. No MFA was enrolled by this review. Check MFA separately on business email, GitHub, Vercel, Supabase account and Yoco; their account MFA state was not established here. Prefer passkeys/security keys for provider accounts where supported.
2. **Backups and recovery:** backup listing returned an empty list and PITR disabled. Schedule endpoint returned HTTP 402. Establish an affordable encrypted backup plan and restore a copy into a separate environment before customer data/real payments. Do not restore over production for testing. No paid service was enabled.
3. **Database network restrictions:** direct database access permits all IPv4/IPv6 CIDRs. Select approved administrator/integration networks before restricting; do not guess ranges. The application uses HTTPS Data API, but other tools may use direct DB access.
4. **Independent authenticated review:** test a real low-privilege/inactive account, password recovery and MFA recovery in a separate test setup. This review did not guess passwords, load-test production, or conduct destructive exploitation.
5. **Operational monitoring:** decide who receives login/payment failure alerts, review logs, and test incident/credential-revocation procedures. Vercel reports the default firewall with no custom rules and no attack anomalies in the queried window. This is not proof that no attacks occurred. Default Vercel protections are not a substitute for application-specific rate limits and monitoring.
6. **GitHub:** manually enable Dependabot alerts in repository Settings > Advanced Security. The connector blocked the raw API request; do not interpret this as a scan pass. Review CodeQL results after the scan completes. Branch protection and account recovery remain to verify.
7. **Payment release:** await Yoco domain approval, configure coordinated live key/webhook secrets, repeat the mixed EFT/Yoco sandbox flow after this change, then deliberately enable live checkout and perform one controlled low-value payment. Live abandoned checkout/refund reconciliation still needs design before broader use.
8. **Customer-data governance:** complete privacy/retention terms and least-privilege staff roles before inviting more staff or opening customer/partner portals. All active staff currently share broad operational record access.

## Social-engineering operating rules

- Open bookmarked provider dashboards; do not enter passwords or MFA codes through unsolicited support links.
- Never share authenticator QR/setup keys, passwords, API keys or session cookies in chat/screenshots.
- Record EFT only after checking cleared funds in the bank account, not a screenshot of proof of payment.
- Verify bank-detail changes through a previously known phone number; record the change and confirmation.
- Revoke access promptly when staff leave. Keep a protected recovery method and incident contact list.

## Sources

- https://supabase.com/docs/guides/security/production-checklist
- https://supabase.com/docs/guides/auth/auth-mfa/totp
- https://nextjs.org/blog/november-2026-security-release
- https://github.com/advisories/GHSA-r28c-9q8g-f849

## Operational notes

Migration: 20261127133925_payment_security.sql. Publish application changes immediately after applying the migration: older webhook and checkout attachment code will be denied by the tightened grants. The migration does not delete business records. A schema rollback must never reopen direct ledger writes; revert application code and database grants only as a coordinated reviewed operation.
