# First-Time Setup — wpdtc-post-to-wordpress

Welcome! This guide helps you configure WordPress publishing in 3-5 minutes.

## What You Need

1. A WordPress site (self-hosted, WordPress 5.6+)
2. A user account with at least `Editor` role (can create/edit posts)
3. Pretty permalinks enabled (Settings → Permalinks → "Post name")

## Step 1: Create an Application Password

1. Log in to your WordPress admin at `https://your-site.com/wp-admin`
2. Navigate to **Users → Profile**
3. Scroll down to **Application Passwords**
4. Enter a name like `WPDTC Agent`
5. Click **Add New Application Password**
6. Copy the generated 24-character password (shown only once!)

The password looks like: `abcd EFGH 1234 ijkl MNOP 5678`

> ⚠️ **Security**: Never share this password or commit it to git. We'll store it in environment variables.

## Step 2: Set Environment Variables

**macOS / Linux** (add to `~/.zshrc` or `~/.bashrc`):

```bash
export WP_URL="https://your-site.com"
export WP_USERNAME="your-username"
export WP_APPLICATION_PASSWORD="abcd EFGH 1234 ijkl MNOP 5678"
```

**Windows** (PowerShell):

```powershell
$env:WP_URL="https://your-site.com"
$env:WP_USERNAME="your-username"
$env:WP_APPLICATION_PASSWORD="abcd EFGH 1234 ijkl MNOP 5678"
```

Or set globally via System Properties → Environment Variables.

## Step 3: Test the Connection

```bash
python3 scripts/wp_publish.py --test
```

You should see:
```
✓ Connected to: https://your-site.com
  User: Your Name
✓ Connection test successful
```

If you get an error, see `references/troubleshooting.md`.

## Step 4: Create EXTEND.md

Choose one of these paths:

| Path | Scope |
|------|-------|
| `.wpdtc-skills/wpdtc-post-to-wordpress/EXTEND.md` | This project only |
| `~/.wpdtc-skills/wpdtc-post-to-wordpress/EXTEND.md` | All your projects |

Minimal EXTEND.md:

```md
# WordPress Publishing Preferences
default_site_url: https://your-site.com
default_status: draft
default_category: Blog
auto_publish: 0
```

Full version with multi-site:

```md
# WordPress Publishing Preferences
default_site_url: https://your-site.com
default_status: draft
default_category: Blog
auto_publish: 0
convert_html_to_blocks: 1

sites:
  - alias: production
    url: https://your-site.com
    username: editor
    default: true
  - alias: staging
    url: https://staging.your-site.com
    username: admin
```

## Step 5: Create Your First Post

```bash
# Convert markdown to Gutenberg blocks
python3 scripts/block_generator.py article.md --output article-blocks.html

# Publish as draft
python3 scripts/wp_publish.py \
  --title "My First Post" \
  --content-file article-blocks.html \
  --category "Blog" \
  --status draft
```

That's it! You're ready to publish from your agent.
