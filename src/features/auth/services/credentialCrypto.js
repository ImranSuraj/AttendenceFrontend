import { getPublicKey } from "../controllers/auth.controller";

// Keeps the Employee No and the password out of the request in plain text. The server publishes a public key; here the typed values are encrypted with it
// (RSA-OAEP, SHA-256, through the browser's own Web Crypto) together with the time and a one-time number, and only the encrypted text is sent. Only the server
// holds the private key. The browser allows Web Crypto only on a secure page (https, or localhost) - which a Teams tab always is.

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));

let cached = null; // { keyId, key, loadedAt }
const KEY_MAX_AGE_MS = 10 * 60 * 1000;

async function loadKey(force = false) {
  if (!window.crypto?.subtle) {
    throw new Error("Secure sign-in needs a secure (https) connection. Please open the application using its https address.");
  }
  if (!force && cached && Date.now() - cached.loadedAt < KEY_MAX_AGE_MS) return cached;

  const res = await getPublicKey();
  const { keyId, publicKey } = res.data.data;
  const key = await window.crypto.subtle.importKey("spki", b64ToBytes(publicKey), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  cached = { keyId, key, loadedAt: Date.now() };
  return cached;
}

async function encryptWith(loaded, values) {
  const nonce = bytesToB64(window.crypto.getRandomValues(new Uint8Array(16)));
  const payload = JSON.stringify({ e: values.empNo, p: values.password, o: values.otp, t: Date.now(), n: nonce });
  const cipher = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, loaded.key, new TextEncoder().encode(payload));
  return { keyId: loaded.keyId, data: bytesToB64(new Uint8Array(cipher)) };
}

/**
 * Encrypts { empNo?, password?, otp? } and hands { keyId, data } to send(). When the server says the key is out of date (HTTP 409: it was replaced, or the clock of this
 * device is far off) the key is fetched again and the call is made once more.
 */
export async function sendEncrypted(values, send) {
  try {
    return await send(await encryptWith(await loadKey(), values));
  } catch (err) {
    if (err?.response?.status !== 409) throw err;
    return send(await encryptWith(await loadKey(true), values));
  }
}
