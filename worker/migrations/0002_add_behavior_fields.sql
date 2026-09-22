ALTER TABLE participant_records ADD COLUMN initial_quantity INTEGER;
ALTER TABLE participant_records ADD COLUMN final_quantity INTEGER;
ALTER TABLE participant_records ADD COLUMN continued_add INTEGER NOT NULL DEFAULT 0;
ALTER TABLE participant_records ADD COLUMN checkout_clicked INTEGER NOT NULL DEFAULT 0;
