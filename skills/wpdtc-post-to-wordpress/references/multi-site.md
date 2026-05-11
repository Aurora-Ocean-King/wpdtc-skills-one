# Multi-Site Support — wpdtc-post-to-wordpress

Manage multiple WordPress sites with separate credentials per site.

## Configuration

Add a `sites:` block to your EXTEND.md:

```yaml
sites:
  - alias: main
    url: https://main-blog.com
    username: editor
    default: true
    application_password: "${WP_MAIN_PASSWORD}"
    default_category: Blog

  - alias: magazine
    url: https://magazine.example.com
    username: author
    application_password: "${WP_MAGAZINE_PASSWORD}"
    default_category: Articles
    default_status: pending

  - alias: dev
    url: https://dev.local
    username: admin
    application_password: "${WP_DEV_PASSWORD}"
    default_status: draft
```

## Credential Resolution

For each site, credentials are resolved in this order:

1. **Environment variable reference**: `${VAR_NAME}` in `application_password` — resolved from actual environment variable (recommended)
2. **Global env vars**: If `application_password` is omitted, falls back to `WP_APPLICATION_PASSWORD` env var
3. **Site-specific env vars**: `WP_<ALIAS>_PASSWORD` (e.g., `WP_MAIN_PASSWORD`)

## Site Selection

When multiple sites are configured:
- If `--site <alias>` is provided via CLI, use that site
- If one site has `default: true`, auto-select it
- Otherwise, prompt the user to choose from the list

## Per-Site Settings

Each site entry supports:

| Key | Required | Description |
|-----|----------|-------------|
| `alias` | Yes | Short name for CLI reference |
| `url` | Yes | WordPress site base URL |
| `username` | Yes | WordPress username |
| `application_password` | No | Application password or env var reference |
| `default` | No | Auto-select this site (only one should be `true`) |
| `default_category` | No | Default category for this site |
| `default_status` | No | Default post status (overrides global) |

## CLI Usage

```bash
# Publish to a specific site
python3 scripts/wp_publish.py --site magazine --title "New Article" --content-file article.html

# Run the agent with site selection
# The workflow will auto-detect multiple sites and prompt for selection
```

## Chrome / Browser Profiles

Unlike WeChat, WordPress publishing uses REST API (no browser needed), so no per-site browser profile management is required.
