-- Add security questions columns to users table for password recovery
ALTER TABLE users
ADD COLUMN IF NOT EXISTS security_question1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS security_answer1_hash VARCHAR(500),
ADD COLUMN IF NOT EXISTS security_question2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS security_answer2_hash VARCHAR(500),
ADD COLUMN IF NOT EXISTS custom_security_question VARCHAR(500),
ADD COLUMN IF NOT EXISTS custom_security_answer_hash VARCHAR(500),
ADD COLUMN IF NOT EXISTS failed_security_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_security_attempt_time TIMESTAMP;
