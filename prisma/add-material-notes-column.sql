-- Add per-material notes field (free-form text) so users can record
-- distribution intent ("4 tornillos arriba", "una pata con centro") at
-- planning time and read it back when dispatching.
ALTER TABLE project_materials ADD COLUMN notes TEXT NOT NULL DEFAULT '';
