# Contributing to Clawtrl Autonomous

Thank you for your interest in contributing! This guide covers the basics.

## Getting Started

1. **Fork & clone** the repository
2. **Install dependencies**:
   ```bash
   cd dashboard && npm install
   ```
3. **Set up environment**: Copy `dashboard/.env.example` to `dashboard/.env.local` and fill in your GitHub token and repo
4. **Start the dashboard**: `npm run dev`

## Adding a Skill

1. Create `skills/<skill-name>/SKILL.md` following the [Agent Skills Spec](https://skills.sh)
2. Register the skill in `claw.yml`:
   ```yaml
   my-skill:
     enabled: false
     schedule: "0 8 * * *"
     var: "optional default brief"
   ```
3. Test by running `npm run dev` and triggering from the dashboard

## Code Style

- **TypeScript**: Strict mode, no `any` types in new code
- **React**: Functional components with hooks, no class components (except ErrorBoundary)
- **CSS**: Tailwind utility classes, no custom CSS files
- **Imports**: Always at the top of the file, grouped by external → internal

## Pull Requests

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes, keeping commits focused
3. Ensure `npm run build` passes in `dashboard/`
4. Open a PR with a clear description of what and why

## Security

- **Never commit** private keys, API tokens, or `.env` files
- **Never hardcode** secrets in source files — use environment variables
- Report security issues via GitHub Security Advisories (see `SECURITY.md`)

## Project Structure

```
clawtrlautonomous/
├── claw.yml              # Fleet configuration
├── skills/               # Skill definitions (SKILL.md files)
├── dashboard/            # Next.js dashboard (React + Tailwind)
├── packages/mcp/         # MCP server for Claude Desktop / Cursor
├── workers/              # Cloudflare Workers (webhook proxy)
├── scripts/              # Utility scripts (x402 payments, etc.)
├── memory/               # Fleet memory (MEMORY.md)
└── telemetry/            # Runtime snapshots (gitignored)
```
