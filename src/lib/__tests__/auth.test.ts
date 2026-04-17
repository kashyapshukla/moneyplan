jest.mock("@/lib/db", () => ({
  db: {},
}));

jest.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: jest.fn(() => ({})),
}));

jest.mock("next-auth/providers/google", () => {
  const Google = jest.fn(() => ({ id: "google", type: "oauth" }));
  return { __esModule: true, default: Google };
});

jest.mock("next-auth/providers/credentials", () => {
  const Credentials = jest.fn(() => ({ id: "credentials", type: "credentials" }));
  return { __esModule: true, default: Credentials };
});

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn(),
}));

jest.mock("next-auth", () => {
  const mockNextAuth = jest.fn(() => ({
    handlers: { GET: jest.fn(), POST: jest.fn() },
    auth: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  }));
  return { __esModule: true, default: mockNextAuth };
});

import NextAuth from "next-auth";

describe("authConfig", () => {
  beforeEach(() => {
    (NextAuth as jest.Mock).mockClear();
  });

  it("calls NextAuth with config that has Google and credentials providers", () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../auth");
    });
    expect(NextAuth).toHaveBeenCalled();
    const config = (NextAuth as jest.Mock).mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providerIds = config.providers.map((p: any) => p.id ?? p.type ?? p.name);
    expect(providerIds).toContain("google");
    expect(providerIds.some((id: string) => id?.toLowerCase().includes("credential"))).toBe(true);
  });

  it("sets sign-in page to /sign-in", () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../auth");
    });
    const config = (NextAuth as jest.Mock).mock.calls[0][0];
    expect(config.pages?.signIn).toBe("/sign-in");
  });

  it("uses database session strategy", () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../auth");
    });
    const config = (NextAuth as jest.Mock).mock.calls[0][0];
    expect(config.session?.strategy).toBe("database");
  });
});
