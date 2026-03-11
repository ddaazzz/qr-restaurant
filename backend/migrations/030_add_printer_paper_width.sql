-- Add printer paper width for QR code sizing

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS printer_paper_width INTEGER DEFAULT 80;

-- Create an index for quick lookups
CREATE INDEX IF NOT EXISTS idx_printer_paper_width ON restaurants(printer_paper_width);
