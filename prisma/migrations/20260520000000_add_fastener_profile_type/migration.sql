-- Add FASTENER value to ProfileType enum
-- Safe migration: only adds a new enum value, no data changes

ALTER TYPE "ProfileType" ADD VALUE IF NOT EXISTS 'FASTENER';
