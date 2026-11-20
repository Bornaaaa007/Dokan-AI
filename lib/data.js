export const COLORS = { maroon: '#8a1538', navy: '#1f2a5a', green: '#1f6b5a', black: '#222233', gold: '#c9a227', pink: '#d4688f', white: '#e8e4de', brown: '#6b4a2f' };
export const SHOPS = [
  { id: 1, name: 'Nusrat Boutique', city: 'Comilla', rating: 4.7, verified: true, fraud: false, premium: true, followers: 1240, policy: 'Exchange within 3 days if unworn and tags intact.' },
  { id: 2, name: 'Rafi Menswear', city: 'Dhaka', rating: 4.4, verified: true, fraud: false, premium: false, followers: 640, policy: 'Size exchange within 2 days. No cash refund.' },
  { id: 3, name: 'Tania Jewels & Shoes', city: 'Chattogram', rating: 4.8, verified: true, fraud: false, premium: true, followers: 2100, policy: 'Exchange within 5 days; jewelry must be unused.' },
  { id: 4, name: 'Quick Trends', city: 'Sylhet', rating: 3.1, verified: false, fraud: true, premium: false, followers: 90, policy: 'Exchange only for defects.' },
];
const CL = ['S', 'M', 'L', 'XL'], SH = ['38', '39', '40', '41'], FR = ['Free'];
// [name, category, type, gender, color, price, shop, occasion, sizes]
const raw = [
  ['Maroon Katan Sari', 'Sari', 'clothing', 'Women', 'maroon', 2300, 1, 'Wedding', FR], ['Cotton Printed Kurti', 'Kurti', 'clothing', 'Women', 'green', 750, 1, 'Casual', CL],
  ['Embroidered Three-piece', 'Three-piece', 'clothing', 'Women', 'navy', 1700, 1, 'Eid', CL], ['Pleated Midi Skirt', 'Skirt', 'clothing', 'Women', 'pink', 480, 4, 'Casual', CL],
  ['Slim-fit Formal Shirt', 'Shirt', 'clothing', 'Men', 'white', 900, 2, 'Formal', CL], ['Gabardine Formal Pants', 'Pants', 'clothing', 'Men', 'black', 1100, 2, 'Formal', CL],
  ['Festive Panjabi', 'Panjabi', 'clothing', 'Men', 'navy', 1450, 2, 'Eid', CL], ['Kids Eid Frock', 'Frock', 'clothing', 'Children', 'pink', 650, 1, 'Eid', ['2Y', '4Y', '6Y']],
  ['Cotton Fatua for Elders', 'Fatua', 'clothing', 'Elderly', 'white', 520, 2, 'Casual', CL], ['Soft Cotton Sari', 'Sari', 'clothing', 'Elderly', 'brown', 980, 1, 'Casual', FR],
  ['Block Heels', 'Heels', 'shoes', 'Women', 'black', 900, 3, 'Wedding', SH], ['Leather Oxford', 'Formal shoes', 'shoes', 'Men', 'brown', 1700, 2, 'Formal', SH],
  ['Flat Sandals', 'Sandals', 'shoes', 'Women', 'gold', 500, 3, 'Casual', SH], ['Gold Jhumka Set', 'Earrings', 'jewelry', 'Women', 'gold', 800, 3, 'Wedding', FR],
  ['Stone Necklace Set', 'Necklace', 'jewelry', 'Women', 'maroon', 1400, 3, 'Party', FR], ['Classic Steel Watch', 'Watch', 'accessories', 'Men', 'black', 900, 2, 'Formal', FR],
  ['Beaded Clutch', 'Clutch', 'accessories', 'Women', 'brown', 500, 3, 'Party', FR], ['Cheap Party Dress', 'Dress', 'clothing', 'Women', 'maroon', 400, 4, 'Party', CL],
];
export const PRODUCTS = raw.map(([name, cat, type, gender, color, price, shop, occasion, sizes], i) => ({ id: i + 1, name, cat, type, gender, color, price, shop, occasion, sizes, stock: 8 + (i % 5) * 3, desc: `${name} – quality ${type} with careful finishing. Delivery by courier across Bangladesh.` }));
export const shopOf = (id) => SHOPS.find((s) => s.id === id);
export const bdt = (n) => Math.round(n).toLocaleString('en-BD') + ' BDT';
export const commissionRate = (p) => (p < 500 ? 2 : p < 1000 ? 3 : 5);
export const STATUS = ['Placed', 'Accepted', 'Packed', 'Shipped', 'Delivered'];
export const DELIVERY = 80;
