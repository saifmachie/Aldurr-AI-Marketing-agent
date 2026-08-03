const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');

function readConfig(filename) {
  return fs.readFileSync(path.join(CONFIG_DIR, filename), 'utf8');
}

module.exports = {
  brandBrief: () => readConfig('brand-brief.md'),
  agentSpec: () => readConfig('agent-spec.md'),
  dialectLexicon: () => readConfig('dialect-lexicon.md'),
};
