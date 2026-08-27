import { useQueryClient } from "@tanstack/react-query";

/**
 * LE RAFRAÎCHISSEMENT DE L'ATELIER.
 *
 * Toutes les lectures de l'atelier portent la clé ["atelier", ...] : dossier
 * d'étape, chaîne du livre, file d'attente, salle Robots, fiches, prompts,
 * décisions. Après une action confirmée par le serveur, on invalide la racine :
 * les écrans affichés se relisent seuls, les autres se reliront à l'ouverture.
 * Aucun rechargement de page, aucune interrogation quand rien ne bouge.
 */
export function useAtelierRefresh(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["atelier"] });
  };
}
