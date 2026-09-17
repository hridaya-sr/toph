// No "server-only" guard here (unlike queries.ts/dal.ts) — this needs to be
// importable from the standalone seed script too, not just Next.js server
// code. It's never usable from a browser bundle regardless, since Node's
// crypto module isn't resolvable there.
import { randomBytes } from "crypto";

// Excludes visually ambiguous characters (0/O, 1/I/L) since this code is
// meant to be read aloud or typed by hand. 12 characters from this 33-char
// alphabet is ~60 bits of entropy — with no rate limiting anywhere in this
// app yet, that entropy is the only real defense against someone brute-
// forcing their way into a farm, so it needs to come from a CSPRNG
// (crypto.randomBytes), not Math.random().
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;

export function generateJoinCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
