import { describe, expect, it } from "vitest";
import { formatBrazilianPhone, phoneDigits } from "@/lib/utils/phone";

describe("telefone brasileiro", () => {
  it("aplica a máscara para celular com DDD", () => {
    expect(formatBrazilianPhone("16999991234")).toBe("(16) 99999-1234");
  });

  it("remove caracteres que não são números", () => {
    expect(phoneDigits("(16) 99999-1234")).toBe("16999991234");
  });
});
