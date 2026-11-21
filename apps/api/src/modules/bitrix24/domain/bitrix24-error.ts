export type Bitrix24ErrorKind = "AUTH" | "RATE" | "TRANSIENT" | "NOT_FOUND" | "REFUSED";

export class Bitrix24Error extends Error {
  constructor(readonly kind: Bitrix24ErrorKind, message: string) {
    super(message);
    this.name = "Bitrix24Error";
  }
}
