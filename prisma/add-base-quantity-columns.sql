-- Adds dual-unit tracking columns for packaged products (bolsa, caja, palet).
-- Non-destructive: only ADD COLUMN statements, no drops, no casts.
ALTER TABLE products            ADD COLUMN current_base_stock        REAL NOT NULL DEFAULT 0;
ALTER TABLE product_shelf_stock ADD COLUMN base_quantity             REAL NOT NULL DEFAULT 0;
ALTER TABLE product_shelf_stock ADD COLUMN reserve_base_quantity     REAL NOT NULL DEFAULT 0;
ALTER TABLE recepcion_items     ADD COLUMN base_quantity             REAL NOT NULL DEFAULT 0;
ALTER TABLE dispatch_items      ADD COLUMN base_quantity             REAL NOT NULL DEFAULT 0;
ALTER TABLE transfers           ADD COLUMN base_quantity             REAL NOT NULL DEFAULT 0;
ALTER TABLE return_items        ADD COLUMN base_quantity_delivered   REAL NOT NULL DEFAULT 0;
ALTER TABLE return_items        ADD COLUMN base_quantity_returned    REAL NOT NULL DEFAULT 0;
