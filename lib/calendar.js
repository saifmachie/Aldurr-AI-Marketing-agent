// Deterministic date/slot computation for the quarterly batch workflow.
// Kept out of the strategist's LLM call entirely — "which dates get a post"
// is arithmetic, not judgment. The strategist only decides *what* to say on
// each already-computed slot.
const fs = require('fs');
const path = require('path');

const OCCASIONS_PATH = path.join(__dirname, '..', 'config', 'occasions-calendar.json');
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOT_WEEKDAYS = [0, 2, 4]; // Sunday, Tuesday, Thursday
const MAX_DISPLACEMENT_DAYS = 3;

function quarterIdentifier(date) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`;
}

function quarterRange(quarterId) {
  const match = quarterId.match(/^(\d{4})-Q([1-4])$/);
  if (!match) throw new Error(`Invalid quarter identifier "${quarterId}", expected e.g. "2026-Q3".`);
  const year = Number(match[1]);
  const q = Number(match[2]);
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0)); // last day of quarter
  return { start, end, year };
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function weekdaySlots(start, end) {
  const slots = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (SLOT_WEEKDAYS.includes(cursor.getUTCDay())) {
      slots.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return slots;
}

function loadOccasionsCalendar() {
  return JSON.parse(fs.readFileSync(OCCASIONS_PATH, 'utf8'));
}

function occasionsInRange(start, end, year) {
  const calendar = loadOccasionsCalendar();
  const occasions = [];

  for (const fixed of calendar.fixed) {
    const date = new Date(Date.UTC(year, fixed.month - 1, fixed.day));
    if (date >= start && date <= end) {
      occasions.push({ date, name: fixed.name, priority: fixed.priority, angle: fixed.angle, lunar: false });
    }
  }

  const unconfirmed = [];
  for (const lunar of calendar.lunar.occasions) {
    const dateStr = lunar.dates[String(year)];
    if (!dateStr) {
      unconfirmed.push(lunar.name);
      continue;
    }
    const date = new Date(`${dateStr}T00:00:00Z`);
    if (date >= start && date <= end) {
      occasions.push({
        date,
        name: lunar.name,
        priority: lunar.priority,
        angle: lunar.note,
        lunar: true,
        noCommercial: !!lunar.no_commercial,
        restrainedOnly: !!lunar.restrained_only,
      });
    }
  }

  return { occasions, unconfirmed };
}

function daysBetween(a, b) {
  return Math.abs((a.getTime() - b.getTime()) / 86400000);
}

// Assigns each occasion to its nearest available weekday slot (Thursday
// preferred, per the cadence's "Thursday flex" rule), displacing that
// evergreen slot rather than adding a fourth post. Slots left unmatched
// stay evergreen.
function assignSlots(slots, occasions) {
  const available = [...slots];
  const assigned = [];
  const unmatchedOccasions = [];

  const sortedOccasions = [...occasions].sort((a, b) => a.date - b.date);

  for (const occasion of sortedOccasions) {
    let best = null;
    let bestDistance = Infinity;
    for (const slot of available) {
      const distance = daysBetween(slot, occasion.date);
      if (distance > MAX_DISPLACEMENT_DAYS) continue;
      const isThursday = slot.getUTCDay() === 4;
      const score = distance - (isThursday ? 0.5 : 0); // prefer Thursday on ties
      if (score < bestDistance) {
        bestDistance = score;
        best = slot;
      }
    }
    if (!best) {
      unmatchedOccasions.push(occasion);
      continue;
    }
    available.splice(available.indexOf(best), 1);
    assigned.push({ date: best, type: 'occasion', occasion });
  }

  for (const slot of available) {
    assigned.push({ date: slot, type: 'evergreen' });
  }

  assigned.sort((a, b) => a.date - b.date);
  return { slots: assigned, unmatchedOccasions };
}

function buildQuarterSlots(quarterId) {
  const { start, end, year } = quarterRange(quarterId);
  const slots = weekdaySlots(start, end);
  const { occasions, unconfirmed } = occasionsInRange(start, end, year);
  const { slots: assigned, unmatchedOccasions } = assignSlots(slots, occasions);

  const result = assigned.map((s) => ({
    date: toISODate(s.date),
    day: DAY_NAMES[s.date.getUTCDay()],
    type: s.type,
    occasion: s.occasion
      ? {
          name: s.occasion.name,
          priority: s.occasion.priority,
          angle: s.occasion.angle,
          noCommercial: !!s.occasion.noCommercial,
          restrainedOnly: !!s.occasion.restrainedOnly,
        }
      : null,
  }));

  return { quarter: quarterId, slots: result, unconfirmedLunarOccasions: unconfirmed, unmatchedOccasions };
}

module.exports = {
  quarterIdentifier,
  quarterRange,
  weekdaySlots,
  occasionsInRange,
  assignSlots,
  buildQuarterSlots,
  toISODate,
  DAY_NAMES,
};
