# Chrome Profile

All CDP skills share a single profile directory. Do NOT create per-skill profiles.

Override: `WPDTC_CHROME_PROFILE_DIR` env var (takes priority over all defaults).

| Platform | Default Path |
|----------|-------------|
| macOS | `~/Library/Application Support/wpdtc-skills/chrome-profile` |
| Linux | `$XDG_DATA_HOME/wpdtc-skills/chrome-profile` (fallback `~/.local/share/`) |
| Windows | `%APPDATA%/wpdtc-skills/chrome-profile` |
| WSL | Windows home `/.local/share/wpdtc-skills/chrome-profile` |

New skills: use `WPDTC_CHROME_PROFILE_DIR` only (not per-skill env vars like `X_BROWSER_PROFILE_DIR`).

## Implementation Pattern

```typescript
function getDefaultProfileDir(): string {
  const override = process.env.WPDTC_CHROME_PROFILE_DIR?.trim();
  if (override) return path.resolve(override);
  const base = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(base, 'wpdtc-skills', 'chrome-profile');
}
```
