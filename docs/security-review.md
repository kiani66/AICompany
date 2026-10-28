# Security review and release blockers

The foundation is not production-ready. The account-wide rate limit permits deliberate temporary login denial, and a trusted ingress and security review remain prerequisites. CEO approval functions are future contracts, not an enforcement engine.

## Dependency audit (initial)

| Advisory | Dependency and path | Patched version | Impact and action |
| --- | --- | --- | --- |
| GHSA-gpj5-g38j-94v9 | drizzle-orm direct | 0.45.2 | SQL identifier injection; upgraded to 0.45.4. |
| GHSA-6g55-p6wh-862q | next > postcss | 8.5.12 | Untrusted CSS source maps could read files; override to 8.5.32. |
| GHSA-r28c-9q8g-f849 | next > postcss | 8.5.18 | Source map path traversal; override to 8.5.32. |
| GHSA-5gmw-xhrv-c9v3 | vitest > tinypool | 2.1.1 | Test worker prototype pollution can lead to code execution; upgraded Vitest. |
| GHSA-85c8-ppgw-ccpr | vitest > tinypool | 2.1.2 | Test worker prototype pollution can lead to code execution; upgraded Vitest. |

Audit results must be rechecked against the committed lockfile. Dependency advisories are release blockers if still reported; do not process untrusted CSS or run untrusted test code as a mitigation. No AI execution or provider integration is present.

## Account throttling and session changes

Login now uses a single atomic PostgreSQL fixed-window counter: ten attempts per 15 minutes across all instances. No request header or IP is trusted for identity. For the single CEO account, every caller shares this bucket, so spoofed forwarding headers cannot bypass it; a malicious caller can nevertheless deny CEO login for the window. This availability risk requires an ingress-level defense and recovery plan before production. Expired counters are reset atomically; there is only one counter row. Database errors fail closed.

Sessions have random identifiers signed in an eight-hour token and checked against PostgreSQL on every private request. Logout deletes the session record, invalidating copied cookies; expired records are removed during later logins. Secret rotation still invalidates all sessions. In-flight requests already authorized before logout may complete. A compromised signing secret or database remains a serious risk. Use HTTPS and a trusted reverse proxy that validates Host and scheme; never expose an origin that accepts attacker-controlled Host/protocol forwarding. The application does not consume X-Forwarded-For for authentication.

## Remaining moderate audit findings

`npm audit` reports four moderate entries, all from the same development-only advisory GHSA-67mh-4wv8-2f99: `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild` (esbuild <=0.24.2). Its development server permits cross-origin requests to read responses. The three parent packages are affected transitively; npm reports no compatible automatic fix for the pinned Drizzle Kit chain. This application does not use that dependency's development server. Do not expose it or run untrusted code during development; upgrade Drizzle Kit when a compatible patched dependency chain is available, then rerun migration and CI checks. These are development dependencies, not runtime inference or provider services.
