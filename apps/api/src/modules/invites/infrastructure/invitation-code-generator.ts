import { randomInt } from "node:crypto";
import type { InvitationCodeGenerator } from "../application/ports.js";

export const INVITATION_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const INVITATION_CODE_LENGTH = 8;

export class CryptoInvitationCodeGenerator implements InvitationCodeGenerator {
  generate(): string {
    let code = "";
    for (let index = 0; index < INVITATION_CODE_LENGTH; index += 1) {
      code += INVITATION_CODE_ALPHABET[randomInt(INVITATION_CODE_ALPHABET.length)];
    }
    return code;
  }
}
