import { describe, expect, it } from "vitest";
import { createApiRouter } from "../src/routes/index";

describe("canonical API route contract", () => {
  it("creates the versioned API router without throwing", () => {
    expect(createApiRouter()).toBeDefined();
  });

  it("keeps financial mutations out of the mounted router until production dependencies are connected", () => {
    const router = createApiRouter() as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }> };
    const routes = (router.stack ?? []).flatMap((layer) => layer.route ? [{ path: layer.route.path, methods: layer.route.methods }] : []);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/wallet");
    expect(paths).not.toContain("/wallet/deposit");
    expect(paths).not.toContain("/wallet/withdrawal");
  });
});
