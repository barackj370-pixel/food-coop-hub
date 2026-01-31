
export const COMMODITY_CATEGORIES = {
  'Farm Food Products': [
    'Tomatoes',
    'Onions',
    'Vegetables',
    'Cassava',
    'Maize',
    'Millet',
    'Beans',
    'Other'
  ],
  'Food Products': [
    'Sugar',
    'Salt',
    'Cooking Oil',
    'Milk',
    'Bread',
    'Ngano',
    'Other'
  ],
  'Non-food Products': [
    'Books',
    'Cloths',
    'Soap',
    'Farm tools',
    'Other'
  ]
} as const;

export const CROP_CONFIG = {
  Tomatoes: ['Crate', 'Box', 'Kg'],
  Onions: ['Bag', 'Kg'],
  Vegetables: ['Bundle', 'Kg'],
  Cassava: ['Bag', 'Kg'],
  Maize: ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  Millet: ['2kg Tin', '1kg Tin', 'Kg'],
  Beans: ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  Sugar: ['Kg', 'Packet'],
  Salt: ['Packet', 'Kg'],
  'Cooking Oil': ['Litre', 'Bottle'],
  Milk: ['Litre', 'Packet'],
  Bread: ['Loaf'],
  Ngano: ['Kg', 'Packet'],
  Books: ['Piece'],
  Cloths: ['Piece'],
  Soap: ['Piece', 'Bar'],
  'Farm tools': ['Piece'],
  Other: ['Units', 'Kg', 'Bag', 'Litre', 'Piece', 'Packet']
} as const;

export const CROP_TYPES = Object.keys(CROP_CONFIG);

/**
 * Cooperative profit margin (10%)
 * Used in Records / Orders calculations
 */
export const PROFIT_MARGIN = 0.10;
