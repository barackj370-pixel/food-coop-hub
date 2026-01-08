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
 * 1. Deploy your Google Apps Script as a 'Web App'.
 * 2. Set Access to 'Anyone'.
 * 3. Copy the 'Web App URL' and paste it below.
 */
export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxUpf51FjGuia1eRSH7B4axYYqK3ClBpHmAWvLxI1XIK9Pd312DCi4RLwgM0MNXlvOTAg/exec";

/**
 * VIEW URL:
 * Open your Google Sheet in a browser and copy the URL from the address bar.
 * This is used for the 'Open Cloud Sheet' button in the System Portal.
 */
export const GOOGLE_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1SjMrFDNOd3zY-IInRcSgUIlSAeZV8AKIkOoQbPeWvoY/edit?gid=0#gid=0";
