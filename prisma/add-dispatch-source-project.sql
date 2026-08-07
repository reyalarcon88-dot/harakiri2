-- Track cross-project diversion: cuando un despacho toma material de la recepción
-- de otro proyecto, guarda el id del proyecto de origen en el item de despacho.
-- Sirve para que el proyecto de origen descuente esa cantidad de su cobertura y
-- vuelva a pedir el material. NULL para despachos propios / no asignados / devoluciones.
ALTER TABLE dispatch_items ADD COLUMN source_project_id TEXT;
