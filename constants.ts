export const CROP_CONFIG = {
  'Maize': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  'Beans': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  'Sorghum': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  'Wheat': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  'Coffee': ['Kg', 'Bag'],
  'Tea': ['Kg'],
  'Potato': ['Bag', 'Kg'],
  'Cabbage': ['Head', 'Bag'],
  'Tomato': ['Crate', 'Box', 'Kg'],
  'Kales': ['Bundle', 'Kg']
} as const;

export const CROP_TYPES = Object.keys(CROP_CONFIG);

export const PROFIT_MARGIN = 0.10; // 10% coop margin

// Replace this with your Google Apps Script Web App URL (for background syncing)
export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyDB29T3IhoDlvjXTZUUrhb_6FkhLKoI8uzTrJ4rKUhk1iu_1CwA55AegSe2kMo-Tu0dA/exec";

// Replace this with your actual Google Sheet URL (for viewing the raw data)
export const GOOGLE_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/your-sheet-id-here/edit";