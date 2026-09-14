# ResearchReach

Private project for Saket's evidence-grounded undergraduate research outreach assistant.

## Current status

This repository contains the implementation specification, agent rules, prompt templates, and environment template. The application is NOT implemented yet. There is no running dashboard, database, Microsoft login, or email sender. No real emails have been sent.

## Shared project

Repository: https://github.com/Saket0626/ai-recruiter-platform

ChatGPT and Cursor can work on this same repository. This does not synchronize chat histories or automatically update a local Cursor checkout. Commit and push changes to share them; pull remote changes before starting work in another environment. Do not overwrite uncommitted changes.

## Start implementation in Cursor

Open a clone of this repository in Cursor, then send:

> Read AGENTS.md, PROJECT_SPEC.md, and IMPLEMENTATION_PLAN.md completely. Implement ResearchReach in this repository. Start by inspecting the existing files and dependencies. Preserve working code and user changes. Keep DRY_RUN=true and AUTO_SEND=false. Run type checking, lint, tests, and the production build where available. Report what you actually verified and any blocked steps. Never send real emails during development.

## Source of truth

- PROJECT_SPEC.md: requirements and acceptance criteria.
- AGENTS.md and .cursor/rules/: persistent engineering constraints.
- IMPLEMENTATION_PLAN.md: staged work and verification.
- prompts/: grounded research analysis and email writing instructions.
- .env.example: configuration names only, no real secrets.
- data/README.md: resume handling.

## Resume and credentials

The uploaded resume has NOT been copied into this repository. Put the real PDF at data/resume.pdf locally or configure RESUME_PATH after cloning. Resume files, extracted profile data, tokens, local databases, and .env files are ignored by Git. Do not commit them.

Before real sending, the implementation must support Microsoft OAuth, a verified resume, draft review, and explicit activation of real sending. A Microsoft account sign-in and any required tenant consent must be completed by the account holder.

## Setup commands

No package.json exists yet. Dependency installation and start commands must be documented by the implementing agent after it chooses and verifies compatible current stable dependencies. Do not assume this repository already runs.
