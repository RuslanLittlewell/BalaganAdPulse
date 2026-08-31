describe("web workspace", () => {
  it("runs vitest with jsdom", () => {
    expect(typeof window).toBe("object");
    expect(document.createElement("dialog").showModal).toBeTypeOf("function");
  });
});
