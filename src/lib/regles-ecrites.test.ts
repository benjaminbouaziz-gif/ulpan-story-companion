import { describe, expect, it } from "vitest";
import { lireReglesEcrites } from "@/lib/qc-core.server";

const MEC = ["plan_structure", "plan_numerotation"];

describe("lireReglesEcrites", () => {
  it("1 · aucune déclaration → refus", () => {
    const r = lireReglesEcrites("Juste du texte libre, aucune règle.", MEC);
    console.log("CAS 1", r.problemes);
    expect(r.criteres).toHaveLength(0);
    expect(r.problemes.length).toBeGreaterThan(0);
  });
  it("2 · même code deux fois → refus", () => {
    const r = lireReglesEcrites("[c1 · langue · simple] A\ntexte\n[c1 · langue · simple] B\ntexte", MEC);
    console.log("CAS 2", r.problemes);
    expect(r.problemes.join(" ")).toContain("deux fois");
  });
  it("3 · code d'une mesure → refus", () => {
    const r = lireReglesEcrites("[plan_structure · structure · bloquant] A\ntexte", MEC);
    console.log("CAS 3", r.problemes);
    expect(r.problemes.join(" ")).toContain("mesure");
  });
  it("4 · famille inventée → refus", () => {
    const r = lireReglesEcrites("[c1 · poesie · simple] A\ntexte", MEC);
    console.log("CAS 4", r.problemes);
    expect(r.problemes.join(" ")).toContain("famille inconnue");
  });
  it("5 · déclaration sans texte → refus", () => {
    const r = lireReglesEcrites("[c1 · langue · simple] A\n[c2 · structure · bloquant] B\ntexte", MEC);
    console.log("CAS 5", r.problemes);
    expect(r.problemes.join(" ")).toContain("aucune ligne de texte");
  });
  it("6 · cas valide à deux règles", () => {
    const r = lireReglesEcrites(
      "Cadre général du jugement.\n\n[c1 · langue · simple] Orthographe\nLe texte ne comporte aucune faute.\n\n[c2 · pedagogie · bloquant] Progression\nChaque page ajoute une notion.\nEt pas deux.",
      MEC,
    );
    console.log("CAS 6", JSON.stringify({ preambule: r.preambule, criteres: r.criteres, problemes: r.problemes }, null, 1));
    expect(r.problemes).toHaveLength(0);
    expect(r.preambule).toBe("Cadre général du jugement.");
    expect(r.criteres.map((c) => [c.code, c.family, c.isBlocking])).toEqual([
      ["c1", "langue", false],
      ["c2", "pedagogie", true],
    ]);
    expect(r.criteres[1]!.question).toContain("Et pas deux.");
  });
});
