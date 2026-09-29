/** Téléchargement d'un texte produit par le serveur (CSV, JSON). */
export function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([type.includes("csv") ? "\uFEFF" + contenu : contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}
