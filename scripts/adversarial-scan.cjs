const fs = require('fs');
const path = require('path');

const root = process.cwd();
const ignoreDirs = new Set(['node_modules', '.git', '.agents']);

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    if (ignoreDirs.has(dirent.name)) continue;
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

const allFiles = walk(root);
console.log('Total files scanned across repo:', allFiles.length);

const rules = [
  { name: 'Google API Key (AIza...)', regex: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'Literal AIzaSy Prefix', regex: /AIzaSy[0-9A-Za-z-_]{5,}/g },
  { name: 'Generic API Key / Token Assignment', regex: /(?:api_key|apikey|secret|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi },
  { name: 'Demo Key Token', regex: /(?:demo|sample|fake)[_-]?key[_-]?[a-zA-Z0-9]*/gi },
  { name: 'Direct Gemini Endpoint (generativelanguage)', regex: /generativelanguage\.googleapis\.com/g },
  { name: 'Any googleapis.com Endpoint', regex: /[a-zA-Z0-9.-]*googleapis\.com/g },
  { name: 'Any gstatic.com Endpoint', regex: /[a-zA-Z0-9.-]*gstatic\.com/g },
  { name: 'Legacy LocalStorage Identifier', regex: /dalili_gemini_api_key_v1/g },
  { name: 'Obsolete ApiKeyModal', regex: /ApiKeyModal/g },
  { name: 'Obsolete apiKeyStorage', regex: /apiKeyStorage/g }
];

const matches = [];

for (const file of allFiles) {
  if (/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|eot)$/i.test(file)) continue;
  // Ignore our own scanner script
  if (file.endsWith('adversarial-scan.cjs')) continue;

  const rel = path.relative(root, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    let m;
    while ((m = rule.regex.exec(content)) !== null) {
      matches.push({
        rule: rule.name,
        file: rel,
        matched: m[0]
      });
    }
  }
}

console.log('Total matches found:', matches.length);
matches.forEach(m => console.log(`  [${m.rule}] in ${m.file} -> "${m.matched}"`));
