# BillSplitter

A Chrome extension that parses PDF bills from multiple carriers, aggregates per-person expenses, and lets you request payments via Venmo or PayPal in one click.

## Supported Carriers

| Carrier | Members Identified By | Splitting Logic |
|---------|----------------------|-----------------|
| **Google Fi** | Name (e.g. "Lance Lee") | Per-member totals extracted directly from bill |
| **T-Mobile** | Phone number (e.g. "(206) 555-1234") | Shared account charges split equally among "Included" lines; lines with explicit plan costs pay their own |

The bill type is auto-detected from the PDF content — just drop any supported bill and it works.

## Features

- **Multi-carrier, multi-bill** — Upload Google Fi and T-Mobile PDF statements together in any combination
- **Per-person breakdown** — Automatically extracts each member's charges from every bill
- **Aggregated view** — Summary table showing per-bill and total amounts for each person
- **One-click payment requests** — Map each person to a Venmo or PayPal.me account, then open a prefilled payment request page directly from the table. Tested with real Venmo charge URLs and PayPal.me links.
- **Persistent contact mapping** — Payment methods are saved locally and auto-populated on next use. Edit or unbind anytime.
- **Input validation** — Venmo handles are sanitized (leading `@` stripped) and validated against username, phone, and email formats. PayPal.me usernames are checked for alphanumeric compliance.
- **Carrier icons** — Each bill shows a Google Fi or T-Mobile icon for quick identification
- **Duplicate detection** — Warns if the same bill is uploaded twice
- **Side panel UI** — Opens as a Chrome side panel for easy reference while browsing

## Security and Privacy

This extension is designed with a **zero-trust, lightweight architecture**:

- **No backend, no server** — Everything runs 100% client-side in your browser
- **No secrets or credentials stored** — The extension never asks for, stores, or transmits any passwords, API keys, OAuth tokens, or payment credentials
- **No network requests** — PDF parsing and expense aggregation happen entirely offline. The only outbound navigation is when you explicitly click "Request" to open a Venmo/PayPal page in a new tab.
- **Minimal permissions** — Only `sidePanel` (to open the UI) and `storage` (to remember your Venmo/PayPal contact mappings locally). No access to browsing history, tabs content, or web requests.
- **Local-only storage** — Payment contact mappings (just a username per person) are saved in `chrome.storage.local`, never synced or uploaded

## How It Works

The extension uses [pdf.js](https://mozilla.github.io/pdf.js/) to extract text from each PDF page, then applies carrier-specific parsing:

- **Google Fi** — Extracts the per-member summary table from page 2
- **T-Mobile** — Parses the "THIS BILL SUMMARY" table on page 2. Lines marked "Included" under Plans split the shared Account charges equally. Lines with explicit dollar amounts pay their own plan cost.

For payment requests, the extension generates prefilled URLs:
- **Venmo**: `venmo.com/{handle}?txn=charge&amount={amount}&note=...`
- **PayPal**: `paypal.me/{username}/{amount}`

## Installation

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the cloned folder

## Usage

1. Click the extension icon in Chrome — the side panel opens
2. Drag and drop (or click to select) one or more carrier billing PDFs
3. View the aggregated expense table showing each person's charges per bill and their total
4. For each person, select Venmo or PayPal, enter their handle, and click **Save**
5. Click **Request $XX.XX** to open a prefilled payment page in a new tab

## File Structure

```
fi-expense-extension/
├── manifest.json        # Chrome MV3 extension manifest
├── background.js        # Opens side panel on icon click
├── popup.html           # Main UI
├── popup.css            # Styles
├── popup.js             # File handling, aggregation, payment mapping, rendering
├── parser.js            # Auto-detect carrier and parse (Google Fi / T-Mobile)
├── lib/
│   ├── pdf.min.mjs      # pdf.js v4.0.379
│   └── pdf.worker.min.mjs
└── icons/
    └── icon128.png
```
