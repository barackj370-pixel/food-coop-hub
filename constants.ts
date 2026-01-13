
export const COMMODITY_CATEGORIES = {
  'Farm Food Products': ['Tomatoes', 'Onions', 'Vegetables', 'Cassava', 'Maize', 'Millet', 'Beans'],
  'Food Products': ['Sugar', 'Salt', 'Cooking Oil', 'Milk', 'Bread', 'Ngano'],
  'Non-food Products': ['Books', 'Cloths', 'Soap', 'Farm tools']
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
  'Farm tools': ['Piece']
} as const;

export const CROP_TYPES = Object.keys(CROP_CONFIG);

export const PROFIT_MARGIN = 0.10; // 10% coop margin

/**
 * CONFIGURATION: 
 * Your deployed Google Apps Script Web App URL.
 */
export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbx0iq5jjAVpf2BfHDAK8Ri0X5dmrdZxk8sJgBKLhc-97z62f1yT9plDxVAsQIG1BCaf/exec";

/**
 * VIEW URL:
 * Your Google Sheet browser URL.
 */
export const GOOGLE_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1SjMrFDNOd3zY-IInRcSgUIlSAeZV8AKIkOoQbPeWvoY/edit?gid=0#gid=0";
