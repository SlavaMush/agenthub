import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  verifyAuthorization,
  authorizationDomain,
  paymentRequired,
} from "./x402.js";
import { RECEIVE_WITH_AUTHORIZATION_TYPES, usdcToAtomic } from "../packages/config/index.js";

test("x402 requirements advertise EIP-3009 exact USDC on Base", () => {
  const body = paymentRequired("/api/paid/quote");
  assert.equal(body.x402Version, 1);
  assert.equal(body.accepts[0].scheme, "exact");
  assert.equal(body.accepts[0].network, "base-sepolia");
  assert.equal(body.accepts[0].extra.name, "USD Coin");
  assert.equal(body.accepts[0].extra.version, "2");
  assert.equal(body.accepts[0].maxAmountRequired, usdcToAtomic(1).toString());
});

test("verifies a real ReceiveWithAuthorization signature and rejects a bad one", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const nonce = `0x${"11".repeat(32)}`;
  const message = {
    from: account.address,
    to: "0x0000000000000000000000000000000000000001",
    value: usdcToAtomic(1),
    validAfter: 0n,
    validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
    nonce,
  };
  const signature = await account.signTypedData({
    domain: authorizationDomain(),
    types: RECEIVE_WITH_AUTHORIZATION_TYPES,
    primaryType: "ReceiveWithAuthorization",
    message,
  });

  const verified = await verifyAuthorization({ ...message, signature });
  assert.equal(verified.from, account.address.toLowerCase());

  await assert.rejects(
    () => verifyAuthorization({ ...message, value: usdcToAtomic(2), signature }),
    /invalid EIP-3009 signature/,
  );
});
