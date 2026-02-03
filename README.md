# Lumina Planner
> Personal Focus Hub powered by AI.

## Project Overview
Lumina Planner is a desktop application built with Electron, React, and Gemini AI to help users organize their day, track tasks, and maintain focus.

## 🛡️ CI/CD Paradigm (Rigorous)
This project enforces a strict testing and validation pipeline to ensure high code quality.

### Local Gatekeeper (Husky)
A `pre-push` hook is configured using **Husky**. 
Every time you run `git push`, the following checks are automatically executed:
1.  **Type Check**: `tsc --noEmit` (Ensures no TypeScript errors)
2.  **Linting**: `eslint` (Ensures code style consistency)
3.  **Unit Tests**: `vitest run` (Verifies logic correctness)

**If any check fails, the push is blocked.** You must fix the errors before pushing.

### Remote CI (GitHub Actions)
The `.github/workflows/ci.yml` pipeline runs on every push and pull request to `main`. It performs the same checks in a clean environment to prevent "it works on my machine" issues.

### How to Configure GitHub Repo
To fully enforce this paradigm:
1.  Go to Repository **Settings** -> **Branches**.
2.  Add a Branch Protection Rule for `main`.
3.  Enable **"Require status checks to pass before merging"**.
4.  Select `test`, `lint`, and `typecheck` as required checks.

## Development Scripts
- `npm run dev:electron`: Start the app in development mode.
- `npm run test`: Run unit tests.
- `npm run validate`: Run all checks manually (Lint + Type + Test).
- `npm run build`: Build the application for production.

## Technology Stack
- **Core**: Electron, React, TypeScript
- **Styling**: TailwindCSS
- **AI**: Google Gemini API
- **Testing**: Vitest, React Testing Library
- **CI**: GitHub Actions, Husky
