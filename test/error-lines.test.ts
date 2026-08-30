import { describe, expect, it } from "vitest";
import { parseErrorLines } from "../src/error-lines";

describe("parseErrorLines", () => {
    it("extracts a single error line number", () => {
        expect(parseErrorLines("ERROR: 0:12: something")).toEqual([12]);
    });

    it("returns the lowest line when multiple errors exist", () => {
        const log = [
            "ERROR: 0:5: first",
            "ERROR: 0:12: second",
            "ERROR: 0:1: earliest",
        ].join("\n");
        expect(parseErrorLines(log)).toEqual([1]);
    });

    it("returns empty array for non-matching input", () => {
        expect(parseErrorLines("Link succeeded")).toEqual([]);
        expect(parseErrorLines("")).toEqual([]);
    });
});
