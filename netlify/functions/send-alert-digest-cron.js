// Scheduled wrapper — Netlify blocks public HTTP on functions with a cron schedule.
const { runAlertDigest } = require('./_lib/alert-digest');

exports.handler = async () => {
  try {
    const result = await runAlertDigest();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
