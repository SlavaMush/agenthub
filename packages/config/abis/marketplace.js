export const agentHubAbi = [
  { type: "function", name: "USDC", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "identityRegistry", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "memoryMarket", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "serviceEscrow", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "memoryFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "serviceFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "isAgent", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "totalVolumeUSDC", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalFeesUSDC", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "event",
    name: "MarketsUpdated",
    inputs: [
      { name: "memoryMarket", type: "address", indexed: true },
      { name: "serviceEscrow", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PauseSet",
    inputs: [{ name: "paused", type: "bool", indexed: false }],
  },
  {
    type: "event",
    name: "SettlementNoted",
    inputs: [
      { name: "market", type: "address", indexed: true },
      { name: "volumeUSDC", type: "uint256", indexed: false },
      { name: "feeUSDC", type: "uint256", indexed: false },
    ],
  },
];

export const memoryMarketAbi = [
  { type: "function", name: "list", stateMutability: "nonpayable", inputs: [
    { name: "cid", type: "string" }, { name: "uri", type: "string" }, { name: "priceUSDC", type: "uint96" },
  ], outputs: [{ type: "uint256" }] },
  { type: "function", name: "delist", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "buy", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "cids", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "getListing", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{
    type: "tuple", components: [
      { name: "seller", type: "address" },
      { name: "priceUSDC", type: "uint96" },
      { name: "cidHash", type: "bytes32" },
      { name: "active", type: "bool" },
    ],
  }] },
  {
    type: "event",
    name: "MemoryListed",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "priceUSDC", type: "uint96", indexed: false },
      { name: "cidHash", type: "bytes32", indexed: false },
      { name: "cid", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MemoryDelisted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MemorySold",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "priceUSDC", type: "uint96", indexed: false },
      { name: "feeUSDC", type: "uint256", indexed: false },
    ],
  },
];

export const serviceEscrowAbi = [
  { type: "function", name: "list", stateMutability: "nonpayable", inputs: [
    { name: "uri", type: "string" }, { name: "priceUSDC", type: "uint96" }, { name: "durationSeconds", type: "uint32" },
  ], outputs: [{ type: "uint256" }] },
  { type: "function", name: "fund", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "uint256" }], outputs: [] },
  { type: "function", name: "deliver", stateMutability: "nonpayable", inputs: [
    { name: "jobId", type: "uint256" }, { name: "cid", type: "string" },
  ], outputs: [] },
  { type: "function", name: "confirm", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "uint256" }], outputs: [] },
  { type: "function", name: "autoRelease", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "uint256" }], outputs: [] },
  { type: "function", name: "timeoutRefund", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "uint256" }], outputs: [] },
  { type: "function", name: "freeze", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "uint256" }], outputs: [] },
  { type: "function", name: "getJob", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{
    type: "tuple", components: [
      { name: "seller", type: "address" },
      { name: "buyer", type: "address" },
      { name: "priceUSDC", type: "uint96" },
      { name: "deadline", type: "uint64" },
      { name: "deliveredAt", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "cid", type: "string" },
      { name: "uri", type: "string" },
    ],
  }] },
  {
    type: "event",
    name: "ServiceListed",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "priceUSDC", type: "uint96", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
      { name: "uri", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ServiceFunded",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "priceUSDC", type: "uint96", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ServiceDelivered",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "cid", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ServiceCompleted",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "sellerAmount", type: "uint256", indexed: false },
      { name: "feeUSDC", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ServiceRefunded",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ServiceFrozen",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "by", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ServiceResolved",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "toSeller", type: "bool", indexed: false },
    ],
  },
];

export const JOB_STATUS = ["None", "Listed", "Funded", "Delivered", "Completed", "Refunded", "Frozen"];
