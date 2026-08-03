const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', 'state', 'current-run.json');

function readState() {
  if (!fs.existsSync(STATE_PATH)) return null;
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  return state;
}

function clearState() {
  if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
}

module.exports = { readState, writeState, clearState, STATE_PATH };
