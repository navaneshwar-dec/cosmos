import officeCrypto from 'officecrypto-tool';

// Decrypts a password-protected MS Office file (xlsx/xls). Plain (ZIP "PK") files
// pass through unchanged, so a source without a real password still works.
export async function decryptOffice(buffer, password) {
  if (buffer && buffer[0] === 0x50 && buffer[1] === 0x4b) return buffer; // "PK" → already plain
  if (!password) throw new Error('This file is password-protected — set the source password.');
  return officeCrypto.decrypt(buffer, { password });
}
