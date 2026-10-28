# Security review and release blockers

The foundation is not production-ready. The process-local throttle is bounded and expired entries are removed, but it trusts an unverified X-Forwarded-For value, can be bypassed by spoofing, is not shared across instances, and can cause denial of service. A trusted ingress must strip untrusted forwarding headers and provide a verified client identity; a shared atomic limiter needs a deployment-specific trusted identity design. A global IP bucket can lock out users behind shared addresses. Do not deploy until a reviewed shared limiter and trusted proxy policy are in place.

Sessions expire after eight hours; logout clears the browser cookie but does not revoke copied tokens. Rotating SESSION_SECRET invalidates every session. Add server-side per-session revocation before production. Origin checks compare scheme and Host; deploy only behind a trusted proxy that validates Host and forwards the correct scheme. CEO approval functions are contracts only, not an enforcement engine.

## Dependency audit (initial)

| Advisory | Dependency and path | Patched version | Impact and action |
| --- | --- | --- | --- |
| GHSA-gpj5-g38j-94v9 | drizzle-orm direct | 0.45.2 | SQL identifier injection; upgraded to 0.45.4. |
| GHSA-6g55-p6wh-862q | next > postcss | 8.5.12 | Untrusted CSS source maps could read files; override to 8.5.32. |
| GHSA-r28c-9q8g-f849 | next > postcss | 8.5.18 | Source map path traversal; override to 8.5.32. |
| GHSA-5gmw-xhrv-c9v3 | vitest > tinypool | 2.1.1 | Test worker prototype pollution can lead to code execution; upgraded Vitest. |
| GHSA-85c8-ppgw-ccpr | vitest > tinypool | 2.1.2 | Test worker prototype pollution can lead to code execution; upgraded Vitest. |

Audit results must be rechecked against the committed lockfile. Dependency advisories are release blockers if still reported; do not process untrusted CSS or run untrusted test code as a mitigation. No AI execution or provider integration is present.
