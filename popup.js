import { parseGoogleFiBill } from "./parser.js";

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const billsSection = document.getElementById("bills-section");
const billsList = document.getElementById("bills-list");
const summarySection = document.getElementById("summary-section");
const summaryBody = document.getElementById("summary-body");
const summaryTable = document.getElementById("summary-table");
const grandTotalEl = document.getElementById("grand-total");
const loadingSection = document.getElementById("loading-section");
const errorSection = document.getElementById("error-section");
const errorMessage = document.getElementById("error-message");

/** @type {{id: number, fileName: string, billDate: string, total: number, members: {name: string, amount: number}[]}[]} */
let bills = [];
let nextId = 1;

// --- Drop zone events ---
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
  fileInput.value = "";
});

// --- File handling ---
async function handleFiles(files) {
  hideError();
  loadingSection.classList.remove("hidden");
  for (const file of files) {
    if (file.type !== "application/pdf") {
      showError(`"${file.name}" is not a PDF file.`);
      continue;
    }
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseGoogleFiBill(buffer);

      // Check for duplicate (same date + same total)
      const isDup = bills.some(
        (b) => b.billDate === parsed.billDate && b.total === parsed.total
      );
      if (isDup) {
        showError(`"${file.name}" appears to be a duplicate bill (${parsed.billDate}).`);
        continue;
      }

      bills.push({
        id: nextId++,
        fileName: file.name,
        billDate: parsed.billDate,
        total: parsed.total,
        members: parsed.members,
      });
    } catch (err) {
      showError(`Error parsing "${file.name}": ${err.message}`);
    }
  }
  loadingSection.classList.add("hidden");
  render();
}

// --- Remove a bill ---
function removeBill(id) {
  bills = bills.filter((b) => b.id !== id);
  render();
}

// --- Rendering ---
function render() {
  // Bills list
  if (bills.length === 0) {
    billsSection.classList.add("hidden");
    summarySection.classList.add("hidden");
    return;
  }

  billsSection.classList.remove("hidden");
  summarySection.classList.remove("hidden");

  // Render bills list
  billsList.innerHTML = "";
  for (const bill of bills) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="bill-info">
        <span class="bill-date">${bill.billDate}</span>
        <span>${bill.fileName}</span>
      </span>
      <span class="bill-info">
        <span class="bill-total">$${bill.total.toFixed(2)}</span>
        <button class="bill-remove" data-id="${bill.id}" title="Remove">&times;</button>
      </span>
    `;
    billsList.appendChild(li);
  }

  // Attach remove handlers
  billsList.querySelectorAll(".bill-remove").forEach((btn) => {
    btn.addEventListener("click", () => removeBill(Number(btn.dataset.id)));
  });

  // Aggregate per-person across all bills
  const aggregated = {};
  const billDates = [];
  for (const bill of bills) {
    billDates.push(bill.billDate);
    for (const member of bill.members) {
      const key = member.name.toLowerCase();
      if (!aggregated[key]) {
        aggregated[key] = { name: member.name, total: 0, perBill: {} };
      }
      aggregated[key].total += member.amount;
      aggregated[key].perBill[bill.billDate] = member.amount;
    }
  }

  // Build table header with per-bill columns
  const thead = summaryTable.querySelector("thead tr");
  // Reset: Person + per-bill columns + Total
  thead.innerHTML = "<th>Person</th>";
  for (const date of billDates) {
    thead.innerHTML += `<th>${date}</th>`;
  }
  thead.innerHTML += "<th>Total</th>";

  // Build body
  summaryBody.innerHTML = "";
  let grandTotal = 0;
  const people = Object.values(aggregated).sort((a, b) => b.total - a.total);

  for (const person of people) {
    const tr = document.createElement("tr");
    let cells = `<td>${person.name}</td>`;
    for (const date of billDates) {
      const amt = person.perBill[date];
      cells += `<td>${amt != null ? "$" + amt.toFixed(2) : "-"}</td>`;
    }
    cells += `<td><strong>$${person.total.toFixed(2)}</strong></td>`;
    tr.innerHTML = cells;
    summaryBody.appendChild(tr);
    grandTotal += person.total;
  }

  // Grand total footer
  const tfoot = summaryTable.querySelector("tfoot tr");
  tfoot.innerHTML = `<td><strong>Grand Total</strong></td>`;
  for (const date of billDates) {
    const billTotal = bills.find((b) => b.billDate === date)?.total || 0;
    tfoot.innerHTML += `<td><strong>$${billTotal.toFixed(2)}</strong></td>`;
  }
  tfoot.innerHTML += `<td><strong>$${grandTotal.toFixed(2)}</strong></td>`;
}

// --- Error display ---
function showError(msg) {
  errorSection.classList.remove("hidden");
  errorMessage.textContent = msg;
}

function hideError() {
  errorSection.classList.add("hidden");
  errorMessage.textContent = "";
}
