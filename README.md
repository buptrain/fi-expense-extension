# Fi Expense Aggregator

A Chrome extension that parses multiple Google Fi PDF bills and aggregates per-person expenses into a single summary table.

## Features

- **Multi-bill support** — Upload multiple Google Fi PDF statements at once
- **Per-person breakdown** — Automatically extracts each member's charges from every bill
- **Aggregated view** — Summary table showing per-bill and total amounts for each person
- **Client-side only** — All PDF parsing happens locally in your browser; no data is sent anywhere
- **Duplicate detection** — Warns if the same bill is uploaded twice
- **Side panel UI** — Opens as a Chrome side panel for easy reference while browsing

## How It Works

Google Fi PDF statements contain a per-member summary on page 2 (e.g. "Lance Lee $51.58, chen jie $44.54, ..."). The extension uses [pdf.js](https://mozilla.github.io/pdf.js/) to extract text from each page, then parses the per-person charges using pattern matching.

## Installation

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the cloned folder

## Usage

1. Click the extension icon in Chrome — the side panel opens
2. Drag and drop (or click to select) one or more Google Fi PDF bills
3. View the aggregated expense table showing each person's charges per bill and their total

## File Structure

```
fi-expense-extension/
├── manifest.json        # Chrome MV3 extension manifest
├── background.js        # Opens side panel on icon click
├── popup.html           # Main UI
├── popup.css            # Styles
├── popup.js             # File handling, aggregation, rendering
├── parser.js            # Google Fi PDF text extraction & parsing
├── lib/
│   ├── pdf.min.mjs      # pdf.js v4.0.379
│   └── pdf.worker.min.mjs
└── icons/
    └── icon128.png
```

## Supported Bills

Tested with Google Fi Wireless monthly statements (Unlimited Premium plan). The parser expects the standard Google Fi PDF format with per-member totals on page 2.
