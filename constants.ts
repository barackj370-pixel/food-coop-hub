export const COMMODITY_CATEGORIES = {
  'Farm Food Products': ['Tomatoes', 'Onions', 'Vegetables', 'Cassava', 'Maize', 'Millet', 'Beans', 'Other'],
  'Food Products': ['Sugar', 'Salt', 'Cooking Oil', 'Milk', 'Bread', 'Ngano', 'Other'],
  'Non-food Products': ['Books', 'Cloths', 'Soap', 'Farm tools', 'Other']
} as const;

export const CROP_CONFIG = {
  // Farm Food Products
  'Tomatoes': ['Crate', 'Box', 'Kg', 'Bag', 'Piece', 'Bundle'],
  'Onions': ['Bag', 'Kg', 'Piece', 'Bundle', 'Net', 'Sack'],
  'Vegetables': ['Bundle', 'Kg', 'Bag', 'Sack', 'Piece'],
  'Cassava': ['Bag', 'Kg', 'Piece', 'Heap'],
  'Maize': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg', 'Cob'],
  'Millet': ['2kg Tin', '1kg Tin', 'Kg', 'Bag/Sack'],
  'Beans': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  // Food Products
  'Sugar': ['Kg', 'Packet', 'Bag', 'Cup'],
  'Salt': ['Packet', 'Kg'],
  'Cooking Oil': ['Litre', 'Bottle', 'Jerrican'],
  'Milk': ['Litre', 'Packet', 'Bottle', 'Cup'],
  'Bread': ['Loaf'],
  'Ngano': ['Kg', 'Packet', 'Bale'],
  // Non-food Products
  'Books': ['Piece', 'Box'],
  'Cloths': ['Piece', 'Pair', 'Bundle'],
  'Soap': ['Piece', 'Bar', 'Box'],
  'Farm tools': ['Piece', 'Set'],
  // Default for Other
  'Other': ['Units', 'Kg', 'Bag', 'Litre', 'Piece', 'Packet', 'Bundle', 'Box', 'Crate', 'Sack']
} as const;

export const CROP_TYPES = Object.keys(CROP_CONFIG);

export const PROFIT_MARGIN = 0.10; // 10% coop margin

// Background Sync Polling Interval (30 Seconds)
export const SYNC_POLLING_INTERVAL = 30000;
