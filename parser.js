import * as pdfjsLib from "./lib/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdf.worker.min.mjs";

/**
 * Parses a Google Fi PDF bill and extracts per-person charges.
 *
 * The key data lives on page 2 in this pattern:
 *   Total   $187.37
 *   Lance Lee  $51.58
 *   chen jie  $44.54
 *   ...
 *   Total  $187.37
 *
 * @param {ArrayBuffer} pdfBuffer
 * @returns {Promise<{billDate: string, total: number, members: {name: string, amount: number}[]}>}
 */
export async function parseGoogleFiBill(pdfBuffer) {
  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;

  // Extract text from all pages (we mainly need page 1 for date, page 2 for per-person)
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(" ");
    pages.push(text);
  }

  // Extract bill date from page 1: "Here's your monthly statement for Mar 22, 2026"
  const dateMatch = pages[0].match(/statement\s+for\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
  const billDate = dateMatch ? dateMatch[1] : "Unknown date";

  // Extract per-person charges from page 2
  // Pattern: "Total $xxx.xx  Name1 $xx.xx  Name2 $xx.xx ... Total $xxx.xx"
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

  // Extract total: last "Total $xxx.xx" on page 2
  const totalMatches = [...page2.matchAll(/Total\s+\$([\d,.]+)/g)];
  if (totalMatches.length > 0) {
    total = parseFloat(totalMatches[totalMatches.length - 1][1].replace(",", ""));
  }

  if (members.length === 0) {
    throw new Error("Could not find per-person charges. Is this a Google Fi bill?");
  }

  return { billDate, total, members };
}
