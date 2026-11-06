import type { TariffGate } from "../../src/shared/application/index.js";

export const unlimitedTariffs: TariffGate = { assertCanAdd: async () => undefined };
