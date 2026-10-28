import { randomInt } from "node:crypto";
import type { CredentialGenerator } from "../application/ports.js";

export const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PASSWORD_LENGTH = 12;
const LOGIN_DIGITS = 4;

const drawn = (alphabet: string, length: number) =>
  Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");

export class CryptoCredentialGenerator implements CredentialGenerator {
  loginDigits(): string {
    return drawn("0123456789", LOGIN_DIGITS);
  }

  password(): string {
    return drawn(PASSWORD_ALPHABET, PASSWORD_LENGTH);
  }
}
