import express from 'express';
import { createPublicClient, http, parseEther, formatEther, encodeFunctionData, createWalletClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// x402 payment configuration
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
const SIBYL_STAKING = '0x6151AA0689576E8F8D218f4DC7F6A4Ec1533d44d';
const AGENT_HUB_ADDRESS = process.env.AGENT_HUB_ADDRESS || '';
const PAYMENT_AMOUNT_USDC = parseFloat(process.env.PAYMENT_AMOUNT_USDC || '1'); // 1 USDC default

// ERC-20 ABI for permit and transferFrom
const ERC20_ABI = [
  { name: 'permit', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'v', type: 'uint8' },
    { name: 'r', type: 'bytes32' },
    { name: 's', type: 'bytes32' }
  ], outputs: [] },
  { name: 'transferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' }
  ], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' }
  ], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [
    { name: 'account', type: 'address' }
  ], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
];

// AgentHub ABI for fee collection
const AGENT_HUB_ABI = [
  { name: 'collectMemoryFee', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'amount', type: 'uint256' }
  ], outputs: [] },
  { name: 'collectServiceFee', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'amount', type: 'uint256' }
  ], outputs: [] }
];

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org')
});

// x402 Middleware - validates payment before allowing access
export async function x402Middleware(req, res, next) {
  const paymentHeader = req.headers['x-payment'];
  
  if (!paymentHeader) {
    return res.status(402).json({
      error: 'Payment Required',
      message: 'This endpoint requires x402 payment',
      accept: 'x402',
      amount: PAYMENT_AMOUNT_USDC,
      asset: 'USDC',
      network: 'base-sepolia',
      payTo: AGENT_HUB_ADDRESS,
      description: 'AgentHub API access'
    });
  }

  try {
    const payment = JSON.parse(paymentHeader);
    const { signature, permit, amount, asset, network, payTo } = payment;
    
    // Validate payment details
    if (asset !== 'USDC' || network !== 'base-sepolia') {
      return res.status(402).json({ error: 'Invalid payment asset or network' });
    }
    
    if (BigInt(amount) < BigInt(Math.floor(PAYMENT_AMOUNT_USDC * 1e6))) {
      return res.status(402).json({ error: 'Insufficient payment amount' });
    }
    
    // Verify permit signature
    const isValid = await verifyPermit(permit, payTo, amount);
    if (!isValid) {
      return res.status(402).json({ error: 'Invalid payment signature' });
    }
    
    // Execute the transfer
    const txHash = await executeTransfer(permit, payTo, amount);
    
    // Attach payment info to request
    req.x402 = { txHash, amount: BigInt(amount), payer: permit.owner };
    next();
  } catch (err) {
    console.error('x402 validation error:', err);
    res.status(402).json({ error: 'Payment validation failed' });
  }
}

// Verify EIP-2612 permit signature
async function verifyPermit(permit, spender, amount) {
  try {
    // Reconstruct the permit message hash
    const domain = {
      name: 'Mock USDC',
      version: '1',
      chainId: 84532, // Base Sepolia
      verifyingContract: USDC_ADDRESS
    };
    
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };
    
    const message = {
      owner: permit.owner,
      spender: permit.spender,
      value: BigInt(permit.value),
      nonce: BigInt(permit.nonce),
      deadline: BigInt(permit.deadline)
    };
    
    // For demo purposes, we trust the permit
    // In production, use viem's verifyTypedData
    return true;
  } catch {
    return false;
  }
}

// Execute the transfer using permit
async function executeTransfer(permit, payTo, amount) {
  try {
    // In production, this would submit the permit + transferFrom to the blockchain
    // For demo, we just log and return a mock hash
    console.log(`x402: Executing transfer of ${amount} USDC from ${permit.owner} to ${payTo}`);
    return '0x' + '0'.repeat(64); // Mock tx hash
  } catch (err) {
    console.error('Transfer execution failed:', err);
    throw err;
  }
}

// x402 Routes - payment endpoints
const router = express.Router();

// Get payment requirements for an endpoint
router.get('/requirements/:endpoint', (req, res) => {
  res.json({
    endpoint: req.params.endpoint,
    amount: PAYMENT_AMOUNT_USDC,
    asset: 'USDC',
    network: 'base-sepolia',
    payTo: AGENT_HUB_ADDRESS,
    description: `Access to ${req.params.endpoint}`,
    accepts: ['permit', 'transfer']
  });
});

// Verify a payment
router.post('/verify', async (req, res) => {
  try {
    const { payment } = req.body;
    const isValid = await verifyPermit(payment.permit, payment.payTo, payment.amount);
    
    if (isValid) {
      const txHash = await executeTransfer(payment.permit, payment.payTo, payment.amount);
      res.json({ valid: true, txHash });
    } else {
      res.status(400).json({ valid: false, error: 'Invalid payment' });
    }
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

export const x402Routes = router;