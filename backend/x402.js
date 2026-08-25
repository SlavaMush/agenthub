import express from "express";
import {
  createPublicClient,
  createWalletClient,
  http,
  verifyTypedData,
  parseSignature,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import {
  getChain,
  usdcAbi,
  RECEIVE_WITH_AUTHORIZATION_TYPES,
  X402,
  usdcToAtomic,
} from "../packages/config/index.js";

const chainId = Number(process.env.CHAIN_ID || 84532);
const chain = getChain(chainId);
const viemChain = chainId === 8453 ? base : baseSepolia;
const rpcUrl = process.env.RPC_URL || chain.rpcUrls[0];
const payTo = (process.env.X402_PAY_TO || process.env.TREASURY_ADDRESS || "").toLowerCase();
const priceAtomic = usdcToAtomic(process.env.X402_PRICE_USDC || "1");

const publicClient = createPublicClient({
  chain: viemChain,
  transport: http(rpcUrl),
});

function facilitatorAccount() {
  const key = process.env.X402_FACILITATOR_KEY;
  if (!key) return null;
  return privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
}

export function paymentRequired(resource = "/api/paid") {
  return {
    x402Version: 1,
    error: "Payment Required",
    accepts: [
      {
        scheme: X402.scheme,
        network: chain.x402Network,
        maxAmountRequired: priceAtomic.toString(),
        resource,
        description: "AgentHub API access",
        payTo: payTo || null,
        asset: chain.usdc,
        extra: { name: chain.usdcName, version: chain.usdcVersion },
      },
    ],
  };
}

export function authorizationDomain() {
  return {
    name: chain.usdcName,
    version: chain.usdcVersion,
    chainId: chain.chainId,
    verifyingContract: chain.usdc,
  };
}

export async function verifyAuthorization(auth) {
  const from = String(auth.from || "").toLowerCase();
  const to = String(auth.to || "").toLowerCase();
  const value = BigInt(auth.value);
  const validAfter = BigInt(auth.validAfter ?? 0);
  const validBefore = BigInt(auth.validBefore);
  const nonce = auth.nonce;
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (!from || !to || !nonce) throw new Error("authorization missing fields");
  if (payTo && to !== payTo) throw new Error("authorization to does not match payTo");
  if (value < priceAtomic) throw new Error("authorization value below price");
  if (now < validAfter || now > validBefore) throw new Error("authorization expired");

  const valid = await verifyTypedData({
    address: from,
    domain: authorizationDomain(),
    types: RECEIVE_WITH_AUTHORIZATION_TYPES,
    primaryType: "ReceiveWithAuthorization",
    message: { from, to, value, validAfter, validBefore, nonce },
    signature: auth.signature,
  });
  if (!valid) throw new Error("invalid EIP-3009 signature");
  return { from, to, value, validAfter, validBefore, nonce, signature: auth.signature };
}

export async function submitAuthorization(auth) {
  const account = facilitatorAccount();
  if (!account) {
    return { submitted: false, txHash: null };
  }
  const sig = parseSignature(auth.signature);
  const wallet = createWalletClient({
    account,
    chain: viemChain,
    transport: http(rpcUrl),
  });
  const txHash = await wallet.writeContract({
    address: chain.usdc,
    abi: usdcAbi,
    functionName: "receiveWithAuthorization",
    args: [auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce, Number(sig.v), sig.r, sig.s],
  });
  return { submitted: true, txHash };
}

function readPayment(req) {
  const header = req.headers["x-payment"] || req.headers["X-PAYMENT"];
  if (header) {
    return typeof header === "string" && header.trim().startsWith("{") ? JSON.parse(header) : JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  }
  return req.body?.payment || null;
}

export async function x402Middleware(req, res, next) {
  const payment = readPayment(req);
  if (!payment) {
    return res.status(402).json(paymentRequired(req.path));
  }
  try {
    const auth = payment.payload || payment.authorization || payment;
    const verified = await verifyAuthorization({
      ...auth,
      signature: auth.signature || payment.signature,
    });
    const settle = await submitAuthorization(verified);
    req.x402 = { ...verified, ...settle };
    next();
  } catch (err) {
    res.status(402).json({ error: err.message, ...paymentRequired(req.path) });
  }
}

const router = express.Router();

router.get("/requirements", (req, res) => {
  res.json(paymentRequired(req.query.resource || "/api/paid"));
});

router.post("/verify", async (req, res) => {
  try {
    const payment = req.body.payment || req.body;
    const auth = payment.payload || payment.authorization || payment;
    const verified = await verifyAuthorization({
      ...auth,
      signature: auth.signature || payment.signature,
    });
    const settle = await submitAuthorization(verified);
    res.json({ valid: true, ...verified, ...settle });
  } catch (err) {
    res.status(400).json({ valid: false, error: err.message });
  }
});

export const x402Routes = router;
