---
name: wpdtc-post-to-wordpress
description: Posts content to WordPress sites via REST API with full Gutenberg block support. Converts Markdown to Gutenberg blocks, uploads media, manages categories/tags, and supports draft/publish workflows. Use when user mentions "发布到WordPress", "post to WordPress", "发布文章", "写博客", "publish to blog", "WordPress发布", or provides content with WordPress publishing intent.
version: 1.0.1
metadata:
  openclaw:
    homepage: https://github.com/Aurora-Ocean-King/wpdtc-skills-one#wpdtc-post-to-wordpress
    requires:
      anyBins:
        - python3
        - python
---

# Post to WordPress

## User Input Tools

When this skill prompts the user, follow this tool-selection rule (priority order):

1. **Prefer built-in user-input tools** exposed by the current agent runtime — e.g., `AskUserQuestion`, `request_user_input`, `clarify`, `ask_user`, or any equivalent.
2. **Fallback**: if no such tool exists, emit a numbered plain-text message and ask the user to reply with the chosen number/answer for each question.
3. **Batching**: if the tool supports multiple questions per call, combine all applicable questions into a single call; if only single-question, ask them one at a time in priority order.

Concrete `AskUserQuestion` references below are examples — substitute the local equivalent in other runtimes.

## Language

Respond in the user's language. If they write in Chinese, reply in Chinese; if English, English. Keep technical tokens (paths, flags, field names) in English.

## Script Directory

`{baseDir}` = this SKILL.md's directory. Resolve `${PYTHON}`: prefer `python3`; else `python`.

| Script | Purpose |
|--------|---------|
| `scripts/wp_publish.py` | Complete WordPress publishing pipeline |
| `scripts/block_generator.py` | Markdown → Gutenberg block HTML converter |
| `scripts/media_uploader.py` | Batch media upload to WordPress library |

## Preferences (EXTEND.md)

Check these paths in order; first hit wins:

| Path | Scope |
|------|-------|
| `.wpdtc-skills/wpdtc-post-to-wordpress/EXTEND.md` | Project |
| `${XDG_CONFIG_HOME:-$HOME/.config}/wpdtc-skills/wpdtc-post-to-wordpress/EXTEND.md` | XDG |
| `$HOME/.wpdtc-skills/wpdtc-post-to-wordpress/EXTEND.md` | User home |

Found → read, parse, apply. Not found → run first-time setup (`references/config/first-time-setup.md`) before anything else.

**Minimum keys** (case-insensitive, accept `1/0` or `true/false`):

| Key | Default | Mapping |
|-----|---------|---------|
| `default_site_url` | empty | WordPress site base URL (e.g., `https://example.com`) |
| `default_status` | `draft` | Post status: `draft`, `publish`, `pending`, `private` |
| `default_author_id` | empty | WordPress author/user ID |
| `default_category` | empty | Default category name or ID |
| `auto_publish` | `0` | Auto-publish after creation (1=yes, 0=save as draft) |
| `convert_html_to_blocks` | `1` | Convert HTML content to Gutenberg blocks (1=yes) |

**Recommended EXTEND.md**:

```md
# WordPress Publishing Preferences
default_site_url: https://your-site.com
default_status: draft
default_category: Blog
auto_publish: 0
convert_html_to_blocks: 1
```

**Value priority**: CLI args → frontmatter → EXTEND.md (project-level → XDG → user home) → skill defaults.

## Multi-Site Support

EXTEND.md supports a `sites:` block for managing multiple WordPress sites. With 2+ entries, the workflow inserts a Step 0.5 to prompt for site selection (or auto-selects based on `default: true` or `--site <alias>`).

```yaml
sites:
  - alias: main
    url: https://main-site.com
    username: admin
    default: true
  - alias: dev
    url: https://dev-site.com
    username: editor
```

Full details — credential resolution, per-site settings — in `references/multi-site.md`.

## Credentials

WordPress REST API requires authentication. Set environment variables:

```bash
export WP_URL="https://your-site.com"
export WP_USERNAME="your-username"
export WP_APPLICATION_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx"
```

**Application Password setup** (WordPress 5.6+):
1. Log in to WordPress admin
2. Go to **Users → Profile** → scroll to **Application Passwords**
3. Enter a name (e.g., "WPDTC Agent")
4. Click **Add New Application Password**
5. Copy the generated password (24-character phrase with spaces)

**Safety guidelines**:
- ✅ DO: Use Application Passwords (never your main admin password)
- ✅ DO: Create a dedicated user with minimal privileges (`edit_posts`, `upload_files`)
- ✅ DO: Store credentials in environment variables
- ❌ DON'T: Hardcode passwords in scripts
- ❌ DON'T: Pass credentials via command-line arguments (visible in process lists)
- ❌ DON'T: Disable SSL verification (`verify=False`) in production

## Pre-flight Check

Before first use, test the WordPress connection:

```bash
${PYTHON} {baseDir}/scripts/wp_publish.py --test
```

| Check fails | Fix |
|-------------|-----|
| Connection refused | Check `WP_URL` — must include `https://` and be the site root |
| 401 Authentication failed | Verify `WP_USERNAME` and `WP_APPLICATION_PASSWORD`; re-generate Application Password if needed |
| 403 Permission denied | Ensure the user has `edit_posts` capability; check user role |
| 404 Not found | Enable pretty permalinks (Settings → Permalinks → "Post name") |
| Python not found | Install Python 3.8+ (`python3 --version`) |
| `requests` module missing | Run `pip install requests` |

## Publishing Workflow

```
- [ ] Step 0: Load preferences (EXTEND.md)
- [ ] Step 0.5: Resolve site (multi-site only)
- [ ] Step 1: Determine input type
- [ ] Step 2: Configure credentials
- [ ] Step 3: Convert content to Gutenberg blocks
- [ ] Step 4: Resolve metadata (categories, tags, featured image, status)
- [ ] Step 5: Publish to WordPress
- [ ] Step 6: Report completion
```

### Step 0: Load Preferences

Check and load EXTEND.md (see "Preferences" above). If not found, complete first-time setup before any other questions. Resolve and cache for later steps: `default_site_url`, `default_status`, `default_category`, `auto_publish`, `convert_html_to_blocks`.

### Step 1: Determine Input Type

| Input | Detection | Next |
|-------|-----------|------|
| HTML file | Path ends `.html`, file exists | Step 3 (or skip to 4 if `convert_html_to_blocks=0`) |
| Markdown file | Path ends `.md`, file exists | Step 3 |
| Plain text | Not a file path, or file doesn't exist | Save to markdown, then Step 3 |

**Plain-text handling**:

1. Generate slug (first 2-4 meaningful words, kebab-case; translate Chinese to English for the slug).
2. Save to `post-to-wordpress/YYYY-MM-DD/<slug>.md` (create directory if needed).
3. Continue as a markdown file.

### Step 2: Configure Credentials

Verify environment variables are set. If missing, prompt for:

1. **Site URL**: The WordPress site base URL (e.g., `https://mysite.com`)
2. **Authentication choice**:
   - **Application Password** (recommended): prompt for username + app password
   - **JWT** (if JWT plugin installed): prompt for username + password

Set as environment variables for the session. Offer to persist to EXTEND.md for future use (with security warning).

### Step 3: Convert Content to Gutenberg Blocks

**For Markdown input**: use the block generator to convert:

```bash
${PYTHON} {baseDir}/scripts/block_generator.py <input_file> --output <output_file>
```

**For HTML input** with `convert_html_to_blocks=1`: pass through the block generator.

**For HTML input** with `convert_html_to_blocks=0`: use HTML content directly as Gutenberg content.

**Supported Gutenberg blocks** from Markdown:
- Paragraphs (with bold, italic, links, inline code)
- Headings (h1-h6, with anchors)
- Ordered and unordered lists
- Code blocks (with language specification)
- Blockquotes (with citations)
- Images (with alt text, captions, alignment)
- Separators
- Columns (multi-column layouts)
- Groups (with background colors)

See `references/common_blocks.md` for all supported blocks and their HTML format.

### Step 4: Resolve Metadata

Resolve the following in order (first match wins):

| Field | Priority | Default |
|-------|----------|---------|
| **Title** | frontmatter `title` → CLI `--title` → EXTEND.md → auto-generate from first heading | First H1/H2 or "Untitled Post" |
| **Status** | CLI `--status` → frontmatter `status` → EXTEND.md `default_status` | `draft` |
| **Categories** | CLI `--categories` → frontmatter `categories` → EXTEND.md `default_category` → skip | None |
| **Tags** | CLI `--tags` → frontmatter `tags` → skip | None |
| **Excerpt** | frontmatter `excerpt`/`description` → auto-generate | First paragraph, 150 chars |
| **Featured Image** | CLI `--featured-image` → frontmatter `coverImage`/`featuredImage`/`cover` → skip | None |
| **Author** | CLI `--author` → frontmatter `author` → EXTEND.md `default_author_id` | Default WP user |

**Auto-generation rules**:
- Title: first H1/H2 heading; if none, first sentence; if still none, "Untitled Post"
- Excerpt: first paragraph content, truncated to 150 characters
- Slug: generated from title (lowercase, kebab-case, Chinese → English)

### Step 5: Publish

Publish the post using the wp_publish.py script:

```bash
${PYTHON} {baseDir}/scripts/wp_publish.py \
  --title "<title>" \
  --content-file <gutenberg_blocks_file> \
  --status <draft|publish> \
  [--categories "Cat1" "Cat2"] \
  [--tags "tag1" "tag2"] \
  [--featured-image <image_path>] \
  [--excerpt "<excerpt>"] \
  [--publish]
```

Or use a JSON config file for complex posts:

```bash
${PYTHON} {baseDir}/scripts/wp_publish.py --config <config.json>
```

**Post status options**:

| Status | Description | When to use |
|--------|-------------|-------------|
| `draft` | Saved as draft, not published | Default — review before publishing |
| `publish` | Published immediately | Content is ready for public |
| `pending` | Pending review | Needs editor approval |
| `private` | Private post | Only for logged-in users |

**Image upload workflow** (if post contains local images):

1. Run `media_uploader.py` first to upload all images:
   ```bash
   ${PYTHON} {baseDir}/scripts/media_uploader.py --directory ./images/
   ```
2. Use the generated media IDs in block content
3. Set featured image: `--featured-image cover.jpg` (auto-uploaded)

**Category/Tag handling**:
- Specify names (not just IDs) — the script will auto-create categories/tags that don't exist
- Multiple values: `--categories "Tech" "AI" "Tutorial"`

### Step 6: Completion Report

```
WordPress Publishing Complete!

Site: [site_url]
Input: [type] - [path]
Method: REST API

Post:
• ID: [post_id]
• Title: [title]
• Status: [draft/publish]
• Categories: [category names]
• Tags: [tag names]
• Featured Image: [media_id or "none"]
• Slug: [slug]

Result:
✓ Post [created/published] successfully

Links:
→ Edit: [site_url]/wp-admin/post.php?post=[post_id]&action=edit
→ Preview: [site_url]/?p=[post_id]&preview=true
→ View: [site_url]/?p=[post_id]

Files created:
[• post-to-wordpress/YYYY-MM-DD/slug.md (if plain text input)]
• [slug]-blocks.html (Gutenberg blocks)
```

## Update Existing Posts

To update an existing post:

```bash
${PYTHON} {baseDir}/scripts/wp_publish.py \
  --post-id 123 \
  --title "Updated Title" \
  --content-file updated_blocks.html \
  --status publish
```

The workflow detects `--post-id` and switches to update mode. Ask for post ID if the user mentions "update", "modify", "修改", or "更新".

## Media Management

### Upload Images

```bash
# Upload single image
${PYTHON} {baseDir}/scripts/media_uploader.py image.jpg

# Upload all images in directory
${PYTHON} {baseDir}/scripts/media_uploader.py --directory ./images/

# Upload with metadata
${PYTHON} {baseDir}/scripts/media_uploader.py image.jpg --metadata "title=Cover;alt_text=Article cover"
```

### Batch Media from CSV

```bash
${PYTHON} {baseDir}/scripts/media_uploader.py --csv media_list.csv
```

CSV format: `file_path,title,caption,alt_text`

## Feature Comparison

| Feature | Markdown Input | HTML Input | Plain Text |
|---------|:---:|:---:|:---:|
| Auto-convert to Gutenberg blocks | ✓ | ✓ (opt) | ✓ |
| Categories & tags | ✓ | ✓ | ✓ |
| Featured image | ✓ | ✓ | ✓ |
| Draft/Publish control | ✓ | ✓ | ✓ |
| Excerpt auto-generation | ✓ | ✓ | ✓ |
| Multi-site support | ✓ | ✓ | ✓ |
| Update existing posts | ✓ | ✓ | ✓ |
| Batch media upload | ✓ | ✓ | ✓ |
| Code blocks with syntax | ✓ | ✗ | ✗ |
| Columns & groups | ✓ | ✓ | ✗ |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Missing credentials | Run Step 2 guided setup; set `WP_URL`, `WP_USERNAME`, `WP_APPLICATION_PASSWORD` |
| "403 Forbidden" | User lacks `edit_posts` capability; check WordPress user role |
| "404 Not found" | Ensure permalinks are set to "Post name" (Settings → Permalinks) |
| Blocks stripped | Content must use valid Gutenberg block format; check block generator output |
| Image upload fails | Check file type allowed; ensure file < size limit; use `media_uploader.py` |
| SSL certificate error | Install full cert chain; never use `verify=False` in production |
| "Sorry, this file type is not permitted" | Supported: jpg, png, gif, webp, pdf, mp4; check WordPress allowed MIME types |
| Category not found | Script auto-creates; check user has `manage_categories` capability |
| Title/summary missing | Auto-generated from content; provide manually via frontmatter for better results |
| Rate limiting | Add delays (1-2s between requests); use --config for batch operations |

## References

| File | Content |
|------|---------|
| `references/common_blocks.md` | All supported Gutenberg blocks with examples |
| `references/api_reference.md` | Complete WordPress REST API reference |
| `references/troubleshooting.md` | Detailed troubleshooting and debugging |
| `references/multi-site.md` | Multi-site configuration and credential management |
| `references/config/first-time-setup.md` | First-time EXTEND.md setup guide |

## Extension Support

Custom configurations via EXTEND.md. See "Preferences" for paths and supported options.
