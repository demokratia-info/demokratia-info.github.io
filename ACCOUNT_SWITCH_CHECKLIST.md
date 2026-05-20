# Account Switch Checklist

Use this when moving the project from the old OpenAI/Codex account to the new OpenAI Pro x20 account.

## Main Rule

Do not let both OpenAI accounts run the automations at the same time.

The project needs exactly two recurring automations:

- Daily democracy paper additions at 04:00 Asia/Jerusalem.
- Daily democracy push watchdog at 09:00 Asia/Jerusalem.

## Best Sequence

1. Log into the new OpenAI Pro x20 account.
2. Open `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`.
3. Run:

```sh
./scripts/handover_preflight.sh
```

4. Recreate or confirm the two automations from:

- `AUTOMATION_PROMPT.md`
- `WATCHDOG_AUTOMATION_PROMPT.md`

5. Once the new account is confirmed working, pause or delete the old account's automations.

## If You Cannot Easily Return To The Old Account

Pause the old automations before logging out, then recreate them immediately in the new account.

## Do Not Change These Yet

Do not log out of GitHub CLI, revoke GitHub tokens, or change Cloudflare while switching OpenAI accounts.

The new OpenAI account can use the same local `gh` authentication on this Mac.

## Local Worktree Note

The local worktree may show setup changes in:

- `.gitignore`
- `Gemfile`
- `_config.yml`
- `.ruby-version`
- `Gemfile.lock`
- `workers/wrangler.toml`
- `wrangler.jsonc`

These local setup files are not blocking normal work. Do not stage or commit them unless you intentionally decide they should become part of the project.

