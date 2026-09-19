const crypto = require('crypto');
const { cleanEnv } = require('./config');

function encryptionKey() {
  const secret = cleanEnv('SPI_KEY_ENCRYPTION_SECRET');
  if (!secret) {
    const err = new Error('SPI_KEY_ENCRYPTION_SECRET missing');
    err.statusCode = 500;
    throw err;
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/** AES-256-GCM; returns base64(iv + tag + ciphertext). */
function encryptSpiKey(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptSpiKey(ciphertextB64) {
  const buf = Buffer.from(String(ciphertextB64), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { encryptSpiKey, decryptSpiKey };
