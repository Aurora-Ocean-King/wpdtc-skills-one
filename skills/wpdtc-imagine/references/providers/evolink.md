# Evolink Provider — 全部图像模型（异步）

> **Base URL**: `https://api.evolink.ai`（可通过 `EVOLINK_BASE_URL` 覆盖）
> **API Key**: 在 https://evolink.ai/dashboard/keys 获取，设置 `EVOLINK_API_KEY`
> **默认模型**: `gpt-image-2-beta`

## 支持的模型

Evolink 图像系列全部模型（统一 POST /v1/images/generations + 异步轮询）：

### GPT Image 家族

| 模型 | 说明 | size | quality | 其他参数 |
|------|------|------|---------|----------|
| `gpt-image-2` | GPT Image 2 (稳定版) | ratio(15种) / pixel | low / medium / high | resolution(1K/2K/4K), n:1-10 |
| `gpt-image-2-beta` ⭐ **默认** | GPT Image 2 Beta | ratio(13种) | ❌ 不支持 | 无 resolution |
| `gpt-image-1.5-beta` | GPT Image 1.5 Lite | 3 ratio / 3 pixel | low / medium / high / auto | n=1 固定 |

### Nanobanana 家族

| 模型 | 说明 | size | quality | 特色 |
|------|------|------|---------|------|
| `gemini-3.1-flash-image-preview` | Nanobanana 2 | ratio 广泛 | 0.5K/1K/2K/4K | web_search, thinking_level |
| `nano-banana-2-beta` | Nanobanana 2 Beta | ratio 广泛 | 0.5K/1K/2K/4K | web_search, thinking_level |
| `gemini-3-pro-image-preview` | Nanobanana Pro | ratio+auto | 1K/2K/4K | web_search |
| `nano-banana-beta` | Nanobanana v1 | ratio limited | ❌ | 无 |

### 其他

| 模型 | 说明 | size | 特色 |
|------|------|------|------|
| `z-image-turbo` | Z Image Turbo | ratio / pixel(376-1536) | seed, nsfw_check |
| `seedream-4.5` | Seedream 4.5 | ratio / pixel | quality(2K/4K), n:1-4 |

### 兼容别名

| 别名 | 映射到 |
|------|--------|
| `gpt-image-1.5-lite` | `gpt-image-1.5-beta` |
| `gemini-2.5-flash-image` | `nano-banana-beta` |

## 异步流程

```
POST /v1/images/generations
  → 返回 { id: "task-unified-xxx", status: "pending" }
  → 轮询 GET /v1/tasks/{task_id}
    → status: "pending" | "processing" | "completed" | "failed"
    → progress: 0-100
  → completed: results[] 包含图片 URL（有效期 24h）
  → 下载 → 保存为本地文件
```

- 轮询间隔：2 秒
- 超时时间：5 分钟
- 重试：3 次（由 main.ts 通用重试机制处理）

## 参数映射（按模型家族）

### gpt-image-2 (稳定版)

| CLI 参数 | API 参数 | 取值 |
|----------|----------|------|
| `--ar 16:9` | `size: "16:9"` | 15 种比例 |
| `--size 1024x1024` | `size: "1024x1024"` | 像素格式 |
| `--imageSize 2K` | `resolution: "2K"` | 1K/2K/4K |
| `--quality normal` | `quality: "medium"` | normal→medium, 2k→high |

### gpt-image-2-beta (默认)

| CLI 参数 | API 参数 | 取值 |
|----------|----------|------|
| `--ar 16:9` | `size: "16:9"` | 13 种比例: 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9, 9:21, 2:1, 1:2, 3:1, 1:3 |
| 无参数 | 不传 size | 自动 |

> ⚠️ gpt-image-2-beta **不支持** `resolution` 和 `quality` 参数

### Nanobanana 家族

| CLI 参数 | API 参数 | 说明 |
|----------|----------|------|
| `--ar 16:9` | `size: "16:9"` | ratio only |
| `--imageSize 2K` | `quality: "2K"` | nanobanana-2 支持 0.5K/1K/2K/4K，pro 支持 1K/2K/4K |

### Z Image Turbo / Seedream / GPT Image 1.5

z-image-turbo 支持像素尺寸范围 376-1536px，seedream 支持 2K/4K 质量档位。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `EVOLINK_API_KEY` | API Key（必填） | - |
| `EVOLINK_BASE_URL` | 自定义 endpoint | `https://api.evolink.ai` |
| `EVOLINK_IMAGE_MODEL` | 默认模型 | `gpt-image-2-beta` |

## 使用示例

```bash
# 默认模型 (gpt-image-2-beta) 文生图
bun scripts/main.ts --provider evolink --prompt "一只猫" --image cat.png

# 使用 GPT Image 2 稳定版 + 高清
bun scripts/main.ts --provider evolink --model gpt-image-2 --ar 16:9 --imageSize 2K --prompt "风景" --image view.png

# Nanobanana Pro
bun scripts/main.ts --provider evolink --model gemini-3-pro-image-preview --ar 16:9 --imageSize 4K --prompt "未来都市" --image city.png

# Seedream 4.5
bun scripts/main.ts --provider evolink --model seedream-4.5 --ar 16:9 --imageSize 4K --prompt "日落" --image sunset.png

# Z Image Turbo
bun scripts/main.ts --provider evolink --model z-image-turbo --size 1024x768 --prompt "像素风角色" --image pixel.png
```
