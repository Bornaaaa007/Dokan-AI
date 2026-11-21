// Parses a budget in BDT from free text.
// Returns a whole number, or null when the budget is unclear (the stylist should then ask).
// Bangla characters are written as escapes so the file stays plain ASCII.

function normalize(input) {
  return input
    .toLowerCase()
    .replace(/[\u09E6-\u09EF]/g, (d) => String(d.charCodeAt(0) - 0x09e6)) // Bangla digits
    .replace(/[\u09f2\u09f3]/g, ' tk ')                // taka sign
    .replace(/\u09b9\u09be\u099c\u09be\u09b0/g, ' hazar ')
    .replace(/\u09b2\u09be\u0996/g, ' lakh ')
    .replace(/\u099f\u09be\u0995\u09be/g, ' taka ')
    .replace(/\u09ac\u099b\u09b0/g, ' years ')
    .replace(/(\d),(?=\d)/g, '$1');                    // 5,000 and 1,00,000
}

const NUMBER = /(\d+(?:\.\d+)?)(?:\s*(k|thousand|ha[zj]a{1,2}r|lakhs?|lacs?)(?![a-z]))?/g;
const unitMultiplier = (u) => (/^(lakhs?|lacs?)$/.test(u) ? 100000 : 1000);

export function parseBudget(input) {
  if (typeof input !== 'string') return null;
  const text = normalize(input);
  const found = [];

  for (const m of text.matchAll(NUMBER)) {
    const start = m.index;
    const end = start + m[0].length;
    const before = text.slice(Math.max(0, start - 20), start);
    const after = text.slice(end, end + 12);

    // Skip ages like "10 year old" or "age 25"
    const isAge =
      /^\s*(?:year|years|yr|yrs|yo|y\/o|month|months)\b/.test(after) ||
      /\bage\s*(?:is|:)?\s*$/.test(before);
    if (isAge) continue;

    const value = Math.round(parseFloat(m[1]) * (m[2] ? unitMultiplier(m[2]) : 1));
    const cue =
      Boolean(m[2]) ||
      /\b(?:taka|tk|bdt)\.?\s*$/.test(before) ||
      /^\s*(?:taka|tk|bdt)\b/.test(after) ||
      /\b(?:budget|under|below|within|max|maximum|upto|up to)\s*(?:is|of|:|=)?\s*$/.test(before);
    found.push({ value, cue });
  }

  // Prefer numbers that look like money; otherwise accept plain numbers of 100 or more
  const withCue = found.filter((f) => f.cue);
  const pool = withCue.length ? withCue : found.filter((f) => f.value >= 100);
  const values = [...new Set(pool.map((f) => f.value))];
  return values.length === 1 && values[0] > 0 ? values[0] : null;
}
