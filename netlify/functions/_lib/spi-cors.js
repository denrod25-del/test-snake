// SPI-local CORS — do not mutate Pro corsPreflight Allow-Headers globally.
const SPI_ALLOW_HEADERS = 'Authorization, X-Api-Key, Content-Type';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': SPI_ALLOW_HEADERS,
  };
}

function corsPreflight() {
  return {
    statusCode: 204,
    headers: corsHeaders(),
    body: '',
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}

module.exports = { corsHeaders, corsPreflight, json, SPI_ALLOW_HEADERS };
