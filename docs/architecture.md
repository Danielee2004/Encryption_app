# Encryption App - Secure File Transfer on Stacks
The Encryption App is a Clarinet (Clarity) project that helps users transfer encrypted files between devices while using the blockchain to coordinate access and verify integrity.

The core idea is:
* Files are encrypted **off-chain** (e.g. in the browser or a backend) using a symmetric key.
* The encrypted file (ciphertext) is stored off-chain (IPFS, cloud storage, or your own server).
* The Clarity contract stores **only metadata**: who is allowed to receive the file, the hash of the encrypted file, where it is stored, and its lifecycle (open / revoked / received).

Because the contract never sees the plaintext file or raw encryption keys, you keep confidentiality off-chain while still getting an auditable, tamper-resistant log of transfers.

## Roles and threat model
* **Sender**: a principal that creates an encrypted file transfer for a specific recipient.
* **Recipient**: a principal designated to receive the file.
* **Observers**: anyone who can read the blockchain and see that a transfer exists, but **cannot** decrypt the ciphertext without the off-chain key.

The contract assumes:
* The sender encrypts the file before uploading it.
* The sender delivers the decryption key to the recipient over a secure channel (for example: in-person, secure messaging, or end-to-end encrypted chat).
* The recipient downloads the ciphertext from the storage URI and verifies its integrity using the on-chain hash before decryption.

Blockchain transparency means that transaction senders and contract calls are public, but sensitive material (plaintext and keys) stay off-chain.

## Contract architecture
The main contract lives in `contracts/secure-file-transfer.clar`.

### State
* `var next-transfer-id` – counter to assign monotonically increasing transfer IDs (u1, u2, ...).
* `map transfers` – key: `{ id: uint }`, value:
  * `sender: principal` – who initiated the transfer.
  * `recipient: principal` – who is allowed to receive it.
  * `file-hash: (buff 32)` – hash of the encrypted file (e.g. SHA-256 of ciphertext).
  * `storage-uri: (string-utf8 256)` – where the encrypted file is stored.
  * `encryption-scheme: (string-ascii 32)` – description like `"aes-256-gcm"`.
  * `status: (string-ascii 16)` – one of `"open"`, `"revoked"`, `"received"`.
  * `created-at: uint` – block height when the transfer was created.
  * `expires-at: (optional uint)` – optional expiration block height.

### Errors
* `err u100` – transfer not found.
* `err u101` – unauthorized (wrong sender/recipient or invalid status).

### Public functions
* `create-transfer(recipient, file-hash, storage-uri, encryption-scheme, expires-at)`
  * Sender calls this to register an encrypted file transfer to a specific `recipient`.
  * Fails if `recipient == tx-sender` (no self-transfers in this design).
  * Stores all metadata, sets `status` to `"open"`, increments `next-transfer-id`, and returns the new ID.

* `revoke-transfer(id)`
  * Sender-only action.
  * Can only be called while `status == "open"`.
  * Sets `status` to `"revoked"`, preventing further use.

* `mark-received(id)`
  * Recipient-only action.
  * Can only be called while `status == "open"`.
  * Sets `status` to `"received"`, signaling successful delivery.

* `update-storage-uri(id, new-uri)`
  * Sender-only while the transfer is `"open"`.
  * Lets the sender move the ciphertext to a new location if needed without changing its hash.

* `extend-expiry(id, new-expires-at)`
  * Sender-only.
  * Updates (or clears) the optional expiration height.

### Read-only functions
* `get-transfer(id)`
  * Returns the full transfer metadata or `err u100` if the ID does not exist.

## Example flows
### Sender creates a transfer
1. Sender encrypts the file off-chain with a symmetric key.
2. Sender uploads the ciphertext to storage (e.g. `https://storage.example/cipher.bin`).
3. Sender computes the ciphertext hash (e.g. SHA-256) and converts it to a 32-byte buffer.
4. Sender calls `create-transfer` with:
   * recipient principal
   * `file-hash`
   * `storage-uri`
   * `encryption-scheme` (for example `"aes-256-gcm"`)
   * optional `expires-at` block height
5. Contract stores the transfer as `"open"` and returns an ID.
6. Sender communicates the decryption key to the recipient out-of-band.

### Recipient verifies and receives
1. Recipient looks up the transfer ID on-chain using `get-transfer`.
2. Recipient downloads the ciphertext from `storage-uri`.
3. Recipient hashes the downloaded ciphertext and checks it matches `file-hash`.
4. If the hash matches and the status is still `"open"`, recipient decrypts the file using the key they received off-chain.
5. Recipient calls `mark-received(id)`; the contract marks the transfer `"received"`.

### Revocation and URI updates
* If the sender believes the key was leaked or stored at an unsafe URI, they can:
  * call `revoke-transfer(id)` to invalidate it entirely, or
  * move the ciphertext to a new storage location and then call `update-storage-uri(id, new-uri)`.

## UI overview
The hand-written UI lives under `ui/`:
* `ui/index.html` – simple HTML with:
  * a form to submit recipient principal, storage URI, encryption scheme, and ciphertext hash.
  * controls to inspect and manage an existing transfer by ID.
* `ui/app.js` – minimal JavaScript that:
  * parses the hex ciphertext hash into bytes client-side.
  * simulates contract calls via `mockCallContract` (so it runs without a wallet).
  * documents where to integrate `@stacks/transactions` and `@stacks/connect` for real on-chain interaction.

This UI focuses on demonstrating the user journey and data model rather than providing production styling.

## Tests
Tests live in `tests/secure-file-transfer.test.ts` and use Vitest with the Clarinet JS SDK `simnet` environment to:
* create a transfer and read it back using `get-transfer`.
* verify that only the sender can revoke an open transfer.
* verify that only the recipient can mark a transfer as received, and that the recipient cannot revoke.

You can run the tests with:
```bash
npm install
npm test
```
(assuming you have Node.js and `@stacks/clarinet-sdk` available).

## Limitations and future work
* **No on-chain encryption** – Clarity does not encrypt data; all encryption is off-chain. The chain only tracks metadata and integrity.
* **Public metadata** – principals, URIs, and hashes are public on-chain. If you need more privacy, you could:
  * store opaque identifiers instead of real URIs.
  * use a private storage layer or access-controlled gateway.
  * integrate with off-chain relays or mixers.
* **Key management** – how keys are generated, rotated, and shared is entirely up to the application.

Possible extensions:
* Adding multi-recipient transfers (shared encrypted key material for multiple principals).
* Integrating zero-knowledge proofs that a ciphertext was formed correctly.
* Adding richer lifecycle states (e.g. expired, archived) and audit events.
* Building a production-grade UI with a connected wallet and automatic ciphertext hashing in the browser.
