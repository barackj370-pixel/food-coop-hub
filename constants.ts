
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

export const PROFIT_MARGIN = 0.10; // 10% coop margin

export const SYNC_POLLING_INTERVAL = 30000;

export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxiRiDCXNVJfn1TAqd-pDHXf0UMIjaALOXazob8jciLpHf8wbxeskSbjLY4XWNqFEM9AQ/exec";

export const GOOGLE_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1WL6yQY6AkRJy18pdxJAoYVGdLyZZUoQIsZlZew7oY6Y/edit?gid=1771130545#gid=1771130545";

// Added missing CLUSTERS export required by App.tsx
export const CLUSTERS = ['Mariwa', 'Kanyamkago', 'South Kamagambo', 'North Kamagambo', 'Central Kamagambo'];
