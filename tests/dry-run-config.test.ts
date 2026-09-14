import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/config/env";
import { getAppSettings } from "@/lib/db/settings";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { appSetting: { findUnique } },
}));

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://researchreach:test@127.0.0.1:5432/postgres");
  vi.stubEnv("DRY_RUN", "true");
  vi.stubEnv("AUTO_SEND", "false");
  vi.stubEnv("GUESS_EMAILS", "false");
  resetEnvCache();
  findUnique.mockReset();
  findUnique.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("production environment safety flag parsing", () => {
  it("defaults an absent DRY_RUN to true", () => {
    delete process.env.DRY_RUN;
    resetEnvCache();
    expect(getEnv().DRY_RUN).toBe(true);
  });

  it.each(["", "falsee", "2", "null", "disabled"])(
    "rejects malformed DRY_RUN=%j instead of enabling live sending",
    (value) => {
      vi.stubEnv("DRY_RUN", value);
      resetEnvCache();
      expect(() => getEnv()).toThrow();
    },
  );

  it.each(["true", "TRUE", " true ", "1", "yes", "on"])(
    "accepts explicit true alias %j",
    (value) => {
      vi.stubEnv("DRY_RUN", value);
      resetEnvCache();
      expect(getEnv().DRY_RUN).toBe(true);
    },
  );

  it.each(["false", "FALSE", " false ", "0", "no", "off"])(
    "retains intentional explicit false alias %j",
    (value) => {
      vi.stubEnv("DRY_RUN", value);
      resetEnvCache();
      expect(getEnv().DRY_RUN).toBe(false);
    },
  );

  it("rejects malformed autopilot values", () => {
    vi.stubEnv("AUTO_SEND", "tru");
    resetEnvCache();
    expect(() => getEnv()).toThrow();
  });
});

describe("production persisted dry-run settings", () => {
  it.each(["", "garbage", "FALSE", "0", "null", "true"])(
    "keeps dry run enabled for persisted value %j",
    async (value) => {
      findUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
        where.key === "DRY_RUN" ? { value } : null,
      );
      expect((await getAppSettings()).DRY_RUN).toBe(true);
    },
  );

  it("allows the canonical persisted false value", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === "DRY_RUN" ? { value: "false" } : null,
    );
    expect((await getAppSettings()).DRY_RUN).toBe(false);
  });

  it("uses the true environment default when no database override exists", async () => {
    expect((await getAppSettings()).DRY_RUN).toBe(true);
  });

  it("honors an explicit false environment value without a database override", async () => {
    vi.stubEnv("DRY_RUN", "false");
    resetEnvCache();
    expect((await getAppSettings()).DRY_RUN).toBe(false);
  });
});
