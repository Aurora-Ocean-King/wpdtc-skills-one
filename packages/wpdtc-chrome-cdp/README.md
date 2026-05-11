# wpdtc-chrome-cdp

Shared Chrome DevTools Protocol (CDP) utilities for WPDTC skills.

Used by skills that require browser automation (e.g., `wpdtc-post-to-x`, `wpdtc-post-to-weibo`).

## API

```ts
import { launchChrome, CDPClient } from 'wpdtc-chrome-cdp';

const client = await launchChrome({ profileDir: './chrome-profile' });
await client.navigate('https://example.com');
await client.close();
```
