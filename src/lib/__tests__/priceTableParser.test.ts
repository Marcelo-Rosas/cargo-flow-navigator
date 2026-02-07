import { describe, it, expect } from "vitest";
import {
  parseKmRange,
  parseKmStrict,
  parseCSVPriceTable,
  parseCSVIcms,
} from "../priceTableParser";

describe("parseKmRange", () => {
  it("parses simple range '0-100'", () => {
    expect(parseKmRange("0-100")).toEqual({ from: 0, to: 100 });
  });

  it("parses range with spaces '101 - 200'", () => {
    expect(parseKmRange("101 - 200")).toEqual({ from: 101, to: 200 });
  });

  it("parses Brazilian format '1.001-1.100'", () => {
    expect(parseKmRange("1.001-1.100")).toEqual({ from: 1001, to: 1100 });
  });

  it("parses range with en-dash '500–600'", () => {
    expect(parseKmRange("500–600")).toEqual({ from: 500, to: 600 });
  });

  it("returns null for empty input", () => {
    expect(parseKmRange("")).toBeNull();
    expect(parseKmRange(null)).toBeNull();
    expect(parseKmRange(undefined)).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseKmRange("abc")).toBeNull();
  });
});

describe("parseKmStrict", () => {
  it("parses simple integer", () => {
    expect(parseKmStrict("100")).toBe(100);
  });

  it("parses Brazilian thousands format '1.000'", () => {
    expect(parseKmStrict("1.000")).toBe(1000);
  });

  it("parses Brazilian format '1.500'", () => {
    expect(parseKmStrict("1.500")).toBe(1500);
  });

  it("parses number input", () => {
    expect(parseKmStrict(250)).toBe(250);
  });

  it("returns null for empty input", () => {
    expect(parseKmStrict("")).toBeNull();
    expect(parseKmStrict(null)).toBeNull();
  });
});

describe("parseCSVPriceTable", () => {
  it("parses valid CSV with separate km columns", () => {
    const csv = [
      "km_from;km_to;custo_ton;gris%",
      "0;100;150,50;0,3",
      "101;200;180,00;0,3",
    ].join("\n");

    const result = parseCSVPriceTable(csv);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].km_from).toBe(0);
    expect(result.rows[0].km_to).toBe(100);
    expect(result.rows[0].cost_per_ton).toBe(150.5);
    expect(result.rows[0].gris_percent).toBe(0.3);
  });

  it("parses CSV with range column", () => {
    const csv = ["faixa_km;custo_ton", "0-100;200", "101-200;250"].join("\n");

    const result = parseCSVPriceTable(csv);

    expect(result.totalRows).toBe(2);
    expect(result.rows[0].km_from).toBe(0);
    expect(result.rows[0].km_to).toBe(100);
  });

  it("returns error for empty CSV", () => {
    const result = parseCSVPriceTable("");
    expect(result.errors).toContain("Arquivo vazio ou sem dados");
  });

  it("returns error when km columns not found", () => {
    const csv = "coluna_a;coluna_b\n1;2";
    const result = parseCSVPriceTable(csv);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validates km_to >= km_from", () => {
    const csv = ["km_from;km_to;custo_ton", "200;100;150"].join("\n");
    const result = parseCSVPriceTable(csv);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].isValid).toBe(false);
  });

  it("validates percentages are 0-100", () => {
    const csv = ["km_from;km_to;gris%", "0;100;150"].join("\n");
    const result = parseCSVPriceTable(csv);
    expect(result.invalidRows).toBe(1);
  });

  it("handles Brazilian number format 'R$ 1.234,56'", () => {
    const csv = ["km_from;km_to;custo_ton", "0;100;1.234,56"].join("\n");
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].cost_per_ton).toBe(1234.56);
  });

  it("skips empty rows", () => {
    const csv = ["km_from;km_to;custo_ton", "", "0;100;200", ""].join("\n");
    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(1);
  });
});

describe("parseCSVIcms", () => {
  it("parses valid ICMS CSV", () => {
    const csv = [
      "uf_origem;uf_destino;aliquota",
      "SP;RJ;12",
      "SP;MG;7",
    ].join("\n");

    const result = parseCSVIcms(csv);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.rows[0].origin_state).toBe("SP");
    expect(result.rows[0].destination_state).toBe("RJ");
    expect(result.rows[0].rate_percent).toBe(12);
  });

  it("rejects invalid state codes", () => {
    const csv = ["uf_origem;uf_destino;aliquota", "XX;YY;12"].join("\n");
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
  });

  it("rejects rate outside 0-100", () => {
    const csv = ["uf_origem;uf_destino;aliquota", "SP;RJ;150"].join("\n");
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
  });

  it("returns error for empty CSV", () => {
    const result = parseCSVIcms("");
    expect(result.errors).toContain("Arquivo vazio ou sem dados");
  });

  it("normalizes state codes to uppercase", () => {
    const csv = ["uf_origem;uf_destino;aliquota", "sp;rj;12"].join("\n");
    const result = parseCSVIcms(csv);
    expect(result.rows[0].origin_state).toBe("SP");
    expect(result.rows[0].destination_state).toBe("RJ");
  });
});
