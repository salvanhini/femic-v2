import { afterEach, describe, expect, it } from "vitest";
import { configureClinicalAi, getClinicalAiConfig } from "@/lib/ai/clinical-ai";

describe("configuração local de IA", () => {
  afterEach(() => localStorage.clear());

  it("salva provedor, chave e modelo no navegador", () => {
    configureClinicalAi({
      provider: "groq",
      apiKey: "gsk_teste",
      model: "llama-3.3-70b-versatile",
    });

    expect(getClinicalAiConfig()).toEqual({
      provider: "groq",
      apiKey: "gsk_teste",
      model: "llama-3.3-70b-versatile",
    });
  });
});
