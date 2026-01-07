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
 * CONFIGURATION GUIDE:
 * 1. GOOGLE_SHEETS_WEBHOOK_URL: 
 *    - In Apps Script, click "Deploy" -> "New Deployment" -> "Web App".
 *    - Set "Who has access" to "Anyone".
 *    - Use the URL ending in /exec.
 * 
 * 2. GOOGLE_SHEET_VIEW_URL:
 *    - Open your spreadsheet in the browser.
 *    - Copy the URL from the address bar.
 */

export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbww5fug0G1f6cBGh3LhjPDsw3N-2wsx8Yr95dAbK2Jy8XlhRmwmrQP2iCK7bcVNyHJIqg/exec";

// REPLACE 'your-sheet-id-here' WITH YOUR ACTUAL SHEET ID OR FULL URL
export const GOOGLE_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1SjMrFDNOd3zY-IInRcSgUIlSAeZV8AKIkOoQbPeWvoY/edit";