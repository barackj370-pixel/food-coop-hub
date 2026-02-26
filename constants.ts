export const COMMODITY_CATEGORIES = {
  'Farm Food Products': ['Tomatoes', 'Onions', 'Vegetables', 'Cassava', 'Maize', 'Millet', 'Beans', 'Bananas', 'Other'],
  'Food Products': ['Sugar', 'Salt', 'Cooking Oil', 'Milk', 'Bread', 'Ngano', 'Other'],
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
  // Food Products
  'Sugar': ['Kg', 'Packet', 'Bag', 'Cup'],
  'Salt': ['Packet', 'Kg'],
  'Cooking Oil': ['Litre', 'Bottle', 'Jerrican'],
  'Milk': ['Litre', 'Packet', 'Bottle', 'Cup'],
  'Bread': ['Loaf'],
  'Ngano': ['Kg', 'Packet', 'Bale'],
  // Non-food Products
  'Books': ['Piece', 'Box'],
  'Cloths': ['Piece', 'Pair', 'Bundle'],
  'Soap': ['Piece', 'Bar', 'Box'],
  'Farm tools': ['Piece', 'Set'],
  // Default for Other
  'Other': ['Units', 'Kg', 'Bag', 'Litre', 'Piece', 'Packet', 'Bundle', 'Box', 'Crate', 'Sack']
} as const;

export const CROP_TYPES = Object.keys(CROP_CONFIG);

export const PROFIT_MARGIN = 0.10; // 10% coop margin

// Background Sync Polling Interval (30 Seconds)
export const SYNC_POLLING_INTERVAL = 30000;

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
    id: 'history',
    title: 'History',
    content: 'KPL was formed in January 2016 and the formation was motivated by the WTO MC10 meeting that took place in Nairobi in December 2015.\n\nDuring the MC10, the Kenyan Social Movements formed a Social Movement Working Group on WTO where with the support of La Via Campesina (LVC), we organized a parallel Peoples WTO meeting. It is during this meeting that a resolution was passed to form a movement to represent the interests of Peasant Farmers in Kenya.\n\nIn January 2016, a meeting of the Social Movements Working Group on WTO resolved to form Kenyan Peasants League (KPL). During 2016 and early 2017, KPL focused much on campaigns and advocacy on matters of peasants and in March 2017, KPL resolved to start direct mobilization of peasant farmers. The focal areas of focus were identified as Migori, Kisumu, Machakos, Trans Nzoia, Turkana, Kiambu, and Nairobi Counties.\n\nPhase one of direct farmers’ mobilizations focused on Migori, Machakos, and Nairobi Counties. In the three counties, KPL has formed structures binging together Peasant Farmers into clusters of between 10 and 20 peasant farmers. In Migori County, we currently have four clusters; in Machakos, we have two clusters while in Nairobi we have five clusters.'
  },
  {
    id: 'who-we-are',
    title: 'Who We ARE',
    content: 'The Kenyan Peasants League is a social movement of Kenyan Peasant Farmers, Fishers, Pastoralists, and Consumers whose main aim is to promote Peasant Agroecology for Food Sovereignty by fighting the neoliberal tendencies that kill local agriculture. KPL promotes indigenous seeds, livestock, and plant varieties banking and creation of an alternative economy that is driven by provision for livelihoods.'
  },
  {
    id: 'agroecology',
    title: 'Agroecology and Climate Justice',
    content: 'For the majority of Africans, around 70%, their ecological, economic and social agenda is tied to agriculture. This dependence on agriculture means massive vulnerability to the effects of climate change. Dealing with the climate crisis is key to ensuring resilience, food sovereignty, justice and livelihoods for Africa.'
  },
  {
    id: 'seed-food-sovereignty',
    title: 'Seed and Food Sovereignty',
    content: 'In the face of the crises of Covid-19, climate and inequality, remember that it’s small farmers who feed 80% of the world, not big business. The majority of the world depends on them and their fight for food sovereignty. Our solidarity with them in their struggle is more important than ever.\n\nOn the International Day of Peasants’ Struggle, and every day, we stand in solidarity with our partners who are working on the frontlines with farmers’ movements and agricultural workers in this moment of crisis.'
  },
  {
    id: 'peasant-feminism',
    title: 'Peasant Feminism',
    content: '“A really important part of being women in La Vía Campesina is to identify ourselves and our various struggles” emphasized speakers at the start of the V Women’s Assembly taking place in Basque Country on 17 and 18 July 2017. The peasant women highlighted various aspects of this identity, including women’s care for the land, the seeds and the ecosystem and their fights against patriarchy, the sexist system, and violence. They took advantage of their unique gathering to advance their collective understanding of how to fight for food sovereignty with feminism.”\n\nFood sovereignty is a feminist issue. Food production, harmonious social relations and balance with nature is the fabric of life that is entwined with and embodied in women. The onset of patriarchy, a structural system of domination more pronounced in capitalist relations, has disrupted balance in social relations. Now, women are exploited for profit. Their economic, social, legal and political rights are not fully recognized, and public policies fail to guarantee their equal social and economic participation. Yet, they are the majority of food producers and continue to do unpaid food-related care work (processing, preparing, storing, seed saving, etc.). Their rights — access to land, support services and legal recognition — receive minimal policy attention and are overlooked by many researchers and experts.'
  },
  {
    id: 'natural-resources',
    title: 'Access to Natural Resources',
    content: 'Why natural resource management is conflict management by definition\nLand, water, forests and livestock as well as marine life are primary sources of income for a good part of the population of developing countries. In many cases, natural resources are considered common goods or are utilized by several users. Resource management always involves cooperation but also different – often competing – interests.\n\nTo prevent violent conflicts, assess risks and foster adaptation as well as innovation, we advocate for increased analysis of interest and needs of actors, as well as their power relations and rights that influence resource management in different settings. Evidence shows that good analysis and subsequent measures allow projects to increase their impact and contribute to conflict prevention.\n\nCauses and factors for conflict over natural resources\nConflicts over natural resources are not a new phenomenon. A series of factors or trends are known which often trigger or substantially exacerbate conflicts over natural resources. The result is that local/traditional mechanisms are no longer able to address or solve conflicts and mediate diverging interests.'
  },
  {
    id: 'rights-of-peasants',
    title: 'Rights of Peasants and Other People Working in Rural Area',
    content: 'Many people in the Kenya think it’s a derogatory term referring to people ruled by feudal lords in the middle ages. But it really means a “person of the land or of the country” and in much of the world, family farmers and rural workers continue to embrace the term (“campesino“ in Spanish, “paysan“ in French) to describe themselves and their communities with pride. It’s a term that denotes communities and people who produce food, who have important knowledge and skills, and who prefer autonomy in making decisions in their livelihoods and work. Peasants produce food for the market, not just for themselves. It is estimated that peasants produce well over half of the world’s food.'
  }
];
