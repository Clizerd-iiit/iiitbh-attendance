ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_method_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_method_check CHECK (method IN ('qr', 'otp', 'manual', 'auto', 'kiosk', 'ai_vision'));
