-- The admin's default priority gets the same allowed values as Ticket.priority
-- (the other CHECK constraints are in the init migration)
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_defaultPriority_check"
  CHECK ("defaultPriority" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
