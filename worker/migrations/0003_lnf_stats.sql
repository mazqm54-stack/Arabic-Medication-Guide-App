-- Migration 0003: Add Libyan drug directory matching stats
ALTER TABLE requests ADD COLUMN lnf_matched INTEGER DEFAULT 0;
ALTER TABLE requests ADD COLUMN lnf_corrected INTEGER DEFAULT 0;
ALTER TABLE requests ADD COLUMN lnf_not_found INTEGER DEFAULT 0;
