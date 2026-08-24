import express from 'express';

// In-memory storage
const serviceListings = new Map();
let serviceIdCounter = 0;
const serviceBids = new Map(); // listingId -> bids[]

const router = express.Router();

// List services with filters
router.get('/', (req, res) => {
  const { 
    category, 
    minPrice, 
    maxPrice, 
    seller, 
    type, // 'fixed' or 'auction'
    sort = 'recent', 
    limit = 20, 
    offset = 0 
  } = req.query;
  
  let listings = Array.from(serviceListings.values()).filter(l => l.active);
  
  if (category) listings = listings.filter(l => l.service.category === category);
  if (minPrice) listings = listings.filter(l => l.service.priceUSDC >= parseFloat(minPrice) * 1e6 || l.highestBid >= parseFloat(minPrice) * 1e6);
  if (maxPrice) listings = listings.filter(l => l.service.priceUSDC <= parseFloat(maxPrice) * 1e6 || l.highestBid <= parseFloat(maxPrice) * 1e6);
  if (seller) listings = listings.filter(l => l.service.seller.toLowerCase() === seller.toLowerCase());
  if (type === 'fixed') listings = listings.filter(l => l.service.priceUSDC > 0);
  if (type === 'auction') listings = listings.filter(l => l.service.priceUSDC === 0);
  
  // Sort
  switch (sort) {
    case 'price_asc': 
      listings.sort((a, b) => (a.service.priceUSDC || a.highestBid) - (b.service.priceUSDC || b.highestBid)); 
      break;
    case 'price_desc': 
      listings.sort((a, b) => (b.service.priceUSDC || b.highestBid) - (a.service.priceUSDC || a.highestBid)); 
      break;
    case 'bids': 
      listings.sort((a, b) => b.bidCount - a.bidCount); 
      break;
    case 'recent':
    default: 
      listings.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  const total = listings.length;
  listings = listings.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({ listings, total, limit: parseInt(limit), offset: parseInt(offset) });
});

// Get single service listing with bids
router.get('/:id', (req, res) => {
  const listing = serviceListings.get(parseInt(req.params.id));
  if (!listing) {
    return res.status(404).json({ error: 'Service listing not found' });
  }
  
  const bids = serviceBids.get(listing.id) || [];
  res.json({ ...listing, bids: bids.slice(-10) }); // Last 10 bids
});

// Create service listing
router.post('/', (req, res) => {
  const { title, description, category, priceUSDC, minBidUSDC, durationHours, seller } = req.body;
  
  if (!title || !description || !category || !seller) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const validCategories = ['AUDIT', 'RESEARCH', 'CONTENT', 'DEBUG', 'STRATEGY', 'MEMORY_BUILD'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  
  const id = ++serviceIdCounter;
  const listing = {
    id,
    service: {
      title,
      description,
      category,
      priceUSDC: priceUSDC ? Math.floor(parseFloat(priceUSDC) * 1e6) : 0,
      minBidUSDC: minBidUSDC ? Math.floor(parseFloat(minBidUSDC) * 1e6) : 0,
      durationHours: durationHours || 24,
      seller: seller.toLowerCase(),
      active: true,
      createdAt: Date.now()
    },
    highestBid: 0,
    highestBidder: null,
    bidCount: 0,
    inEscrow: false,
    winner: null,
    createdAt: Date.now()
  };
  
  serviceListings.set(id, listing);
  serviceBids.set(id, []);
  
  res.status(201).json(listing);
});

// Place bid on auction
router.post('/:id/bid', (req, res) => {
  const { bidder, amountUSDC } = req.body;
  const listing = serviceListings.get(parseInt(req.params.id));
  
  if (!listing) {
    return res.status(404).json({ error: 'Service listing not found' });
  }
  
  if (listing.service.priceUSDC > 0) {
    return res.status(400).json({ error: 'Fixed price listing, use buyNow' });
  }
  
  if (!listing.service.active) {
    return res.status(400).json({ error: 'Listing not active' });
  }
  
  if (listing.service.minBidUSDC && parseFloat(amountUSDC) * 1e6 < listing.service.minBidUSDC) {
    return res.status(400).json({ error: `Minimum bid is ${listing.service.minBidUSDC / 1e6} USDC` });
  }
  
  if (parseFloat(amountUSDC) * 1e6 <= listing.highestBid) {
    return res.status(400).json({ error: 'Bid must exceed current highest bid' });
  }
  
  const bid = {
    bidder: bidder.toLowerCase(),
    amountUSDC: Math.floor(parseFloat(amountUSDC) * 1e6),
    timestamp: Date.now(),
    accepted: false
  };
  
  const bids = serviceBids.get(listing.id) || [];
  bids.push(bid);
  serviceBids.set(listing.id, bids);
  
  listing.highestBid = bid.amountUSDC;
  listing.highestBidder = bid.bidder;
  listing.bidCount = bids.length;
  listing.inEscrow = true;
  
  serviceListings.set(listing.id, listing);
  
  res.json({ success: true, bid, listing });
});

// Buy now (fixed price)
router.post('/:id/buy', (req, res) => {
  const { buyer, paymentTxHash } = req.body;
  const listing = serviceListings.get(parseInt(req.params.id));
  
  if (!listing) {
    return res.status(404).json({ error: 'Service listing not found' });
  }
  
  if (listing.service.priceUSDC === 0) {
    return res.status(400).json({ error: 'Auction listing, use bid' });
  }
  
  if (!listing.service.active) {
    return res.status(400).json({ error: 'Listing not active' });
  }
  
  if (listing.inEscrow) {
    return res.status(400).json({ error: 'Already purchased' });
  }
  
  listing.winner = buyer.toLowerCase();
  listing.inEscrow = true;
  listing.paymentTxHash = paymentTxHash;
  listing.paidAt = Date.now();
  
  serviceListings.set(listing.id, listing);
  
  res.json({ 
    success: true, 
    listing,
    feeCollected: Math.floor(listing.service.priceUSDC * 0.05) // 5%
  });
});

// Accept bid (seller accepts)
router.post('/:id/accept', (req, res) => {
  const { seller } = req.body;
  const listing = serviceListings.get(parseInt(req.params.id));
  
  if (!listing) {
    return res.status(404).json({ error: 'Service listing not found' });
  }
  
  if (listing.service.seller.toLowerCase() !== seller.toLowerCase()) {
    return res.status(403).json({ error: 'Not the seller' });
  }
  
  if (!listing.highestBidder) {
    return res.status(400).json({ error: 'No bids to accept' });
  }
  
  // Find and mark bid as accepted
  const bids = serviceBids.get(listing.id) || [];
  const winningBid = bids.find(b => b.bidder === listing.highestBidder);
  if (winningBid) {
    winningBid.accepted = true;
  }
  
  listing.winner = listing.highestBidder;
  listing.acceptedAt = Date.now();
  
  serviceListings.set(listing.id, listing);
  serviceBids.set(listing.id, bids);
  
  res.json({ success: true, listing });
});

// Confirm delivery (buyer confirms)
router.post('/:id/confirm', (req, res) => {
  const { buyer } = req.body;
  const listing = serviceListings.get(parseInt(req.params.id));
  
  if (!listing) {
    return res.status(404).json({ error: 'Service listing not found' });
  }
  
  if (listing.winner?.toLowerCase() !== buyer.toLowerCase()) {
    return res.status(403).json({ error: 'Not the buyer' });
  }
  
  if (!listing.inEscrow) {
    return res.status(400).json({ error: 'No payment in escrow' });
  }
  
  listing.deliveredAt = Date.now();
  listing.service.active = false;
  
  serviceListings.set(listing.id, listing);
  
  // Trigger fee collection (would call contract in production)
  res.json({ 
    success: true, 
    listing,
    feeCollected: Math.floor((listing.service.priceUSDC || listing.highestBid) * 0.05)
  });
});

// Raise dispute
router.post('/:id/dispute', (req, res) => {
  const { raiser, reason, stakeUSDC } = req.body;
  const listing = serviceListings.get(parseInt(req.params.id));
  
  if (!listing) {
    return res.status(404).json({ error: 'Service listing not found' });
  }
  
  if (!listing.inEscrow) {
    return res.status(400).json({ error: 'No payment in escrow to dispute' });
  }
  
  const dispute = {
    id: `disp_${Date.now()}`,
    listingId: listing.id,
    raiser: raiser.toLowerCase(),
    reason,
    stakeUSDC: Math.floor(parseFloat(stakeUSDC) * 1e6),
    createdAt: Date.now(),
    status: 'OPEN',
    jurors: [],
    votes: { seller: 0, buyer: 0 }
  };
  
  listing.dispute = dispute;
  serviceListings.set(listing.id, listing);
  
  res.status(201).json({ success: true, dispute });
});

// Get seller's listings
router.get('/seller/:address', (req, res) => {
  const listings = Array.from(serviceListings.values())
    .filter(l => l.service.seller.toLowerCase() === req.params.address.toLowerCase())
    .sort((a, b) => b.createdAt - a.createdAt);
  
  res.json({ listings });
});

export const serviceRoutes = router;