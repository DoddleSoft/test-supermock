// ============================================================
// CONSTANTS FOR GRADING ENGINE
// ============================================================

export const GRADING_VERSION = "2.1.0";

// ============================================================
// NUMBER ↔ WORD NORMALIZATION MAP
// ============================================================

export const NUMBER_WORD_TO_DIGIT: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
  thousand: "1000",
  first: "1st",
  second: "2nd",
  third: "3rd",
  fourth: "4th",
  fifth: "5th",
  sixth: "6th",
  seventh: "7th",
  eighth: "8th",
  ninth: "9th",
  tenth: "10th",
};

// Build reverse map: digit → word
export const DIGIT_TO_NUMBER_WORD: Record<string, string> = {};
for (const [word, digit] of Object.entries(NUMBER_WORD_TO_DIGIT)) {
  DIGIT_TO_NUMBER_WORD[digit] = word;
}

// Compound numbers like "twenty one" → "21", "twenty-one" → "21"
export const COMPOUND_NUMBER_WORDS: Record<string, string> = {};
const TENS = [
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const ONES = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];
for (const ten of TENS) {
  const tenVal = parseInt(NUMBER_WORD_TO_DIGIT[ten]);
  for (const one of ONES) {
    const oneVal = parseInt(NUMBER_WORD_TO_DIGIT[one]);
    const total = (tenVal + oneVal).toString();
    COMPOUND_NUMBER_WORDS[`${ten} ${one}`] = total;
    COMPOUND_NUMBER_WORDS[`${ten}-${one}`] = total;
    COMPOUND_NUMBER_WORDS[`${ten}${one}`] = total;
  }
}

// ============================================================
// OFFICIAL IELTS BAND SCORE CONVERSION TABLES
// ============================================================

export const IELTS_LISTENING_BANDS: Record<number, number> = {
  40: 9.0,
  39: 9.0,
  38: 8.5,
  37: 8.5,
  36: 8.0,
  35: 8.0,
  34: 7.5,
  33: 7.5,
  32: 7.5,
  31: 7.0,
  30: 7.0,
  29: 6.5,
  28: 6.5,
  27: 6.5,
  26: 6.5,
  25: 6.0,
  24: 6.0,
  23: 6.0,
  22: 5.5,
  21: 5.5,
  20: 5.5,
  19: 5.5,
  18: 5.5,
  17: 5.0,
  16: 5.0,
  15: 5.0,
  14: 5.0,
  13: 5.0,
  12: 4.5,
  11: 4.5,
  10: 4.5,
  9: 4.0,
  8: 4.0,
  7: 4.0,
  6: 4.0,
  5: 3.5,
  4: 3.5,
  3: 3.0,
  2: 3.0,
  1: 2.5,
  0: 1.0,
};

export const IELTS_READING_BANDS: Record<number, number> = {
  40: 9.0,
  39: 9.0,
  38: 8.5,
  37: 8.5,
  36: 8.0,
  35: 8.0,
  34: 7.5,
  33: 7.5,
  32: 7.0,
  31: 7.0,
  30: 7.0,
  29: 6.5,
  28: 6.5,
  27: 6.5,
  26: 6.0,
  25: 6.0,
  24: 6.0,
  23: 6.0,
  22: 5.5,
  21: 5.5,
  20: 5.5,
  19: 5.5,
  18: 5.0,
  17: 5.0,
  16: 5.0,
  15: 5.0,
  14: 4.5,
  13: 4.5,
  12: 4.5,
  11: 4.0,
  10: 4.0,
  9: 4.0,
  8: 3.5,
  7: 3.5,
  6: 3.5,
  5: 3.0,
  4: 3.0,
  3: 2.5,
  2: 2.5,
  1: 2.0,
  0: 1.0,
};

// ============================================================
// MODULE ORDER & FLOW
// ============================================================

export const MODULE_ORDER = ["listening", "reading", "writing"] as const;
