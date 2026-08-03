// Deliberately minimal. The architecture spec calls for "notify" at several
// halt points but never specifies a channel (email/Slack/WhatsApp) — that's
// real ops wiring for whoever runs this, not something to invent here.
// This prints loud enough that a human running the cron job's logs will see
// it, and that's the whole contract for Phase 3.
function notify(message) {
  const line = '='.repeat(60);
  console.log(`\n${line}\nNOTIFY: ${message}\n${line}\n`);
}

module.exports = { notify };
