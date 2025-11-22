import { describe, it, expect } from "vitest";

// simnet is provided globally by @stacks/clarinet-sdk vitest environment

describe("secure-file-transfer", () => {
  it("creates a new encrypted transfer and reads it back", () => {
    const accounts = simnet.getAccounts();
    const sender = accounts.get("wallet_1")!;
    const recipient = accounts.get("wallet_2")!;

    const fileHash = Uint8Array.from(Array(32).fill(1));
    const storageUri = "https://example.com/ciphertext.bin";
    const scheme = "aes-256-gcm";

    const result = simnet.callPublicFn(
      "secure-file-transfer",
      "create-transfer",
      [
        simnet.principal(recipient.address),
        simnet.buffer(fileHash),
        simnet.utf8(storageUri),
        simnet.ascii(scheme),
        simnet.some(simnet.uint(100n)),
      ],
      sender.address
    );

    expect(result.result).toEqual(simnet.ok(simnet.uint(1n)));

    const getResult = simnet.callReadOnlyFn(
      "secure-file-transfer",
      "get-transfer",
      [simnet.uint(1n)],
      sender.address
    );

    expect(getResult.result).toEqual(
      simnet.ok(
        simnet.tuple({
          sender: simnet.principal(sender.address),
          recipient: simnet.principal(recipient.address),
          "file-hash": simnet.buffer(fileHash),
          "storage-uri": simnet.utf8(storageUri),
          "encryption-scheme": simnet.ascii(scheme),
          status: simnet.ascii("open"),
          "created-at": simnet.uint(0n),
          "expires-at": simnet.some(simnet.uint(100n)),
        })
      )
    );
  });

  it("only sender can revoke an open transfer", () => {
    const accounts = simnet.getAccounts();
    const sender = accounts.get("wallet_1")!;
    const recipient = accounts.get("wallet_2")!;
    const attacker = accounts.get("wallet_3")!;

    const fileHash = Uint8Array.from(Array(32).fill(2));

    const create = simnet.callPublicFn(
      "secure-file-transfer",
      "create-transfer",
      [
        simnet.principal(recipient.address),
        simnet.buffer(fileHash),
        simnet.utf8("https://example.com/file2"),
        simnet.ascii("aes-256-gcm"),
        simnet.none(),
      ],
      sender.address
    );

    expect(create.result).toEqual(simnet.ok(simnet.uint(2n)));

    const fail = simnet.callPublicFn(
      "secure-file-transfer",
      "revoke-transfer",
      [simnet.uint(2n)],
      attacker.address
    );

    expect(fail.result).toEqual(simnet.err(simnet.uint(101n)));

    const success = simnet.callPublicFn(
      "secure-file-transfer",
      "revoke-transfer",
      [simnet.uint(2n)],
      sender.address
    );

    expect(success.result).toEqual(simnet.ok(simnet.bool(true)));
  });

  it("recipient can mark as received but not revoke", () => {
    const accounts = simnet.getAccounts();
    const sender = accounts.get("wallet_1")!;
    const recipient = accounts.get("wallet_2")!;

    const fileHash = Uint8Array.from(Array(32).fill(3));

    const create = simnet.callPublicFn(
      "secure-file-transfer",
      "create-transfer",
      [
        simnet.principal(recipient.address),
        simnet.buffer(fileHash),
        simnet.utf8("https://example.com/file3"),
        simnet.ascii("aes-256-gcm"),
        simnet.none(),
      ],
      sender.address
    );

    expect(create.result).toEqual(simnet.ok(simnet.uint(3n)));

    const markReceived = simnet.callPublicFn(
      "secure-file-transfer",
      "mark-received",
      [simnet.uint(3n)],
      recipient.address
    );

    expect(markReceived.result).toEqual(simnet.ok(simnet.bool(true)));

    const revoke = simnet.callPublicFn(
      "secure-file-transfer",
      "revoke-transfer",
      [simnet.uint(3n)],
      recipient.address
    );

    expect(revoke.result).toEqual(simnet.err(simnet.uint(101n)));
  });
});
