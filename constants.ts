
export const COMMODITY_CATEGORIES = {
  'Farm Food Products': ['Tomatoes', 'Onions', 'Vegetables', 'Cassava', 'Maize', 'Millet', 'Beans', 'Other'],
  'Food Products': ['Sugar', 'Salt', 'Cooking Oil', 'Milk', 'Bread', 'Ngano', 'Other'],
  'Non-food Products': ['Books', 'Cloths', 'Soap', 'Farm tools', 'Other']
} as const;

export const CROP_CONFIG = {
  'Tomatoes': ['Crate', 'Box', 'Kg'],
  'Onions': ['Bag', 'Kg'],
  'Vegetables': ['Bundle', 'Kg'],
  'Cassava': ['Bag', 'Kg'],
  'Maize': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  'Millet': ['2kg Tin', '1kg Tin', 'Kg'],
  'Beans': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  'Sugar': ['Kg', 'Packet'],
  'Salt': ['Packet', 'Kg'],
  'Cooking Oil': ['Litre', 'Bottle'],
  'Milk': ['Litre', 'Packet'],
  'Bread': ['Loaf'],
  'Ngano': ['Kg', 'Packet'],
  'Books': ['Piece'],
  'Cloths': ['Piece'],
  'Soap': ['Piece', 'Bar'],
  'Farm tools': ['Piece'],
  'Other': ['Units', 'Kg', 'Bag', 'Litre', 'Piece', 'Packet']
} as const;

export const CROP_TYPES = Object.keys(CROP_CONFIG);
export const PROFIT_MARGIN = 0.10; 
export const SYNC_POLLING_INTERVAL = 15000; // Increased frequency for "real-time" feel

// Restored the 7 Clusters from 24h ago
export const CLUSTERS = ['Mariwa', 'Kabarnet', 'Bomet', 'Iten', 'Marigat', 'Eldoret', 'Nakuru'];

export const GOOGLE_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1HiMWDqPQi_uzHDKUr_wJAWUDPeWQofyYd4IU6esNq5w/edit?gid=0#gid=0";
export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxDJ_0zNPpLGqYgmp8sjkkOi1zdq8D6YcS4LOoYQGLlLBtj7Vgud7ImSzMoZhH2M60C0A/exec";
