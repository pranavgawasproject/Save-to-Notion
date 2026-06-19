# 📎 Save to Notion — Research Clipper

> A Chrome extension (Manifest V3) that **clips screenshots, text, and auto-generated citations directly into your Notion database** — built for researchers, students, and lifelong learners.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome)](https://developer.chrome.com/docs/extensions/)
[![Notion API](https://img.shields.io/badge/Notion-API-000)](https://developers.notion.com)

## ✨ Features

- 📸 **Screenshot Clipping** — capture any visible region into your Notion DB
- 📝 **Text Clipping** — save selected text with one click
- 🧾 **Auto-Citations** — generate citations (title, author, URL, date) automatically
- 🗂️ **Database Routing** — push clips into a specific Notion database
- ⚙️ **Options Page** — configure Notion API key + target DB
- 🔔 **Notifications** — confirmation toasts on success / failure
- 🧰 **Context Menu** — right-click to clip

## 🛠️ Tech Stack

- **Manifest V3** service worker
- **Vanilla JS** background, content, popup, options
- **Notion SDK** via `utils/notion-api.js`
- **Local storage** for credentials (`utils/storage.js`)
- **Citation helpers** in `utils/citation.js`

## 📁 Project Structure

```
.
├── manifest.json
├── background/background.js
├── content/
│   ├── content.js
│   └── content.css
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── utils/
│   ├── citation.js
│   ├── notion-api.js
│   └── storage.js
└── icons/        # 16 / 48 / 128 px
```

## 🚀 Install (Developer Mode)

1. Clone the repo
2. Open `chrome://extensions/`
3. Toggle **Developer mode** (top-right)
4. Click **Load unpacked** → select this repo's root folder
5. Open the extension popup, go to **Options**, paste your Notion API key + database ID

## 🔐 Permissions

`storage`, `activeTab`, `scripting`, `contextMenus`, `notifications`, `<all_urls>`

## 📜 License

[MIT](LICENSE) © 2026 Pranav Gawas
