import { useEffect, useState } from "react";

/** Aide sous un dépôt d'image : taille conseillée et taille réelle de l'image déposée. */
export function TailleImage({ url }: { url: string | null }) {
  const [taille, setTaille] = useState<string | null>(null);
  useEffect(() => {
    setTaille(null);
    if (!url) return;
    const img = new Image();
    img.onload = () => setTaille(`${img.naturalWidth.toLocaleString("fr-FR")} × ${img.naturalHeight.toLocaleString("fr-FR")} px`);
    img.src = url;
  }, [url]);
  return (
    <p className="text-secondary-text text-[13px]">
      Pour une image nette en plein écran : 3 000 px de large au moins.
      {taille && <> Image déposée : {taille}.</>}
    </p>
  );
}
