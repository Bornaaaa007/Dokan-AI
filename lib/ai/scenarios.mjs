// Tunable numbers and the pieces each outfit needs.
// The FIRST slot is the main piece: a budget that cannot afford it is "too low".
export const TOO_LOW_FACTOR = 0.5;   // below 50% of the cheapest full look
export const TOO_HIGH_FACTOR = 2;    // above 200% of the most expensive full look

export const SCENARIOS = {
  wedding_woman: {
    label: 'wedding guest (woman)',
    occasion: 'wedding', gender: 'female', age_group: 'adult',
    slots: [
      { name: 'outfit', custom_categories: ['sari', 'three-piece', 'lehenga'] },
      { name: 'shoes', categories: ['shoes'] },
      { name: 'jewelry', categories: ['jewelry'] },
    ],
  },
  interview_man: {
    label: 'job interview (man)',
    occasion: 'formal', gender: 'male', age_group: 'adult',
    slots: [
      { name: 'shirt', custom_categories: ['formal shirt'] },
      { name: 'trousers', custom_categories: ['trousers'] },
      { name: 'shoes', categories: ['shoes'] },
      { name: 'watch', custom_categories: ['watch'] },
    ],
  },
  wedding_girl: {
    label: 'wedding (girl)',
    occasion: 'wedding', gender: 'female', age_group: 'child',
    slots: [
      { name: 'outfit', custom_categories: ['frock', 'lehenga'] },
      { name: 'shoes', categories: ['shoes'] },
      { name: 'accessory', categories: ['accessories'] },
    ],
  },
  eid_woman: {
    label: 'Eid (woman)',
    occasion: 'eid', gender: 'female', age_group: 'adult',
    slots: [
      { name: 'outfit', custom_categories: ['kurti', 'three-piece', 'sari'] },
      { name: 'shoes', categories: ['shoes'] },
      { name: 'jewelry', categories: ['jewelry'] },
    ],
  },
};
