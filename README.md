# Image Studio

Web studio for generating and editing images through any OpenAI-compatible API
(`/images/generations`, `/images/edits`). UI in English and Russian.

The prompt goes to the API as written: no LLM in between, no edit history stitched into the text.
An edit sends one image (the selected version) plus a short instruction.

## Features

- Mask brush: native PNG mask for models that support it, red markup on the image for the rest
- Version tree: edit from any version, compare with parent, re-run with another model or quality
- Request inspector: see exactly what was sent for each version
- Per-model capability profiles (`size`, `quality`, `n`, transparent background, negative prompt, mask); rejected parameters are disabled automatically
- Reference images with roles (style / object / character)
- Zoom and pan, projects, upload your own photo, light and dark themes

## Setup

```bash
npm install
npm run dev
```

On first launch enter your API base URL (e.g. `https://api.example.com/v1`) and key.
Both are stored only in your browser's localStorage. Never commit or share your key.

## Stack

React 19, Vite, Tailwind CSS v4, shadcn/ui, idb-keyval.
