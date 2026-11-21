import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBudget } from './budget.mjs';

const cases = [
  // formats from the requirements
  ['5k', 5000],
  ['5K', 5000],
  ['5.5k', 5500],
  ['5000', 5000],
  ['5000 taka', 5000],
  ['5,000 tk', 5000],
  ['Tk. 5000', 5000],
  ['BDT 5000', 5000],
  ['5000/-', 5000],
  ['5 hazar', 5000],
  ['5 hajar', 5000],
  ['5 thousand', 5000],
  ['1 lakh', 100000],
  ['1.5 lakh', 150000],
  ['1,00,000 taka', 100000],
  ['100 taka', 100],
  // Bangla digits and words
  ['\u09EB\u09E6\u09E6\u09E6', 5000],
  ['\u09EB\u09E6\u09E6\u09E6 \u099F\u09BE\u0995\u09BE', 5000],
  ['\u09EB \u09B9\u09BE\u099C\u09BE\u09B0', 5000],
  ['\u09E7 \u09B2\u09BE\u0996', 100000],
  ['\u09F3 5,000', 5000],
  // inside real sentences, with ages and counts that are not budgets
  ['I want a wedding outfit under 5000 taka', 5000],
  ['budget 5k for my 10 year old daughter', 5000],
  ['I am 25 years old, budget 5000', 5000],
  ['age 25 budget 4000', 4000],
  ['wedding for 3 people, budget 5k', 5000],
  ['2 sets, 5k total', 5000],
  // unclear: the stylist must ask instead of guessing
  ['', null],
  ['hello', null],
  ['not too expensive', null],
  ['0', null],
  ['5', null],
  ['I need 5 kurti', null],
  ['outfit for 3000 and 4000', null],
  [null, null],
  [undefined, null],
];

for (const [text, expected] of cases) {
  test(`parseBudget(${JSON.stringify(text)}) -> ${expected}`, () => {
    assert.equal(parseBudget(text), expected);
  });
}
