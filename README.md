# BillSplitter

**Turn shared carrier statements into a clear, local-first settlement view.**

BillSplitter is a Chrome side-panel extension for households that share mobile plans. Drop in supported PDF statements, review a per-person breakdown across one or more bills, and open a pre-filled Venmo or PayPal request when you are ready to settle up.

The product is intentionally small: no account, no backend, and no bill data sent to a service.

---

## The workflow

1. Add Google Fi or T-Mobile PDF statements.
2. BillSplitter identifies the carrier and extracts each line's charge.
3. Review the combined balance by person.
4. Save a local Venmo or PayPal handle, then open a pre-filled payment request.

The extension never initiates a payment. It opens the payment provider's page after you choose **Request**.

## What it supports

| Carrier | Member identifier | Allocation approach |
| --- | --- | --- |
| Google Fi | Name on the statement | Reads the statement's per-member totals |
| T-Mobile | Phone number | Assigns explicit plan costs to that line and divides shared account charges among eligible lines |

Bills are detected from their PDF text. Formats vary by carrier and can change, so unsupported or materially changed statements fail with an error rather than silently producing a result.

## Architecture

```text
PDF statement
    ↓
pdf.js text extraction (in the browser)
    ↓
carrier-specific parser ──→ normalized member charges
    ↓
side-panel aggregation ──→ reviewable totals + payment-request links
```

- `parser.js` extracts PDF text with bundled `pdf.js`, detects the carrier, and normalizes the resulting charges.
- `popup.js` handles multi-file intake, aggregation, duplicate detection, rendering, and payment-contact mapping.
- `background.js` opens the Chrome side panel from the toolbar action.
- `chrome.storage.local` holds only the payment method and handle you choose to save for a person.

## Privacy and permissions

BillSplitter is designed to keep the statement-processing path on the device.

- **No backend or account.** PDF parsing and aggregation run in the browser.
- **No network requests for bill processing.** A provider page opens only after an explicit payment-request action.
- **Minimal extension permissions.** `sidePanel` shows the interface; `storage` retains the local contact mapping.
- **No payment credentials.** The extension does not request, store, or transmit passwords, tokens, or payment information.

## Install locally

This repository has no build step.

1. Clone or download this repository.
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this repository's root folder.
5. Click the extension icon to open the side panel.

## Use it

1. Drag one or more supported carrier PDFs into the panel.
2. Check the detected bills and the aggregated totals.
3. For each person, choose Venmo or PayPal and save the handle locally if you want to reuse it.
4. Select **Request** to open a pre-filled request at the chosen provider.

## Repository map

```text
manifest.json       Chrome Manifest V3 configuration
background.js       Toolbar action → side panel
popup.html          Side-panel markup
popup.css           Side-panel styling
popup.js            Intake, aggregation, local mappings, and UI rendering
parser.js           Google Fi and T-Mobile PDF parsers
lib/                Bundled pdf.js runtime and worker
icons/              Extension icon assets
```

## Current boundaries

- Supported carriers are limited to Google Fi and T-Mobile.
- Parsing depends on recognizable statement text and is not a substitute for reviewing the final breakdown.
- Payment requests require a person-to-handle mapping supplied by the user.
- The extension is loaded unpacked; it is not distributed through the Chrome Web Store.

## Screenshots

The repository currently has no product screenshots. Contributions that add anonymized screenshots are welcome; please do not include real names, phone numbers, account details, or statement data.
