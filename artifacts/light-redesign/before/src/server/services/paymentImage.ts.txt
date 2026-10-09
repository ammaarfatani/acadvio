export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export function decodePaymentImage(value: unknown, maxBytes = MAX_SCREENSHOT_BYTES) {
  if (typeof value !== "string") throw { statusCode: 400, message: "Payment screenshot is required." };
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw { statusCode: 400, message: "Upload a JPG, PNG or WebP screenshot." };
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > maxBytes || bytes.toString("base64") !== match[2]) throw { statusCode: 400, message: "Image must be valid and within the allowed size limit." };
  const valid = match[1] === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw { statusCode: 400, message: "Screenshot content does not match its image format." };
  return { bytes, mime: match[1] };
}

