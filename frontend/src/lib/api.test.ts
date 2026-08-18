import { afterEach, describe, expect, it, vi } from "vitest";
import { getStocks } from "@/lib/api";

describe("getStocks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the universe endpoint with pagination and parses the payload", async () => {
    const payload = {
      items: [
        { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
        { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getStocks(1, 20);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/stocks?page=1&page_size=20",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      ticker: "BBCA",
      name: "Bank Central Asia",
      board: "Utama",
    });
    expect(result.total).toBe(2);
    expect(result.page_size).toBe(20);
  });
});
