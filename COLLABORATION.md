# Cursor and ChatGPT collaboration

## Scope

Repository: Saket0626/ai-recruiter-platform.
Cursor owns active implementation in its local checkout and a dedicated cursor/* branch.
ChatGPT reviews pushed checkpoints against PROJECT_SPEC.md and proposes focused fixes on separate codex/* branches through pull requests.
Neither agent can see the other's unpushed changes. GitHub is the handoff, not a live Cursor control channel.

## Cursor checkpoint protocol

1. Inspect git status and remotes. Preserve all current local work. If this project already uses another repository, report its URL before changing any remote. Never reset, force-push, or replace the working directory to connect this repository.
2. Fetch this repository and inspect the coordination pull request. Incorporate its specification and rules only after reconciling any existing local specification or newer user requirements. Do not replace working app code with this documentation-only branch.
3. Use a dedicated cursor/* branch. At each coherent milestone, run available typecheck, lint, tests, and build. Fix or document failures honestly.
4. Commit and push relevant code plus a CHECKPOINT.md describing completed requirements, unfinished requirements, changed files, exact check commands/results, blockers, and next subsystem. Exclude secrets, resumes, tokens, private data, and local databases.
5. Open or update an implementation pull request. Before starting another subsystem, check GitHub for ChatGPT review comments and codex/* fix PRs.
6. Review proposed fixes, incorporate applicable commits safely, resolve conflicts deliberately, and rerun checks. Never blindly merge a stale patch.
7. Update the requirement checklist only with actual verification evidence. Do not weaken tests or replace mandatory behavior with mocks outside tests.

## ChatGPT review protocol

- Inspect the current commit, diff, applicable AGENTS.md, specification, checkpoint, and available CI evidence.
- Separate missing/not-yet-built features from regressions and false completion claims.
- Check resume and professor grounding, real versus mocked features, OAuth safety, actual attachments, default dry run, quality gates, review approval, duplicates, concurrent limits, and error paths.
- Provide actionable findings tied to exact files and current commits. Prioritize blockers and fix one bounded issue per patch where practical.
- Make patches in separate codex/* branches and PRs, never force-push or directly overwrite Cursor's active branch.
- Recheck remote state before proposing changes. Do not delete unrelated files or overwrite user changes.
- Add regression tests when practical. If no execution runtime is available, mark the patch UNVERIFIED and ask Cursor/CI to run named checks. Never claim a test passed from reading its source.
- Do not auto-merge, deploy, send email, enable autopilot, expand permissions, or expose credentials.
- Avoid duplicate comments and duplicate patch PRs. Record reviewed SHA and findings in the relevant GitHub PR for future review runs.
- Stay silent when there is no new code or meaningful finding.

## Limitations

Scheduled checks are hourly, not live surveillance. Cursor must push for review and must read feedback for it to affect its next actions. A pushed partial milestone is not proof Cursor skipped later steps. Review and tests reduce risk; they do not guarantee every defect is caught.
