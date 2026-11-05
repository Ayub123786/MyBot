import { describe, expect, it } from "vitest";

import { ChatToolCalls } from "./openai-chat-protocol.ts";

const completeCall = {
  id: "call_echo",
  type: "function",
  function: { name: "echo", arguments: "{}" },
};

describe("streamed chat tool calls", () => {
  it("treats explicit null continuation fields as absent", () => {
    const calls = new ChatToolCalls();
    calls.add([{ index: 0, ...completeCall, function: { ...completeCall.function, arguments: "" } }], true);
    calls.add([{ index: 0, id: null, type: null, function: { name: null, arguments: null } }], true);
    calls.add([{ index: 0, id: null, function: { name: null, arguments: "{}" } }], true);

    expect(calls.finish("tool_calls", false)).toEqual([completeCall]);
  });

  it("tolerates omitted index in streaming mode (Google Gemini compatible)", () => {
    const calls = new ChatToolCalls();
    calls.add([{ ...completeCall, function: { ...completeCall.function, arguments: "{}" } }], true);
    expect(calls.finish("tool_calls", false)).toEqual([completeCall]);
  });

  it("handles multiple tool calls streamed without index in separate chunks (Google Gemini pattern)", () => {
    const calls = new ChatToolCalls();
    calls.add([{ id: "call_1", type: "function", function: { name: "get_weather", arguments: "{\"city\":\"Tokyo\"}" }, extra_content: { google: { thought_signature: "sig1" } } }], true);
    calls.add([{ id: "call_2", type: "function", function: { name: "get_time", arguments: "{\"tz\":\"JST\"}" } }], true);
    expect(calls.finish("stop", false)).toEqual([
      { id: "call_1", type: "function", function: { name: "get_weather", arguments: "{\"city\":\"Tokyo\"}" }, extra_content: { google: { thought_signature: "sig1" } } },
      { id: "call_2", type: "function", function: { name: "get_time", arguments: "{\"tz\":\"JST\"}" } },
    ]);
  });

  it("tolerates empty id during streaming and assigns synthetic id", () => {
    const calls = new ChatToolCalls();
    calls.add([{ id: "", type: "function", function: { name: "echo", arguments: "{}" } }], true);
    const result = calls.finish("stop", false);
    expect(result).toHaveLength(1);
    expect(result[0].id).toMatch(/^call_synthetic_/);
    expect(result[0].function.name).toBe("echo");
  });

  it("still rejects incomplete calls after null-only deltas", () => {
    const calls = new ChatToolCalls();
    calls.add([{ index: 0, id: null, type: null, function: { name: null, arguments: null } }], true);

    expect(() => calls.finish("tool_calls", false)).toThrow(/incomplete or duplicate/);
  });

  it.each([
    { index: 0, type: "computer" },
    { index: 0, function: null },
    { index: 0, function: [] },
    { index: 0, function: { name: 1 } },
    { index: 0, function: { arguments: 1 } },
  ])("rejects unsupported or malformed continuation fields", (delta) => {
    const calls = new ChatToolCalls();
    expect(() => calls.add([delta], true)).toThrow();
  });

  it.each([
    { id: "call_large_name", name: "n".repeat(65), arguments: "{}" },
    { id: "call_large_args", name: "echo", arguments: "x".repeat(256_001) },
  ])("preserves tool-call size limits", ({ id, name, arguments: args }) => {
    const calls = new ChatToolCalls();
    expect(() => calls.add([{ index: 0, id, function: { name, arguments: args } }], true)).toThrow(/size limit/);
  });
});

describe("tool calls per reply", () => {
  it("accepts 32 calls in one reply and refuses a 33rd", () => {
    const calls = new ChatToolCalls();
    calls.add(Array.from({ length: 32 }, (_, index) => ({ index, ...completeCall, id: `call_${index}` })), true);
    expect(calls.finish("tool_calls", false)).toHaveLength(32);
    expect(() => new ChatToolCalls().add([{ index: 32, ...completeCall }], true)).toThrow(/invalid tool-call index/);
  });
});

describe("complete chat tool calls", () => {
  it.each([
    { ...completeCall, id: null },
    { ...completeCall, type: null },
    { ...completeCall, function: null },
    { ...completeCall, function: { ...completeCall.function, name: null } },
    { ...completeCall, function: { ...completeCall.function, arguments: null } },
  ])("rejects null required fields in non-streaming responses", (call) => {
    const calls = new ChatToolCalls();
    expect(() => calls.add([call], false)).toThrow();
  });
});
