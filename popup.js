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

/** @type {Object<string, {method: string, identifier: string}>} */
let paymentMappings = {};

/** @type {Set<string>} - lowercase name keys currently in edit mode */
const editingRows = new Set();

// --- Payment mappings persistence ---
async function loadMappings() {
  const result = await chrome.storage.local.get("paymentMappings");
  paymentMappings = result.paymentMappings || {};
}

async function saveMappings() {
  await chrome.storage.local.set({ paymentMappings });
}

function buildPaymentUrl(method, identifier, amount, billDates) {
  const note = `Google Fi (${billDates.join(", ")})`;
  if (method === "venmo") {
    return `https://venmo.com/${encodeURIComponent(identifier)}?txn=charge&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`;
  }
  // paypal
  return `https://paypal.me/${encodeURIComponent(identifier)}/${amount.toFixed(2)}`;
}

// Load mappings on init
await loadMappings();

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

  // Build table header
  const thead = summaryTable.querySelector("thead tr");
  thead.innerHTML = "<th>Person</th>";
  for (const date of billDates) {
    thead.innerHTML += `<th>${date}</th>`;
  }
  thead.innerHTML += "<th>Total</th><th>Payment</th><th></th>";

  // Build body
  summaryBody.innerHTML = "";
  let grandTotal = 0;
  const people = Object.values(aggregated).sort((a, b) => b.total - a.total);

  for (const person of people) {
    const key = person.name.toLowerCase();
    const mapping = paymentMappings[key];
    const isEditing = editingRows.has(key);
    const tr = document.createElement("tr");

    let cells = `<td>${person.name}</td>`;
    for (const date of billDates) {
      const amt = person.perBill[date];
      cells += `<td>${amt != null ? "$" + amt.toFixed(2) : "-"}</td>`;
    }
    cells += `<td><strong>$${person.total.toFixed(2)}</strong></td>`;

    // Payment cell
    if (isEditing || !mapping) {
      const method = mapping?.method || "venmo";
      const identifier = mapping?.identifier || "";
      const placeholder = method === "venmo" ? "username, phone, or email" : "PayPal.me username";
      cells += `<td class="payment-cell">
        <select class="payment-select" data-key="${key}">
          <option value="venmo"${method === "venmo" ? " selected" : ""}>Venmo</option>
          <option value="paypal"${method === "paypal" ? " selected" : ""}>PayPal</option>
        </select>
        <input class="payment-input" type="text" data-key="${key}"
          value="${identifier}" placeholder="${placeholder}">
        <button class="save-btn" data-key="${key}">Save</button>
      </td>`;
    } else {
      const label = mapping.method === "venmo" ? "Venmo" : "PayPal";
      cells += `<td class="payment-cell">
        <span class="payment-display">${label}: ${mapping.identifier}</span>
        <button class="edit-btn" data-key="${key}">Edit</button>
      </td>`;
    }

    // Request button
    const hasMapping = mapping && mapping.identifier;
    cells += `<td>
      <button class="request-btn" data-key="${key}" ${hasMapping ? "" : "disabled"}>
        Request $${person.total.toFixed(2)}
      </button>
    </td>`;

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
  tfoot.innerHTML += `<td><strong>$${grandTotal.toFixed(2)}</strong></td><td></td><td></td>`;

  // --- Attach event handlers ---

  // Update placeholder when method select changes
  summaryBody.querySelectorAll(".payment-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const input = summaryBody.querySelector(`.payment-input[data-key="${sel.dataset.key}"]`);
      if (input) {
        input.placeholder = sel.value === "venmo" ? "username, phone, or email" : "PayPal.me username";
      }
    });
  });

  // Save button
  summaryBody.querySelectorAll(".save-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key;
      const sel = summaryBody.querySelector(`.payment-select[data-key="${key}"]`);
      const input = summaryBody.querySelector(`.payment-input[data-key="${key}"]`);
      const method = sel.value;
      let identifier = input.value.trim();
      if (!identifier) return;

      // Sanitize: strip leading @ (Venmo URLs don't use it)
      identifier = identifier.replace(/^@+/, "");

      // Validate based on method
      if (method === "venmo") {
        // Venmo usernames: 5-30 chars, alphanumeric/hyphens/underscores
        // Also allow phone (digits, dashes, +) or email
        const isUsername = /^[a-zA-Z0-9_-]{1,30}$/.test(identifier);
        const isPhone = /^\+?[\d-]{7,15}$/.test(identifier);
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
        if (!isUsername && !isPhone && !isEmail) {
          input.classList.add("input-error");
          showError("Enter a valid Venmo username, phone number, or email.");
          return;
        }
      } else {
        // PayPal.me usernames: alphanumeric only
        if (!/^[a-zA-Z0-9]{1,20}$/.test(identifier)) {
          input.classList.add("input-error");
          showError("Enter a valid PayPal.me username (letters and numbers only).");
          return;
        }
      }

      input.classList.remove("input-error");
      hideError();
      paymentMappings[key] = { method, identifier };
      await saveMappings();
      editingRows.delete(key);
      render();
    });
  });

  // Edit button
  summaryBody.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingRows.add(btn.dataset.key);
      render();
    });
  });

  // Request button
  summaryBody.querySelectorAll(".request-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const mapping = paymentMappings[key];
      if (!mapping) return;
      const person = people.find((p) => p.name.toLowerCase() === key);
      if (!person) return;
      const url = buildPaymentUrl(mapping.method, mapping.identifier, person.total, billDates);
      chrome.tabs.create({ url });
    });
  });
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
