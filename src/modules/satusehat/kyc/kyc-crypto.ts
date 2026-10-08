import {
  constants,
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';

/**
 * Amplop enkripsi KYC SATUSEHAT (Juknis KYC v6.4 + Library KYC resmi):
 * kunci AES-256 acak dibungkus RSA-OAEP (SHA-256) dengan public key
 * penerima, pesan dienkripsi AES-256-GCM, lalu
 * `wrappedKey(256) + iv(12) + ciphertext + tag(16)` di-base64 dan diapit
 * `-----BEGIN/END ENCRYPTED MESSAGE-----`.
 */
const BEGIN_TAG = '-----BEGIN ENCRYPTED MESSAGE-----';
const END_TAG = '-----END ENCRYPTED MESSAGE-----';
const WRAPPED_KEY_LENGTH = 256; // RSA 2048-bit
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Public key SATUSEHAT untuk KYC (tercantum di Juknis/dokumentasi KYC dan
 * library resmi). Bisa diganti lewat env SATUSEHAT_KYC_PUBLIC_KEY bila
 * Kemenkes merilis kunci lain (mis. untuk Production).
 */
export const DEFAULT_KYC_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwqoicEXIYWYV3PvLIdvB
qFkHn2IMhPGKTiB2XA56enpPb0UbI9oHoetRF41vfwMqfFsy5Yd5LABxMGyHJBbP
+3fk2/PIfv+7+9/dKK7h1CaRTeT4lzJBiUM81hkCFlZjVFyHUFtaNfvQeO2OYb7U
kK5JrdrB4sgf50gHikeDsyFUZD1o5JspdlfqDjANYAhfz3aam7kCjfYvjgneqkV8
pZDVqJpQA3MHAWBjGEJ+R8y03hs0aafWRfFG9AcyaA5Ct5waUOKHWWV9sv5DQXmb
EAoqcx0ZPzmHJDQYlihPW4FIvb93fMik+eW8eZF3A920DzuuFucpblWU9J9o5w+2
oQIDAQAB
-----END PUBLIC KEY-----`;

export function kycPublicKey(): string {
  const env = process.env.SATUSEHAT_KYC_PUBLIC_KEY?.trim();
  return env ? env.replace(/\\n/g, '\n') : DEFAULT_KYC_PUBLIC_KEY;
}

/** Pasangan RSA 2048 baru per sesi KYC (public key dikirim ke SATUSEHAT). */
export function generateKycKeyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

/** Setara `chunk_split($b64, 76, "\r\n")` PHP. */
function chunkSplit(b64: string): string {
  let out = '';
  for (let i = 0; i < b64.length; i += 76) out += `${b64.slice(i, i + 76)}\r\n`;
  return out;
}

export function isEncryptedMessage(text: string): boolean {
  return text.trimStart().startsWith(BEGIN_TAG);
}

export function encryptKycMessage(message: string, publicKeyPem: string) {
  const aesKey = randomBytes(32);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(message, 'utf8'),
    cipher.final(),
  ]);
  const wrappedKey = publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey,
  );
  const payload = Buffer.concat([
    wrappedKey,
    iv,
    ciphertext,
    cipher.getAuthTag(),
  ]);
  return `${BEGIN_TAG}\r\n${chunkSplit(payload.toString('base64'))}${END_TAG}`;
}

export function decryptKycMessage(message: string, privateKeyPem: string) {
  const payload = Buffer.from(
    message.replace(BEGIN_TAG, '').replace(END_TAG, '').replace(/\s/g, ''),
    'base64',
  );
  if (payload.length < WRAPPED_KEY_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('Pesan terenkripsi KYC tidak valid');
  }
  const wrappedKey = payload.subarray(0, WRAPPED_KEY_LENGTH);
  const rest = payload.subarray(WRAPPED_KEY_LENGTH);
  const iv = rest.subarray(0, IV_LENGTH);
  const tag = rest.subarray(rest.length - TAG_LENGTH);
  const ciphertext = rest.subarray(IV_LENGTH, rest.length - TAG_LENGTH);
  const aesKey = privateDecrypt(
    {
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    wrappedKey,
  );
  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
