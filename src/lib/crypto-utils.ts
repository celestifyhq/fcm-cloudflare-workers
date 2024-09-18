function pemToArrayBuffer(pem: string): ArrayBuffer {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\n/g, "");

  const binaryString = atob(pemContents);
  const binaryLength = binaryString.length;
  const bytes = new Uint8Array(binaryLength);

  for (let i = 0; i < binaryLength; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyBuffer = pemToArrayBuffer(pem);

  return await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );
}

async function createJWT(payload: any, privateKey: string): Promise<string> {
  const encoder = new TextEncoder();

  const encodeBase64Url = (data: string): string => {
    return btoa(data)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const headerJson = JSON.stringify(header);
  const payloadJson = JSON.stringify(payload);

  const headerBase64Url = encodeBase64Url(headerJson);
  const payloadBase64Url = encodeBase64Url(payloadJson);

  const unsignedToken = `${headerBase64Url}.${payloadBase64Url}`;

  const cryptoKey = await importPrivateKey(privateKey);

  const signature = await crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureBase64Url = encodeBase64Url(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${unsignedToken}.${signatureBase64Url}`;
}

export { createJWT };