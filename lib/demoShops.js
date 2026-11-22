// Demo "login": the seeded sellers from seed.sql. Picking one on the seller page
// saves its id in the browser, and the Analytics tab uses it.
// Real login (Supabase Auth) can replace this later without changing the API.
export const DEMO_SHOPS = [
  { id: '00000000-0000-4000-9000-000000000001', name: 'Nilima Boutique', plan: 'Premium' },
  { id: '00000000-0000-4000-9000-000000000003', name: 'Jewel Box BD', plan: 'Premium' },
  { id: '00000000-0000-4000-9000-000000000002', name: 'Rongdhonu Collection', plan: 'Free' },
  { id: '00000000-0000-4000-9000-000000000004', name: 'Panjabi Ghor', plan: 'Free' },
  { id: '00000000-0000-4000-9000-000000000005', name: 'Gentry Formals', plan: 'Free' },
  { id: '00000000-0000-4000-9000-000000000006', name: 'Step Up Footwear', plan: 'Free' },
  { id: '00000000-0000-4000-9000-000000000007', name: 'Little Star Kids', plan: 'Free' },
];
export const DEMO_SHOP_KEY = 'dokan_demo_shop';