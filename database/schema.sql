-- Smart Attendance System PostgreSQL Schema
-- Matches the SRS data dictionary and backend endpoint plan.

CREATE TABLE lecturer (
  lecturer_id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  department VARCHAR(120),
  role VARCHAR(20) NOT NULL DEFAULT 'lecturer',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student (
  student_id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(160) UNIQUE,
  programme VARCHAR(160),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE course (
  course_id VARCHAR(20) PRIMARY KEY,
  course_code VARCHAR(20) UNIQUE NOT NULL,
  course_name VARCHAR(200) NOT NULL,
  lecturer_id VARCHAR(20) REFERENCES lecturer(lecturer_id),
  credit_hours INTEGER DEFAULT 3,
  threshold INTEGER DEFAULT 75,
  venue VARCHAR(120)
);

CREATE TABLE barcode (
  barcode_id SERIAL PRIMARY KEY,
  code_value VARCHAR(100) UNIQUE NOT NULL,
  assigned_to VARCHAR(20) NOT NULL,
  assigned_type VARCHAR(20) NOT NULL CHECK (assigned_type IN ('student','lecturer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enrollment (
  enrollment_id SERIAL PRIMARY KEY,
  course_id VARCHAR(20) NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
  student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'registered',
  UNIQUE(course_id, student_id)
);

CREATE TABLE class_schedule (
  schedule_id SERIAL PRIMARY KEY,
  course_id VARCHAR(20) NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
  lecturer_id VARCHAR(20) NOT NULL REFERENCES lecturer(lecturer_id),
  day VARCHAR(20),
  class_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue VARCHAR(120),
  status VARCHAR(20) DEFAULT 'scheduled'
);

CREATE TABLE attendance_session (
  session_id SERIAL PRIMARY KEY,
  course_id VARCHAR(20) NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
  lecturer_id VARCHAR(20) NOT NULL REFERENCES lecturer(lecturer_id),
  schedule_id INTEGER REFERENCES class_schedule(schedule_id),
  date DATE DEFAULT CURRENT_DATE,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'open',
  notes TEXT
);

CREATE UNIQUE INDEX one_open_session_per_course_schedule
ON attendance_session(course_id, COALESCE(schedule_id, 0))
WHERE status = 'open';

CREATE TABLE attendance_record (
  record_id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES attendance_session(session_id) ON DELETE CASCADE,
  student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'present',
  capture_method VARCHAR(30) DEFAULT 'scanner',
  UNIQUE(session_id, student_id)
);

CREATE TABLE exception_record (
  exception_id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES attendance_session(session_id) ON DELETE CASCADE,
  barcode_value VARCHAR(100),
  student_id VARCHAR(20),
  reason VARCHAR(40) NOT NULL,
  message TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_session_course ON attendance_session(course_id);
CREATE INDEX idx_attendance_record_session ON attendance_record(session_id);
CREATE INDEX idx_attendance_record_student ON attendance_record(student_id);
CREATE INDEX idx_enrollment_course ON enrollment(course_id);
CREATE INDEX idx_barcode_value ON barcode(code_value);
