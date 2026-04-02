import * as pdfjsLib from "./lib/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdf.worker.min.mjs";

/**
 * Extract text from all pages of a PDF.
 * @param {ArrayBuffer} pdfBuffer
 * @returns {Promise<string[]>}
 */
async function extractPages(pdfBuffer) {
  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(" "));
  }
  return pages;
}

/**
 * Auto-detect bill type and parse accordingly.
 * @param {ArrayBuffer} pdfBuffer
 * @returns {Promise<{billDate: string, total: number, members: {name: string, amount: number}[]}>}
 */
export async function parseBill(pdfBuffer) {
  const pages = await extractPages(pdfBuffer);
  const page1 = pages[0] || "";

  if (/T-Mobile/i.test(page1)) {
    return { carrier: "tmobile", ...parseTMobileBill(pages) };
  }
  if (/Google Fi/i.test(page1)) {
    return { carrier: "googlefi", ...parseGoogleFiBill(pages) };
  }
  throw new Error("Unrecognized bill format. Currently supports Google Fi and T-Mobile.");
}

/**
 * Parse a Google Fi bill from pre-extracted page texts.
 */
function parseGoogleFiBill(pages) {
  const dateMatch = pages[0].match(/statement\s+for\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
  const billDate = dateMatch ? dateMatch[1] : "Unknown date";

  const page2 = pages[1] || "";
  const members = [];
  let total = 0;

  const perPersonRegex = /Total\s+\$[\d,.]+\s+([\s\S]*?)\s+Total\s+\$[\d,.]+\s*$/;
  const blockMatch = page2.match(perPersonRegex);

  if (blockMatch) {
    const block = blockMatch[1];
    const pairRegex = /([A-Za-z][A-Za-z\s]+?)\s+\$([\d,.]+)/g;
    let m;
    while ((m = pairRegex.exec(block)) !== null) {
      const name = m[1].trim();
      const amount = parseFloat(m[2].replace(",", ""));
      if (name && amount > 0) {
        members.push({ name, amount });
      }
    }
  }

  const totalMatches = [...page2.matchAll(/Total\s+\$([\d,.]+)/g)];
  if (totalMatches.length > 0) {
    total = parseFloat(totalMatches[totalMatches.length - 1][1].replace(",", ""));
  }

  if (members.length === 0) {
    throw new Error("Could not find per-person charges in Google Fi bill.");
  }

  return { billDate, total, members };
}

/**
 * Parse a T-Mobile bill from pre-extracted page texts.
 *
 * Page 2 contains a "THIS BILL SUMMARY" table with per-line rows.
 * Lines with "Included" under the Plans column split the Account charges.
 * Lines with an explicit dollar amount under Plans pay their own cost.
 * If no lines say "Included", all lines split the Account charges.
 */
function parseTMobileBill(pages) {
  const dateMatch = pages[0].match(/Bill\s+issue\s+date\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
  const billDate = dateMatch ? dateMatch[1] : "Unknown date";

  const page2 = pages[1] || "";

  // Extract grand total from "Totals ... $xxx.xx"
  const totalsMatch = page2.match(/Totals\s+([\s\S]*?)(?=Account)/);
  let total = 0;
  if (totalsMatch) {
    const amounts = [...totalsMatch[1].matchAll(/\$\s*([\d,.]+)/g)];
    if (amounts.length > 0) {
      total = parseFloat(amounts[amounts.length - 1][1].replace(",", ""));
    }
  }

  // Extract Account total (shared charges)
  const accountMatch = page2.match(/Account\s+([\s\S]*?)(?=\(\d{3}\))/);
  let accountTotal = 0;
  if (accountMatch) {
    const amounts = [...accountMatch[1].matchAll(/-?\$\s*([\d,.]+)/g)];
    if (amounts.length > 0) {
      accountTotal = parseFloat(amounts[amounts.length - 1][1].replace(",", ""));
    }
  }

  // Extract per-phone-number lines, detecting "Included" vs explicit Plans cost
  const phoneLines = [];
  const phoneRegex = /(\(\d{3}\)\s*\d{3}-\d{4})\s+Voice\s+([\s\S]*?)(?=\(\d{3}\)\s*\d{3}-\d{4}\s+Voice|DETAILED)/g;
  let m;
  while ((m = phoneRegex.exec(page2)) !== null) {
    const phone = m[1];
    const lineText = m[2];
    const included = /^\s*Included\b/.test(lineText);
    const amounts = [...lineText.matchAll(/-?\$\s*([\d,.]+)/g)];
    const lineTotal = amounts.length > 0
      ? parseFloat(amounts[amounts.length - 1][1].replace(",", ""))
      : 0;
    phoneLines.push({ phone, lineTotal, included });
  }

  if (phoneLines.length === 0) {
    throw new Error("Could not find per-line charges in T-Mobile bill.");
  }

  // Determine which lines split the Account charges
  const includedLines = phoneLines.filter(l => l.included);
  const splitLines = includedLines.length > 0 ? includedLines : phoneLines;
  const sharePerLine = accountTotal / splitLines.length;

  let splitIndex = 0;
  const members = phoneLines.map((line) => {
    let share = 0;
    if ((includedLines.length > 0 && line.included) || includedLines.length === 0) {
      if (splitIndex < splitLines.length - 1) {
        share = Math.floor(sharePerLine * 100) / 100;
      } else {
        const allocated = Math.floor(sharePerLine * 100) / 100 * (splitLines.length - 1);
        share = Math.round((accountTotal - allocated) * 100) / 100;
      }
      splitIndex++;
    }
    return {
      name: line.phone,
      amount: Math.round((share + line.lineTotal) * 100) / 100,
    };
  });

  return { billDate, total, members };
}
