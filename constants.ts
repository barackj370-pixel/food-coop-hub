

export const COMMODITY_CATEGORIES = {
  'Farm Food Products': ['Tomatoes', 'Onions', 'Vegetables', 'Cassava', 'Maize', 'Millet', 'Beans', 'Other'],
  'Food Products': ['Sugar', 'Salt', 'Cooking Oil', 'Milk', 'Bread', 'Ngano', 'Other'],
  'Non-food Products': ['Books', 'Cloths', 'Soap', 'Farm tools', 'Other']
} as const;

export const CROP_CONFIG = {
  // Farm Food Products
  'Tomatoes': ['Crate', 'Box', 'Kg'],
  'Onions': ['Bag', 'Kg'],
  'Vegetables': ['Bundle', 'Kg'],
  'Cassava': ['Bag', 'Kg'],
  'Maize': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  'Millet': ['2kg Tin', '1kg Tin', 'Kg'],
  'Beans': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  // Food Products
  'Sugar': ['Kg', 'Packet'],
  'Salt': ['Packet', 'Kg'],
  'Cooking Oil': ['Litre', 'Bottle'],
  'Milk': ['Litre', 'Packet'],
  'Bread': ['Loaf'],
  'Ngano': ['Kg', 'Packet'],
  // Non-food Products
  'Books': ['Piece'],
  'Cloths': ['Piece'],
  'Soap': ['Piece', 'Bar'],
  'Farm tools': ['Piece'],
  // Default for Other
  'Other': ['Units', 'Kg', 'Bag', 'Litre', 'Piece', 'Packet']
} as const;

export const CROP_TYPES = Object.keys(CROP_CONFIG);

export const PROFIT_MARGIN = 0.10; // 10% coop margin

// Background Sync Polling Interval (30 Seconds)
export const SYNC_POLLING_INTERVAL = 30000;

// Fix: Add explicit string type to prevent 'never' type narrowing in consuming services when value is ""
export const GOOGLE_SHEETS_WEBHOOK_URL: string = "";