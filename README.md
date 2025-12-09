# 📎 Notion Research Clipper - Screenshots & Citations

A powerful Chrome extension for researchers and students to clip screenshots, text, and auto-generate citations directly to your Notion database.

## ✨ Features

- **📝 Clip Text Selection** - Highlight any text on a webpage and save it directly to Notion
- **📸 Screenshot Capture** - Take full-page or area screenshots and save to Notion
- **📄 Full Page Clipping** - Save entire article content with automatic summarization
- **📚 Auto-Citations** - Generate citations in APA, MLA, Chicago, or Harvard format
- **🏷️ Tag Management** - Organize your clips with custom tags
- **📝 Notes** - Add personal notes to any clip
- **⌨️ Keyboard Shortcuts** - Quick actions with `Alt+Shift+S` (clip selection) and `Alt+Shift+C` (screenshot)
- **🔗 Context Menu Integration** - Right-click to clip selection, images, links, or pages

## 📁 Project Structure

```
notion-research-clipper/
├── manifest.json           # Extension manifest (MV3)
├── popup/
│   ├── popup.html          # Main popup interface
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── content/
│   ├── content.js          # Content script for page interaction
│   └── content.css         # Content styles
├── background/
│   └── background.js       # Service worker for background tasks
├── options/
│   ├── options.html        # Settings page
│   ├── options.css         # Settings styles
│   └── options.js          # Settings logic
├── utils/
│   ├── notion-api.js       # Notion API wrapper
│   ├── citation.js         # Citation generator
│   └── storage.js          # Storage utilities
├── icons/
│   ├── icon16.png          # 16x16 icon
│   ├── icon48.png          # 48x48 icon
│   └── icon128.png         # 128x128 icon
└── README.md
```

## 🚀 Installation

### Development Mode

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/notion-research-clipper.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top right)

4. Click **Load unpacked** and select the extension folder

### Production (Chrome Web Store)

*Coming soon*

## ⚙️ Setup

### 1. Create a Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"New integration"**
3. Give it a name (e.g., "Research Clipper")
4. Select the workspace where you want to save clips
5. Copy the **Internal Integration Token**

### 2. Share Your Database

1. Open the Notion database where you want to save clips
2. Click **Share** → **Invite**
3. Search for your integration name and add it
4. Ensure the database has these properties:
   - **Name** (Title) - required
   - **URL** (URL)
   - **Tags** (Multi-select)
   - **Type** (Select)
   - **Clipped** (Date)

### 3. Connect the Extension

1. Click the extension icon in Chrome
2. Click **Settings** (⚙️)
3. Enter your Integration Token
4. Select your default database
5. Start clipping!

## 📖 Usage

### Quick Clip (Selection)
1. Select text on any webpage
2. Click the floating 📎 button, or
3. Press `Alt+Shift+S`, or
4. Right-click → "Clip selection to Notion"

### Screenshot
1. Press `Alt+Shift+C`, or
2. Click **Screenshot** in the popup
3. Drag to select the area (or capture full visible page)

### Full Page Clip
1. Open the extension popup
2. Click **Clip Page**
3. The article content will be extracted and saved

### Citations
- Citations are auto-generated based on page metadata
- Choose format: APA, MLA, Chicago, or Harvard
- Click 📋 to copy citation to clipboard

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+S` | Quick clip selection |
| `Alt+Shift+C` | Take screenshot |

Customize shortcuts at `chrome://extensions/shortcuts`

## 🔧 Configuration Options

| Setting | Description |
|---------|-------------|
| Citation Format | Default format for auto-generated citations |
| Show Quick Clip | Show floating button on text selection |
| Auto-save | Skip confirmation when clipping |
| Notification Sound | Play sound on successful clip |
| Highlight Clipped | Highlight clipped text on page |

## 🔒 Privacy

- Your Notion token is stored locally in Chrome's secure storage
- We only access pages you explicitly share with the integration
- No data is sent to third-party servers
- All processing happens locally in your browser

## 🛠️ Development

### Prerequisites
- Node.js 16+ (for development tools)
- Chrome browser

### Building

The extension uses Manifest V3 and ES modules. No build step required for development.

### Testing

1. Load the extension in developer mode
2. Make changes to source files
3. Click the refresh button on `chrome://extensions/`
4. Test your changes

### Code Style

- ES6+ JavaScript
- Modular architecture
- Descriptive variable names
- Comments for complex logic

## 📝 API Reference

### Notion API
The extension uses the [Notion API v1](https://developers.notion.com/) with the following endpoints:
- `GET /users/me` - Verify token
- `POST /search` - Find databases
- `POST /pages` - Create new pages
- `PATCH /blocks/{id}/children` - Add content blocks

### Citation Formats
- **APA 7th Edition** - Author, A. A. (Year, Month Day). Title. Site Name. URL
- **MLA 9th Edition** - Author. "Title." Site Name, Date, URL. Accessed Date.
- **Chicago 17th** - Author. "Title." Site Name. Date. URL.
- **Harvard** - Author (Year) Title. Available at: URL (Accessed: Date).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Notion API](https://developers.notion.com/) for the excellent API
- Chrome Extensions team for Manifest V3
- All contributors and users

---

**Made with ❤️ for researchers and students**