# @clawtrl/mcp

Model Context Protocol (MCP) server that exposes a [Clawtrl Ops](https://github.com/portalfnd/clawtrlautonomous) fleet as tools to any MCP client (Claude Desktop, Cursor, Continue, Zed, …).

**Zero infrastructure.** It runs locally on stdio and talks to your fork via the GitHub API. No webhook, no deploy, no extra service.

## Tools

| Tool | What it does |
|---|---|
| `claw_list` | List every Claw skill registered in `claw.yml` |
| `claw_status` | Last N workflow runs and their conclusion |
| `claw_run` | Dispatch a Claw on GitHub Actions |
| `claw_recruit` | Auto-Spec a new Claw from a one-line brief and commit it |
| `claw_feed` | List the latest article files written by Claws |
| `claw_read_article` | Fetch the body of a specific article |
| `claw_wallet` | Read the agent wallet snapshot |

## Install & run

```bash
npx -y @clawtrl/mcp
```

Or pin in your MCP client config (recommended).

## Configure

The server reads three env vars:

| Var | Required | Description |
|---|---|---|
| `CLAWTRL_REPO` | yes | `owner/repo` of your Clawtrl fork |
| `CLAWTRL_TOKEN` | yes | GitHub PAT with `repo` + `workflow` scopes |
| `CLAWTRL_BRANCH` | no | Default `main` |
| `ANTHROPIC_API_KEY` | no | Enables `claw_recruit` (Auto-Spec) |

Create the PAT at <https://github.com/settings/tokens?type=beta> and grant it access to your fork only.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "clawtrl": {
      "command": "npx",
      "args": ["-y", "@clawtrl/mcp"],
      "env": {
        "CLAWTRL_REPO": "you/clawtrlautonomous",
        "CLAWTRL_TOKEN": "ghp_xxx",
        "ANTHROPIC_API_KEY": "sk-ant-xxx"
      }
    }
  }
}
```

Restart Claude Desktop. You should see the `clawtrl` server in the tools menu.

## Cursor / Continue / Zed

The pattern is the same: register `npx -y @clawtrl/mcp` as a stdio MCP command, pass the env vars, and you're done. See your client's MCP docs for the exact config file shape.

## Security model

- Your PAT never leaves your machine. The MCP server runs locally on stdio.
- Every action is a GitHub commit or workflow dispatch — fully auditable in your repo's history.
- The agent wallet's private key is **not** read by this package. Wallet info comes from `wallet/snapshot.json` which only contains the address and balances.
- `claw_recruit` registers new Claws as **disabled** so synthesis errors can't accidentally spend wallet funds. You enable them from the dashboard or by editing `claw.yml`.

## License

MIT
