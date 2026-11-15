-- Migration 0002: Add prescription retry tracking columns to requests table
ALTER TABLE requests ADD COLUMN retry_needed INTEGER DEFAULT 0;
ALTER TABLE requests ADD COLUMN retry_improved INTEGER DEFAULT 0;
