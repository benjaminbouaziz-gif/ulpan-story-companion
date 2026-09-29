import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

describe("dictionnaires", () => {
  it("ont les mêmes clés en FR et en EN, toutes remplies", () => {
    const fr = Object.keys(dictionaries.fr).sort();
    const en = Object.keys(dictionaries.en).sort();
    expect(en).toEqual(fr);
    for (const k of fr) {
      expect(dictionaries.fr[k as keyof typeof dictionaries.fr].trim()).not.toBe("");
      expect(dictionaries.en[k as keyof typeof dictionaries.en].trim()).not.toBe("");
    }
  });
});
