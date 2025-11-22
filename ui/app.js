// NOTE: This is a minimal, hand-written UI that shows how you would
// wire a wallet + @stacks/transactions/@stacks/connect to the
// `secure-file-transfer` contract. The actual wallet/network config
// must be filled in by you.

const CONTRACT_ADDRESS = "STXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // TODO: fill after deploy
const CONTRACT_NAME = "secure-file-transfer";

async function mockCallContract(fn, args) {
  // This is a placeholder so the UI works without a wallet.
  // In a real app, replace with code using @stacks/transactions
  // and @stacks/connect to broadcast transactions.
  return { ok: true, function: fn, args };
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, "");
  if (clean.length !== 64) throw new Error("file-hash must be 32 bytes (64 hex chars)");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function onCreateTransfer() {
  const recipient = document.getElementById("recipient").value.trim();
  const storageUri = document.getElementById("storage-uri").value.trim();
  const scheme = document.getElementById("scheme").value.trim();
  const fileHashHex = document.getElementById("file-hash").value.trim();
  const output = document.getElementById("create-result");

  try {
    const fileHash = hexToBytes(fileHashHex);
    const result = await mockCallContract("create-transfer", {
      recipient,
      storageUri,
      scheme,
      fileHash: Array.from(fileHash),
    });
    output.textContent = JSON.stringify(result, null, 2);
  } catch (e) {
    output.textContent = String(e);
  }
}

async function onGetTransfer() {
  const id = Number(document.getElementById("transfer-id").value);
  const output = document.getElementById("transfer-view");
  // In a real app, you would use a read-only call here via
  // @stacks/transactions or @stacks/blockchain-api-client.
  output.textContent = `Would call read-only get-transfer(${id}) on ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;
}

async function onRevoke() {
  const id = Number(document.getElementById("transfer-id").value);
  const output = document.getElementById("transfer-view");
  const result = await mockCallContract("revoke-transfer", { id });
  output.textContent = JSON.stringify(result, null, 2);
}

async function onMarkReceived() {
  const id = Number(document.getElementById("transfer-id").value);
  const output = document.getElementById("transfer-view");
  const result = await mockCallContract("mark-received", { id });
  output.textContent = JSON.stringify(result, null, 2);
}

document.getElementById("create-transfer").addEventListener("click", onCreateTransfer);
document.getElementById("get-transfer").addEventListener("click", onGetTransfer);
document.getElementById("revoke-transfer").addEventListener("click", onRevoke);
document.getElementById("mark-received").addEventListener("click", onMarkReceived);
