function json(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      ...extra,
    },
    body: JSON.stringify(body),
  };
}

function cleanEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : '';
}

function getBearer(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : '';
}

module.exports = { json, cleanEnv, getBearer };
