-- Add merma/scrap destination tracking to return items.
-- return_destination: "" (legacy), "scrap" (merma — material descartado, no vuelve a stock).
-- scrap_charged:      true si al marcar merma el usuario eligió cargar el costo al proyecto.
ALTER TABLE return_items ADD COLUMN return_destination TEXT NOT NULL DEFAULT '';
ALTER TABLE return_items ADD COLUMN scrap_charged INTEGER NOT NULL DEFAULT 0;
