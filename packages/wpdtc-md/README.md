# wpdtc-md

Shared Markdown rendering, frontmatter parsing, HTML building, and image handling pipeline.

Consumed by: `wpdtc-markdown-to-html`, `wpdtc-post-to-wechat`, `wpdtc-post-to-weibo`.

## API

```ts
import { parseFrontmatter, serializeFrontmatter } from 'wpdtc-md/content';
import { buildHtml } from 'wpdtc-md/html-builder';
import { renderMarkdown } from 'wpdtc-md/render';
```
