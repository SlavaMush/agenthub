import express from 'express';

// In-memory storage (replace with database in production)
const memoryModules = new Map();
let memoryIdCounter = 0;

const router = express.Router();

// List memory modules with filters
router.get('/', (req, res) => {
  const { type, minPrice, maxPrice, seller, sort = 'recent', limit = 20, offset = 0 } = req.query;
  
  let modules = Array.from(memoryModules.values()).filter(m => !m.sold);
  
  if (type) modules = modules.filter(m => m.moduleType === type);
  if (minPrice) modules = modules.filter(m => m.priceUSDC >= parseFloat(minPrice) * 1e6);
  if (maxPrice) modules = modules.filter(m => m.priceUSDC <= parseFloat(maxPrice) * 1e6);
  if (seller) modules = modules.filter(m => m.seller.toLowerCase() === seller.toLowerCase());
  
  // Sort
  switch (sort) {
    case 'price_asc': modules.sort((a, b) => a.priceUSDC - b.priceUSDC); break;
    case 'price_desc': modules.sort((a, b) => b.priceUSDC - a.priceUSDC); break;
    case 'validation': modules.sort((a, b) => b.validationScore - a.validationScore); break;
    case 'recent':
    default: modules.sort((a, b) => b.listedAt - a.listedAt);
  }
  
  const total = modules.length;
  modules = modules.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({ modules, total, limit: parseInt(limit), offset: parseInt(offset) });
});

// Get single memory module
router.get('/:id', (req, res) => {
  const module = memoryModules.get(parseInt(req.params.id));
  if (!module) {
    return res.status(404).json({ error: 'Memory module not found' });
  }
  res.json(module);
});

// Create memory module listing (seller mints NFT first, then lists)
router.post('/', (req, res) => {
  const { 
    cid, validationHash, schemaVersion, moduleType, 
    title, description, priceUSDC, seller 
  } = req.body;
  
  // Validation
  if (!cid || !validationHash || !moduleType || !title || !seller) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const id = ++memoryIdCounter;
  const module = {
    id,
    cid,
    validationHash,
    schemaVersion: schemaVersion || 1,
    moduleType,
    title,
    description: description || '',
    priceUSDC: Math.floor(parseFloat(priceUSDC) * 1e6),
    seller: seller.toLowerCase(),
    listedAt: Date.now(),
    sold: false,
    validationScore: 956 // Default 95.6%
  };
  
  memoryModules.set(id, module);
  
  res.status(201).json(module);
});

// Buy memory module
router.post('/:id/buy', (req, res) => {
  const { buyer, paymentTxHash } = req.body;
  const module = memoryModules.get(parseInt(req.params.id));
  
  if (!module) {
    return res.status(404).json({ error: 'Memory module not found' });
  }
  
  if (module.sold) {
    return res.status(400).json({ error: 'Already sold' });
  }
  
  if (!buyer || !paymentTxHash) {
    return res.status(400).json({ error: 'Missing buyer or paymentTxHash' });
  }
  
  // In production, verify paymentTxHash on-chain
  
  module.sold = true;
  module.buyer = buyer.toLowerCase();
  module.soldAt = Date.now();
  module.paymentTxHash = paymentTxHash;
  
  memoryModules.set(module.id, module);
  
  res.json({ 
    success: true, 
    module,
    feeCollected: Math.floor(module.priceUSDC * 0.1) // 10%
  });
});

// Delist memory module
router.post('/:id/delist', (req, res) => {
  const { seller } = req.body;
  const module = memoryModules.get(parseInt(req.params.id));
  
  if (!module) {
    return res.status(404).json({ error: 'Memory module not found' });
  }
  
  if (module.seller.toLowerCase() !== seller.toLowerCase()) {
    return res.status(403).json({ error: 'Not the seller' });
  }
  
  if (module.sold) {
    return res.status(400).json({ error: 'Cannot delist sold module' });
  }
  
  memoryModules.delete(module.id);
  
  res.json({ success: true });
});

// Get seller's modules
router.get('/seller/:address', (req, res) => {
  const modules = Array.from(memoryModules.values())
    .filter(m => m.seller.toLowerCase() === req.params.address.toLowerCase())
    .sort((a, b) => b.listedAt - a.listedAt);
  
  res.json({ modules });
});

export const memoryRoutes = router;