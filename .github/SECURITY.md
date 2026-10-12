# Security policy

## Reporting vulnerabilities

Do not disclose vulnerability details, working exploits, credentials, private
logs, or affected users' information in public Issues or Discussions.

As checked on October 12, 2026, GitHub private vulnerability reporting is **not
enabled** for this repository, and the project has not published a dedicated
security contact. The [Security page](https://github.com/scarif-labs/horus/security)
is the place to check for an updated reporting route. If GitHub shows **Report a
vulnerability**, use that private form. Do not assume a public issue is private.

Until a private route exists, you may post only a minimal request for a private
security reporting channel, without details that identify or enable the
vulnerability. Wait for a maintainer to establish that route before sending
sensitive information. Do not send a Horus vulnerability to GitHub's own bug
bounty as though it were a vulnerability in GitHub.

Maintainers should enable
[private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
and verify the form before updating this policy. No response deadline,
supported-version guarantee, or vulnerability reward program is promised.

When a private route is available, include the affected Horus version or commit,
Android version and device model, affected component, reproduction steps,
impact, and a minimal sanitized proof of concept. Do not include secrets or
personal information; arrange any necessary sensitive evidence privately.

## Security boundaries

The [README security notes](../README.md#security-notes) describe the runtime's
limits. Android's application sandbox is the security boundary; PRoot does not
provide kernel isolation between agent users. Codex runs with its Linux sandbox
disabled under PRoot. Treat commands, repositories, and agent actions accordingly.
Optional remote access relies on paired SSH keys and the documented USB setup.

The project does not publish a formal security support window. State the version
you tested so maintainers can assess the report; do not infer security guarantees
from a release tag or an answered Discussion.
