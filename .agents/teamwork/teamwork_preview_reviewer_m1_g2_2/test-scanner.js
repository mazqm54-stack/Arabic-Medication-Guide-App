import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_RULES = [
  { name: 'Google Gemini API Key Pattern (AIza...)', regex: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'Literal AIzaSy Prefix', regex: /AIzaSy[0-9A-Za-z-_]{5,}/g },
  { name: 'Legacy API Key LocalStorage Identifier', regex: /dalili_gemini_api_key_v1/g },
  { name: 'Obsolete ApiKeyModal Component Reference', regex: /ApiKeyModal/g },
  { name: 'Obsolete apiKeyStorage Service Reference', regex: /apiKeyStorage/g },
  { name: 'Direct Upstream Gemini Endpoint Call in Client', regex: /generativelanguage\.googleapis\.com/g },
];

const testCases = [
  { input: 'const key = "AIzaSyD-7389423874982347982347923487239";', shouldMatch: true },
  { input: 'localStorage.removeItem("dalili_gemini_api_key_v1");', shouldMatch: true },
  { input: 'import ApiKeyModal from "./components/ApiKeyModal";', shouldMatch: true },
  { input: 'import { save } from "./apiKeyStorage";', shouldMatch: true },
  { input: 'const url = "https://generativelanguage.googleapis.com/v1beta/models";', shouldMatch: true },
  { input: 'const safe = "This is clean code with no secrets";', shouldMatch: false },
];

let allPassed = true;
for (const tc of testCases) {
  let matched = false;
  for (const rule of FORBIDDEN_RULES) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(tc.input)) {
      matched = true;
      break;
    }
  }
  if (matched !== tc.shouldMatch) {
    console.error(`Mismatch for: ${tc.input} (expected ${tc.shouldMatch}, got ${matched})`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log('PASS: All synthetic positive and negative test cases matched expectations!');
} else {
  process.exit(1);
}
