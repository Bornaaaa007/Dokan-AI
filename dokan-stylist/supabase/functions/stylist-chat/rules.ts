// Outfit rules for the AI stylist. Edit this file to change what a "complete look" means.
// The code (not Gemini) uses these rules to search products and build the bundle.

export type Occasion = "wedding" | "interview" | "eid" | "party" | "casual";
export type Audience =
  | "female_adult" | "male_adult"
  | "female_child" | "male_child"
  | "female_elderly" | "male_elderly";

export const OCCASIONS: Occasion[] = ["wedding", "interview", "eid", "party", "casual"];
export const AUDIENCES: Audience[] = [
  "female_adult", "male_adult", "female_child", "male_child", "female_elderly", "male_elderly",
];

// Which products belong to each audience (unisex items are shared).
export const AUDIENCE_FILTER: Record<Audience, { genders: string[]; age: string }> = {
  female_adult:   { genders: ["female", "unisex"], age: "adult" },
  male_adult:     { genders: ["male", "unisex"],   age: "adult" },
  female_child:   { genders: ["female", "unisex"], age: "child" },
  male_child:     { genders: ["male", "unisex"],   age: "child" },
  female_elderly: { genders: ["female", "unisex"], age: "elderly" },
  male_elderly:   { genders: ["male", "unisex"],   age: "elderly" },
};

export interface SlotRule {
  slot: string;                 // internal id
  label: string;                // shown to the user
  share: number;                // preferred share of the budget (0 to 1)
  optional?: boolean;           // optional slots are added only if the budget allows
  category: "clothing" | "jewelry" | "shoes" | "accessories";
  custom?: string[];            // product.custom_category must be one of these
  tags?: string[];              // product.occasion_tags must include at least one of these
}

// Slot order = priority. When the budget is tight, slots at the END are dropped first.
const R = (slot: string, label: string, share: number, category: SlotRule["category"],
  o: { custom?: string[]; tags?: string[]; optional?: boolean } = {}): SlotRule =>
  ({ slot, label, share, category, ...o });

const FEMALE_ELDERLY = [
  R("outfit", "Outfit", 0.7, "clothing", { custom: ["sari", "three-piece"] }),
  R("shoes", "Shoes", 0.3, "shoes", { custom: ["walking shoes"] }),
];
const MALE_ELDERLY = [
  R("outfit", "Outfit", 0.6, "clothing", { custom: ["panjabi"] }),
  R("shoes", "Shoes", 0.25, "shoes", { custom: ["walking shoes"] }),
  R("shawl", "Chador", 0.15, "accessories", { custom: ["shawl"], optional: true }),
];

export const RULES: Record<Audience, Partial<Record<Occasion, SlotRule[]>>> = {
  female_adult: {
    wedding: [
      R("outfit", "Sari / outfit", 0.45, "clothing", { custom: ["sari", "three-piece"], tags: ["wedding"] }),
      R("shoes", "Shoes", 0.18, "shoes", { tags: ["wedding"] }),
      R("jewelry", "Jewelry", 0.25, "jewelry", { tags: ["wedding"] }),
      R("bag", "Clutch / bag", 0.12, "accessories", { custom: ["clutch", "handbag"], tags: ["wedding", "party"], optional: true }),
    ],
    eid: [
      R("outfit", "Outfit", 0.6, "clothing", { custom: ["sari", "three-piece", "kurti", "palazzo set"], tags: ["eid"] }),
      R("shoes", "Shoes", 0.2, "shoes", { tags: ["eid"] }),
      R("jewelry", "Jewelry", 0.2, "jewelry", { tags: ["eid"], optional: true }),
    ],
    party: [
      R("outfit", "Outfit", 0.5, "clothing", { custom: ["sari", "three-piece", "kurti"], tags: ["party"] }),
      R("shoes", "Shoes", 0.22, "shoes", { tags: ["party"] }),
      R("jewelry", "Jewelry", 0.16, "jewelry", { tags: ["party"], optional: true }),
      R("bag", "Clutch / bag", 0.12, "accessories", { custom: ["clutch", "handbag"], tags: ["party"], optional: true }),
    ],
    casual: [
      R("outfit", "Outfit", 0.65, "clothing", { custom: ["kurti", "three-piece", "skirt", "palazzo set"], tags: ["casual"] }),
      R("shoes", "Shoes", 0.35, "shoes", { tags: ["casual"] }),
    ],
  },
  male_adult: {
    interview: [
      R("shirt", "Formal shirt", 0.22, "clothing", { custom: ["formal shirt"], tags: ["formal"] }),
      R("trousers", "Formal trousers", 0.26, "clothing", { custom: ["trousers"], tags: ["formal"] }),
      R("shoes", "Formal shoes", 0.32, "shoes", { custom: ["formal shoes"] }),
      R("watch", "Watch", 0.12, "accessories", { custom: ["watch"], tags: ["formal"], optional: true }),
      R("belt", "Belt", 0.04, "accessories", { custom: ["belt"], optional: true }),
      R("tie", "Tie", 0.04, "accessories", { custom: ["tie"], optional: true }),
    ],
    eid: [
      R("panjabi", "Panjabi", 0.55, "clothing", { custom: ["panjabi"], tags: ["eid"] }),
      R("shoes", "Sandals", 0.3, "shoes", { custom: ["sandals"], tags: ["eid"] }),
      R("pajama", "Pajama", 0.1, "clothing", { custom: ["pajama"], tags: ["eid"], optional: true }),
      R("cap", "Prayer cap", 0.05, "accessories", { custom: ["cap"], optional: true }),
    ],
    wedding: [
      R("panjabi", "Panjabi", 0.6, "clothing", { custom: ["panjabi"], tags: ["wedding"] }),
      R("shoes", "Sandals", 0.25, "shoes", { custom: ["sandals"], tags: ["wedding"] }),
      R("watch", "Watch", 0.15, "accessories", { custom: ["watch"], optional: true }),
    ],
    party: [
      R("panjabi", "Panjabi", 0.7, "clothing", { custom: ["panjabi"], tags: ["party"] }),
      R("shoes", "Shoes", 0.3, "shoes", { custom: ["formal shoes", "sandals"] }),
    ],
    casual: [
      R("top", "Top", 0.45, "clothing", { custom: ["polo shirt", "panjabi"], tags: ["casual"] }),
      R("bottom", "Trousers", 0.3, "clothing", { custom: ["trousers"], tags: ["casual"] }),
      R("shoes", "Shoes", 0.25, "shoes", { custom: ["sneakers", "sandals"], tags: ["casual"] }),
    ],
  },
  female_child: {
    wedding: [
      R("outfit", "Outfit", 0.55, "clothing", { custom: ["lehenga", "frock"], tags: ["wedding"] }),
      R("shoes", "Shoes", 0.3, "shoes", { custom: ["party shoes"] }),
      R("hair", "Hair accessories", 0.15, "accessories", { custom: ["hair accessories"], optional: true }),
    ],
    party: [
      R("outfit", "Outfit", 0.55, "clothing", { custom: ["frock", "lehenga"], tags: ["party"] }),
      R("shoes", "Shoes", 0.3, "shoes", { custom: ["party shoes"] }),
      R("hair", "Hair accessories", 0.15, "accessories", { custom: ["hair accessories"], optional: true }),
    ],
    eid: [
      R("outfit", "Outfit", 0.6, "clothing", { custom: ["lehenga", "three-piece"], tags: ["eid"] }),
      R("shoes", "Shoes", 0.25, "shoes", { custom: ["party shoes"] }),
      R("hair", "Hair accessories", 0.15, "accessories", { custom: ["hair accessories"], optional: true }),
    ],
    casual: [
      R("outfit", "Outfit", 1, "clothing", { custom: ["casual set", "three-piece"], tags: ["casual"] }),
    ],
  },
  male_child: {
    eid: [
      R("outfit", "Panjabi set", 0.65, "clothing", { custom: ["panjabi set"], tags: ["eid"] }),
      R("shoes", "Shoes", 0.35, "shoes", { custom: ["dress shoes"] }),
    ],
    wedding: [
      R("outfit", "Panjabi set", 0.65, "clothing", { custom: ["panjabi set"], tags: ["wedding"] }),
      R("shoes", "Shoes", 0.35, "shoes", { custom: ["dress shoes"] }),
    ],
    party: [
      R("outfit", "Outfit", 0.65, "clothing", { custom: ["formal set"], tags: ["party"] }),
      R("shoes", "Shoes", 0.35, "shoes", { custom: ["dress shoes"] }),
    ],
    casual: [
      R("outfit", "Outfit", 1, "clothing", { custom: ["casual set"], tags: ["casual"] }),
    ],
  },
  female_elderly: { eid: FEMALE_ELDERLY, wedding: FEMALE_ELDERLY, party: FEMALE_ELDERLY, casual: FEMALE_ELDERLY },
  male_elderly: { eid: MALE_ELDERLY, wedding: MALE_ELDERLY, party: MALE_ELDERLY, casual: MALE_ELDERLY },
};

// Budget behaviour
export const UPGRADE_SLACK = 1.15;   // a slot may use up to share * budget * 1.15 when upgrading
export const TOO_HIGH_FACTOR = 1.5;  // budget above (most expensive possible look * this) = "too high"
