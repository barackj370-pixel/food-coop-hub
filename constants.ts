export const COMMODITY_CATEGORIES = {
  'Farm Food Products': ['Tomatoes', 'Onions', 'Vegetables', 'Cassava', 'Maize', 'Millet', 'Beans', 'Bananas', 'Green Grams', 'Other'],
  'Food Products': ['Sugar', 'Salt', 'Cooking Oil', 'Milk', 'Bread', 'Ngano', 'Rice', 'Omena', 'Fish', 'Other'],
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
  'Bananas': ['Bunch', 'Piece', 'Kg', 'Crate', 'Sack'],
  'Green Grams': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg'],
  // Food Products
  'Sugar': ['Kg', 'Packet', 'Bag', 'Cup'],
  'Salt': ['Packet', 'Kg'],
  'Cooking Oil': ['Litre', 'Bottle', 'Jerrican'],
  'Milk': ['Litre', 'Packet', 'Bottle', 'Cup'],
  'Bread': ['Loaf'],
  'Ngano': ['Kg', 'Packet', 'Bale'],
  'Rice': ['Kg', 'Packet', 'Bag', 'Sack', 'Cup'],
  'Omena': ['2kg Tin', '1kg Tin', '1/2 kg Tin', 'Bag/Sack', 'Kg', 'Cup'],
  'Fish': ['Piece', 'Basket', 'Kg'],
  // Non-food Products
  'Books': ['Piece', 'Box'],
  'Cloths': ['Piece', 'Pair', 'Bundle'],
  'Soap': ['Piece', 'Bar', 'Box'],
  'Farm tools': ['Piece', 'Set'],
  // Default for Other
  'Other': ['Units', 'Kg', 'Bag', 'Litre', 'Piece', 'Packet', 'Bundle', 'Box', 'Crate', 'Sack']
} as const;

export const FOOD_COOPS = ['Mariwa', 'Mulo', 'Rabolo', 'Kangemi', 'Kabarnet', 'Apuoyo', 'Nyamagagana', 'Sibembe', 'New Kangemi Food Coop', 'Hope', 'Wages', 'Red Hill', 'Ligega', 'Utoma Widows Food coop', 'New Grassroots Food Coop', 'Angaza Food Coop', 'Kona Mbaaya', 'Njete', 'Anointed', 'Dero Kenya', 'Sisimkha', 'Kiabi Food Coop', 'Nalondo', 'Sibembe Elders', 'Hekima', 'Shalom Youth', 'Matisi B Block 5', 'Maeni Self Help', 'Kiboroa Amani', 'Mima Self Help', 'Macho self Help', 'Sibembe Widows', 'Trafah', 'Muchukwo/Kolbai', 'Bethel Parental', 'Ladies Star', 'Kithoni', 'Uwezo', 'Bottomline LEF', 'Smart Ladies', 'Nyeri Sisters', 'Upendo Women', 'Litaala Pap', 'Kina Mama', 'Maya', 'Komasincha', 'Ndere Women', 'Webtan', 'Eninga', 'Faith Worship', 'Boresha', ];

export const CROP_TYPES = Object.keys(CROP_CONFIG);

export const PROFIT_MARGIN = 0.10; // 10% coop margin
export const TEN_PERCENT_COOPS = ['Mariwa', 'Mulo', 'Kangemi', 'Kabarnet', 'Apuoyo', 'Nyamagagana'];

// Background Sync Polling Interval (30 Seconds)
export const SYNC_POLLING_INTERVAL = 30000;

export const normalizeProductName = (name: string): string => {
  const lower = name.toLowerCase().trim();
  
  if (lower === 'banana' || lower === 'bananas') return 'Bananas';
  if (lower === 'tomato' || lower === 'tomatoes') return 'Tomatoes';
  if (lower === 'onion' || lower === 'onions') return 'Onions';
  if (lower === 'vegetable' || lower === 'vegetables') return 'Vegetables';
  if (lower === 'bean' || lower === 'beans') return 'Beans';
  if (lower === 'book' || lower === 'books') return 'Books';
  if (lower === 'cloth' || lower === 'cloths' || lower === 'clothes') return 'Cloths';
  if (lower === 'farm tool' || lower === 'farm tools') return 'Farm tools';
  if (lower === 'bar soap' || lower === 'barsoap' || lower === 'soap' || lower === 'soaps') return 'Soap';
  if (lower === 'cassava' || lower === 'cassavas') return 'Cassava';
  if (lower === 'maize') return 'Maize';
  if (lower === 'millet') return 'Millet';
  if (lower === 'sugar') return 'Sugar';
  if (lower === 'salt') return 'Salt';
  if (lower === 'cooking oil' || lower === 'oil') return 'Cooking Oil';
  if (lower === 'milk') return 'Milk';
  if (lower === 'bread' || lower === 'breads') return 'Bread';
  if (lower === 'ngano') return 'Ngano';
  if (lower === 'rice') return 'Rice';
  if (lower === 'omena') return 'Omena';
  if (lower === 'fish' || lower === 'fishes') return 'Fish';
  if (lower === 'green gram' || lower === 'green grams' || lower === 'greengrams' || lower === 'ndengu') return 'Green Grams';
  
  return lower.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const ABOUT_US_DATA = [
  {
    id: 'vision',
    title: 'Vision',
    content: 'A Kenya where farmers practice family farming, agroecology and organic food production systems and control means of food production for food sovereignty.'
  },
  {
    id: 'mission',
    title: 'Mission',
    content: 'To mobilize Kenyan Peasant farmers and consumers to push for agrarian reforms and practice organic farming to ensure food sovereignty and environmental conservation.'
  },
  {
    id: 'who-we-are',
    title: 'Who We Are',
    content: 'The Kenyan Peasants League is a social movement of Kenyan Peasant Farmers, Fishers, Pastoralists, and Consumers whose main aim is to promote Peasant Agroecology for Food Sovereignty by fighting the neoliberal tendencies that kill local agriculture. KPL promotes indigenous seeds, livestock, and plant varieties banking and creation of an alternative economy that is driven by provision for livelihoods.'
  }
];
export const HISTORICAL_COMMISSIONS: Record<string, number> = {
  'New Kangemi Food Coop': 7442,
  'Kangemi': 3099,
  'Red Hill': 807,
  'New Grassroots Food Coop': 465,
  'Wages': 454,
  'Kithoni': 396,
  'Hope': 247,
  'Bethel Parental': 219,
  'Uwezo': 104,
  'Bottomline LEF': 78,
  'Smart Ladies': 51,
  'Ladies Star': 51,
  'Nyeri Sisters': 50,
  'Upendo Women': 27,
  'Litaala Pap': 25,
  'Kina Mama': 18,
  'Maya': 15,
  'Rabolo': 4333,
  'Mariwa': 1980,
  'Utoma Widows Food coop': 1798,
  'Mulo': 1672,
  'Nyamagagana': 1537,
  'Komasincha': 598,
  'Angaza Food Coop': 447,
  'Kabarnet': 2643,
  'Apuoyo': 2225,
  'Ligega': 1452,
  'Muchukwo/Kolbai': 305,
  'Ndere Women': 171,
  'Sibembe': 1684,
  'Anointed': 535,
  'Nalondo': 415,
  'Dero Kenya': 280,
  'Njete': 280,
  'Sisimkha': 280,
  'Maeni Self Help': 245,
  'Webtan': 194,
  'Kona Mbaaya': 171,
  'Matisi B Block 5': 160,
  'Mima Self Help': 160,
  'Shalom Youth': 160,
  'Sibembe Elders': 140,
  'Trafah': 135,
  'Kiabi Food Coop': 115,
  'Macho self Help': 110,
  'Kiboroa Amani': 100,
  'Eninga': 80,
  'Faith Worship': 60,
  'Boresha': 15,
  'Hekima': 10,
  'Sibembe Widows': 5,
};

export const COOP_REGIONS: Record<string, string> = {
  'New Kangemi Food Coop': 'Central',
  'Kangemi': 'Central',
  'Red Hill': 'Central',
  'New Grassroots Food Coop': 'Central',
  'Wages': 'Central',
  'Kithoni': 'Central',
  'Hope': 'Central',
  'Bethel Parental': 'Central',
  'Uwezo': 'Central',
  'Bottomline LEF': 'Central',
  'Smart Ladies': 'Central',
  'Ladies Star': 'Central',
  'Nyeri Sisters': 'Central',
  'Upendo Women': 'Central',
  'Litaala Pap': 'Central',
  'Kina Mama': 'Central',
  'Maya': 'Central',
  'Rabolo': 'South Western',
  'Mariwa': 'South Western',
  'Utoma Widows Food coop': 'South Western',
  'Mulo': 'South Western',
  'Nyamagagana': 'South Western',
  'Komasincha': 'South Western',
  'Angaza Food Coop': 'South Western',
  'Kabarnet': 'North Western',
  'Apuoyo': 'North Western',
  'Ligega': 'North Western',
  'Muchukwo/Kolbai': 'North Western',
  'Ndere Women': 'North Western',
  'Sibembe': 'Western Region',
  'Anointed': 'Western Region',
  'Nalondo': 'Western Region',
  'Dero Kenya': 'Western Region',
  'Njete': 'Western Region',
  'Sisimkha': 'Western Region',
  'Maeni Self Help': 'Western Region',
  'Webtan': 'Western Region',
  'Kona Mbaaya': 'Western Region',
  'Matisi B Block 5': 'Western Region',
  'Mima Self Help': 'Western Region',
  'Shalom Youth': 'Western Region',
  'Sibembe Elders': 'Western Region',
  'Trafah': 'Western Region',
  'Kiabi Food Coop': 'Western Region',
  'Macho self Help': 'Western Region',
  'Kiboroa Amani': 'Western Region',
  'Eninga': 'Western Region',
  'Faith Worship': 'Western Region',
  'Boresha': 'Western Region',
  'Hekima': 'Western Region',
  'Sibembe Widows': 'Western Region',
};
