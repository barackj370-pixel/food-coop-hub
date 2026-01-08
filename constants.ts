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

/**
 * CONFIGURATION:
 * Paste your Google Apps Script 'Web App URL' below.
 * It should look like: https://script.google.com/macros/s/.../exec
 */
export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbx1Gq1qOUcgdplAt3M6JyLzp4omw4AibE6NWBwmvKPrvXhC7A7siFTCkixmAp3-E26KIg/exec";

// Your Google Sheet Browser URL for easy access
export const GOOGLE_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1SjMrFDNOd3zY-IInRcSgUIlSAeZV8AKIkOoQbPeWvoY/edit";