
import QRCode from 'qrcode';

const $ = (id) => document.getElementById(id);

const STORAGE = {
  shop: 'splitpay.shopName.v1',
  accounts: 'splitpay.upiAccounts.v1',
  history: 'splitpay.history.v1'
};

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(Number(n) || 0);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

let state = {
  shopName: read(STORAGE.shop, 'Splitpay'),
  accounts: read(STORAGE.accounts, []),
  history: read(STORAGE.history, [])
};

let addedAmounts = [];
let editingId = null;
let activeTransaction = null;
let selectedHistoryId = null;
let toastTimer;

function persist() {
  try {
    localStorage.setItem(STORAGE.shop, JSON.stringify(state.shopName));
    localStorage.setItem(STORAGE.accounts, JSON.stringify(state.accounts));
    localStorage.setItem(STORAGE.history, JSON.stringify(state.history));
  } catch {
    toast('Could not save data. Check device storage.');
  }
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('hidden', el.id !== `tab-${name}`);
  });
  $('navMenu').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function total() {
  return Math.max(0, Number($('totalAmount').value) || 0);
}

function cash() {
  return Math.max(0, Number($('cashPaid').value) || 0);
}

function remaining() {
  return Math.max(0, total() - cash());
}

function calculate() {
  const r = remaining();
  $('remainingAmount').textContent = money(r);
  $('cashNotice').classList.toggle(
    'hidden',
    !(total() > 0 && r === 0)
  );
}

function renderAmounts() {
  const wrap = $('amountChips');
  wrap.replaceChildren();

  addedAmounts.forEach((amount, index) => {
    const button = document.createElement('button');
    button.className = 'amount-chip';
    button.textContent = `${money(amount)} ×`;
    button.title = 'Remove amount';

    button.addEventListener('click', () => {
      addedAmounts.splice(index, 1);
      $('totalAmount').value = addedAmounts
        .reduce((a, b) => a + b, 0)
        .toFixed(2);
      renderAmounts();
      calculate();
    });

    wrap.append(button);
  });
}

function addAmount() {
  const value = Number($('quickAmount').value);

  if (!Number.isFinite(value) || value <= 0) {
    return toast('Enter an amount greater than zero.');
  }

  addedAmounts.push(value);
  $('totalAmount').value = (total() + value).toFixed(2);
  $('quickAmount').value = '';

  renderAmounts();
  calculate();
}

function renderAccounts() {
  const list = $('upiList');
  list.replaceChildren();

  if (!state.accounts.length) {
    list.innerHTML =
      '<div class="empty">No UPI accounts yet. Add one below.</div>';
  }

  state.accounts.forEach(account => {
    const row = document.createElement('div');
    row.className = 'list-item';

    row.innerHTML = `
      <div class="main">
        <strong>${esc(account.name)}</strong>
        <small>${esc(account.upi)}${
          account.bank ? ' · ' + esc(account.bank) : ''
        }</small>
      </div>
      <div class="list-actions">
        <button class="mini-button" data-edit="${esc(account.id)}">Edit</button>
        <button class="mini-button delete" data-delete="${esc(account.id)}">Delete</button>
      </div>
    `;

    list.append(row);
  });

  list.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => editAccount(button.dataset.edit));
  });

  list.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => deleteAccount(button.dataset.delete));
  });

  const select = $('accountSelect');
  const old = select.value;
  select.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = state.accounts.length
    ? 'Choose UPI account'
    : 'Add a UPI account in Settings';

  select.append(placeholder);

  state.accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = `${account.name} · ${account.upi}`;
    select.append(option);
  });

  if (state.accounts.some(account => account.id === old)) {
    select.value = old;
  }
}

function resetAccountForm() {
  editingId = null;
  $('accountFormTitle').textContent = 'Add account';
  $('saveUpi').textContent = 'Save account';
  $('cancelEdit').classList.add('hidden');
  $('upiName').value = '';
  $('upiId').value = '';
  $('bankName').value = '';
}

function editAccount(id) {
  const account = state.accounts.find(item => item.id === id);
  if (!account) return;

  editingId = id;
  $('accountFormTitle').textContent = 'Edit account';
  $('saveUpi').textContent = 'Update account';
  $('cancelEdit').classList.remove('hidden');
  $('upiName').value = account.name;
  $('upiId').value = account.upi;
  $('bankName').value = account.bank || '';

  $('upiName').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function saveAccount() {
  const name = $('upiName').value.trim();
  const upi = $('upiId').value.trim();
  const bank = $('bankName').value.trim();

  if (!name) return toast('Enter an account nickname.');

  if (!/^[^\s@]+@[^\s@]+$/.test(upi)) {
    return toast('Enter a valid-looking UPI ID, such as name@bank.');
  }

  const duplicate = state.accounts.find(account =>
    account.upi.toLowerCase() === upi.toLowerCase() &&
    account.id !== editingId
  );

  if (duplicate) return toast('That UPI ID is already saved.');

  if (editingId) {
    const account = state.accounts.find(item => item.id === editingId);
    if (account) Object.assign(account, { name, upi, bank });
  } else {
    state.accounts.push({
      id: crypto.randomUUID?.() || String(Date.now()),
      name,
      upi,
      bank
    });
  }

  persist();
  renderAccounts();
  resetAccountForm();
  toast('UPI account saved on this device.');
}

function deleteAccount(id) {
  const account = state.accounts.find(item => item.id === id);

  if (!account || !confirm(`Delete ${account.name} (${account.upi})?`)) {
    return;
  }

  state.accounts = state.accounts.filter(item => item.id !== id);
  persist();
  renderAccounts();
  toast('Account deleted.');
}

function renderHistory() {
  const list = $('historyList');
  list.replaceChildren();

  if (!state.history.length) {
    list.innerHTML = '<div class="empty">No saved transactions yet.</div>';
    return;
  }

  [...state.history]
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(transaction => {
      const row = document.createElement('button');
      row.className = 'list-item';
      row.style.textAlign = 'left';
      row.style.width = '100%';

      row.innerHTML = `
        <div class="main">
          <strong>${esc(transaction.shopName || state.shopName)} · ${money(transaction.total)}</strong>
          <small>
            ${esc(new Date(transaction.createdAt).toLocaleString())}
            · Cash ${money(transaction.cash)}
            · UPI ${money(transaction.online)}
          </small>
        </div>
        <span aria-hidden="true">›</span>
      `;

      row.addEventListener('click', () => openDetails(transaction.id));
      list.append(row);
    });
}

function makeUpiUri(transaction) {
  const params = new URLSearchParams({
    pa: transaction.upi,
    pn: transaction.shopName || 'Splitpay',
    am: Number(transaction.online).toFixed(2),
    cu: 'INR',
    tn: 'Splitpay payment'
  });

  return `upi://pay?${params.toString()}`;
}

function makeTransaction(account) {
  return {
    id: crypto.randomUUID?.() || String(Date.now()),
    createdAt: Date.now(),
    shopName: state.shopName,
    total: total(),
    cash: Math.min(cash(), total()),
    online: remaining(),
    accountName: account?.name || '',
    upi: account?.upi || '',
    bank: account?.bank || ''
  };
}

function showQrDialog(cashOnly = false) {
  $('qrSummary').innerHTML = `
    <span class="eyebrow">${cashOnly ? 'CASH PAID IN FULL' : 'AMOUNT TO PAY'}</span>
    <strong>${money(activeTransaction.online)}</strong>
  `;

  $('qrCanvas').replaceChildren();
  $('qrAccountLabel').textContent = cashOnly
    ? 'No QR required for a cash-only payment.'
    : '';

  $('downloadQr').classList.add('hidden');
  $('saveTransaction').textContent = 'Save record';
  $('qrDialog').showModal();
}

async function generateQr() {
  const amount = total();
  const online = remaining();

  if (amount <= 0) return toast('Enter a total amount first.');
  if (cash() > amount) return toast('Cash paid cannot exceed total amount.');

  if (online <= 0) {
    activeTransaction = makeTransaction(null);
    showQrDialog(true);
    return;
  }

  const account = state.accounts.find(
    item => item.id === $('accountSelect').value
  );

  if (!account) return toast('Choose a UPI account in the payment form.');

  activeTransaction = makeTransaction(account);

  try {
    const canvas = document.createElement('canvas');

    await QRCode.toCanvas(
      canvas,
      makeUpiUri(activeTransaction),
      {
        width: 240,
        margin: 2,
        errorCorrectionLevel: 'M'
      }
    );

    $('qrCanvas').replaceChildren(canvas);
    $('qrSummary').innerHTML = `
      <span class="eyebrow">AMOUNT TO PAY</span>
      <strong>${money(online)}</strong>
    `;
    $('qrAccountLabel').textContent = `${account.name} · ${account.upi}`;
    $('downloadQr').classList.remove('hidden');
    $('saveTransaction').textContent = 'Save record';
    $('qrDialog').showModal();
  } catch (error) {
    console.error(error);
    toast('Could not generate QR code.');
  }
}

function saveTransaction() {
  if (!activeTransaction) return;

  if (!state.history.some(item => item.id === activeTransaction.id)) {
    state.history.push(activeTransaction);
    persist();
    renderHistory();
    toast('Transaction record saved.');
  } else {
    toast('This transaction is already saved.');
  }

  $('qrDialog').close();
  activeTransaction = null;
}

function openDetails(id) {
  const transaction = state.history.find(item => item.id === id);
  if (!transaction) return;

  selectedHistoryId = id;

  $('detailContent').innerHTML = `
    <div class="stack-list">
      <div class="list-item"><div class="main"><small>Shop</small><strong>${esc(transaction.shopName)}</strong></div></div>
      <div class="list-item"><div class="main"><small>Date</small><strong>${esc(new Date(transaction.createdAt).toLocaleString())}</strong></div></div>
      <div class="list-item"><div class="main"><small>Total</small><strong>${money(transaction.total)}</strong></div></div>
      <div class="list-item"><div class="main"><small>Cash paid</small><strong>${money(transaction.cash)}</strong></div></div>
      <div class="list-item"><div class="main"><small>Online / UPI</small><strong>${money(transaction.online)}</strong></div></div>
      <div class="list-item"><div class="main"><small>UPI account</small><strong>${esc(transaction.upi || 'Not applicable')}</strong></div></div>
    </div>
  `;

  $('detailDialog').showModal();
}

function deleteHistoryItem() {
  if (!selectedHistoryId) return;

  if (!confirm('Delete this saved transaction record?')) return;

  state.history = state.history.filter(
    item => item.id !== selectedHistoryId
  );

  persist();
  renderHistory();
  $('detailDialog').close();
  selectedHistoryId = null;
  toast('Transaction record deleted.');
}

function downloadQr() {
  const canvas = $('qrCanvas').querySelector('canvas');

  if (!canvas) return toast('There is no QR image to save.');

  const link = document.createElement('a');
  link.download = `splitpay-${activeTransaction?.id || 'payment'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

$('menuButton').addEventListener('click', () => {
  $('navMenu').classList.toggle('hidden');
});

document.querySelectorAll('[data-tab]').forEach(button => {
  button.addEventListener('click', () => showTab(button.dataset.tab));
});

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => $(button.dataset.close).close());
});

$('addAmount').addEventListener('click', addAmount);

$('quickAmount').addEventListener('keydown', event => {
  if (event.key === 'Enter') addAmount();
});

$('totalAmount').addEventListener('input', calculate);
$('cashPaid').addEventListener('input', calculate);
$('generateQr').addEventListener('click', generateQr);

$('saveProfile').addEventListener('click', () => {
  const name = $('shopNameInput').value.trim();

  if (!name) return toast('Enter a shop name.');

  state.shopName = name;
  persist();
  $('navShopName').textContent = name;
  toast('Shop profile saved.');
});

$('saveUpi').addEventListener('click', saveAccount);
$('cancelEdit').addEventListener('click', resetAccountForm);
$('saveTransaction').addEventListener('click', saveTransaction);
$('downloadQr').addEventListener('click', downloadQr);
$('deleteTransaction').addEventListener('click', deleteHistoryItem);

$('clearHistory').addEventListener('click', () => {
  if (!state.history.length) return toast('History is already empty.');

  if (!confirm('Delete all transaction history from this device?')) return;

  state.history = [];
  persist();
  renderHistory();
  toast('History cleared.');
});

$('navShopName').textContent = state.shopName;
$('shopNameInput').value = state.shopName;

renderAccounts();
renderHistory();
calculate();
