import { randomUUID } from "node:crypto";
import type { IdGenerator } from "../application/id-generator.js";

export class RandomIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

export class DeterministicIdGenerator implements IdGenerator {
  private position = 0;

  constructor(private readonly ids: readonly string[]) {}

  generate(): string {
    const id = this.ids[this.position++];
    if (id === undefined) throw new Error("Deterministic id sequence exhausted");
    return id;
  }
}
