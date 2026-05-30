# OpenArt Clone — AI Creator Studio (UI)

A static, dependency-free web app that mimics the layout and functionality of [OpenArt's AI tools suite](https://openart.ai/suite/ai-tools).

## Run

Just open `index.html` in a browser, or serve it locally:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then visit http://localhost:8000/openart/.

## What's included

- Sidebar nav (Home, Create categories, Assets, Inspire, Help/Pricing)
- Topbar with search, sign-in / Start for Free CTA
- Hero with pinned tools (Motion Sync, Lip-Sync, Edit Image, Edit Video)
- Category tabs (Video / Image / Character / World / Audio)
- Tools grid with 25+ tools matching the OpenArt catalog
- Tool modal with dynamic form per tool:
  - Prompt textarea
  - Drag-and-drop file upload (image / video / audio) with live preview
  - Aspect ratio, duration, style, scale, voice selectors
- Mocked generation pipeline with a multi-stage progress bar
- Output preview pane (image / video / audio) inside the modal
- "Creations" gallery with type filters, hover-play video previews, delete, and download
- All creations persisted in `localStorage`
- Fully responsive (desktop sidebar collapses to a slide-in menu on mobile)
- Dark theme with gradient accents matching the original

## Wiring real AI

All "AI generation" is mocked locally so the demo runs offline. Replace the
`runMockGeneration(tool, data)` function in `app.js` with `fetch()` calls to
your backend or model provider. It must return:

```js
{ url: string, type: 'image' | 'video' | 'audio' }
```

Everything else (form rendering, validation, progress UI, gallery persistence)
will keep working unchanged.

## Files

- `index.html` — markup and structure
- `styles.css` — theme, layout, and animations
- `app.js`    — tool catalog, modal, mock generation, gallery
