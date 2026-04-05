# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.2.x   | Yes                |
| < 0.2   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in prompt-lock, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Use [GitHub Security Advisories](https://github.com/shmulikdav/Promptlock/security/advisories/new) to report privately
3. Include a description of the vulnerability, steps to reproduce, and potential impact

We will acknowledge your report within 48 hours and aim to release a fix within 7 days for critical issues.

## Scope

Security issues we care about:

- Path traversal in snapshot or cache file operations
- Server-side request forgery (SSRF) via custom provider URLs
- Code injection through prompt templates or assertion configs
- Sensitive data exposure in snapshots, caches, or reports

Issues **out of scope**:

- Vulnerabilities in upstream dependencies (report to the dependency maintainer)
- LLM output content (prompt-lock tests behavior, not content safety)
