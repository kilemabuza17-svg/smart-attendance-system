'use strict';

/**
 * SmartAttend Final Website Backend
 * Zero-dependency Node.js server for local demonstration.
 * The API follows the SRS: auth, courses, schedules, attendance sessions,
 * barcode scanning, duplicate/unregistered/invalid handling, reports, roles.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const sessions = new Map(); // token -> { id, role, email/name, createdAt }

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(`smart-attend:${password}`).digest('hex');
}

function makeId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days, hour = 8) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seedDatabase() {
  const now = new Date();
  const today = todayISO();
  return {
    meta: {
      name: 'Smart Attendance System',
      version: '1.0.0',
      seededAt: now.toISOString(),
      note: 'Local demo datastore. PostgreSQL schema is included in database/schema.sql.'
    },
    users: [
      {
        id: 'A001', role: 'admin', name: 'System Administrator',
        email: 'admin@uneswa.ac.sz', passwordHash: hashPassword('admin123'), department: 'ICT'
      },
      {
        id: 'L001', role: 'lecturer', name: 'Dr. N. Mkhonta',
        email: 'lecturer@uneswa.ac.sz', passwordHash: hashPassword('password123'), department: 'Computer Science'
      },
      {
        id: '2021CSC034', role: 'student', name: 'Sipho Dlamini',
        email: '2021csc034@student.uneswa.ac.sz', student_id: '2021CSC034', passwordHash: hashPassword('password123'), programme: 'BSc Computer Science'
      },
      {
        id: '2022CSC019', role: 'student', name: 'Nomsa Khumalo',
        email: '2022csc019@student.uneswa.ac.sz', student_id: '2022CSC019', passwordHash: hashPassword('password123'), programme: 'BSc Computer Science'
      }
    ],
    lecturers: [
      { lecturer_id: 'L001', first_name: 'Nandi', last_name: 'Mkhonta', email: 'lecturer@uneswa.ac.sz', department: 'Computer Science', role: 'lecturer' }
    ],
    students: [
      { student_id: '2021CSC034', first_name: 'Sipho', last_name: 'Dlamini', email: '2021csc034@student.uneswa.ac.sz', programme: 'BSc Computer Science', barcode_value: 'STU-2021CSC034', status: 'active' },
      { student_id: '2022CSC019', first_name: 'Nomsa', last_name: 'Khumalo', email: '2022csc019@student.uneswa.ac.sz', programme: 'BSc Computer Science', barcode_value: 'STU-2022CSC019', status: 'active' },
      { student_id: '2021CSC051', first_name: 'Thabo', last_name: 'Nkosi', email: '2021csc051@student.uneswa.ac.sz', programme: 'BSc Computer Science', barcode_value: 'STU-2021CSC051', status: 'active' },
      { student_id: '2021CSC078', first_name: 'Lindiwe', last_name: 'Maseko', email: '2021csc078@student.uneswa.ac.sz', programme: 'BSc Computer Science', barcode_value: 'STU-2021CSC078', status: 'active' },
      { student_id: '2020MAT011', first_name: 'Bongani', last_name: 'Simelane', email: '2020mat011@student.uneswa.ac.sz', programme: 'BSc Mathematics', barcode_value: 'STU-2020MAT011', status: 'active' }
    ],
    courses: [
      { course_id: 'CSC392', course_code: 'CSC392', course_name: 'Practices in Software Engineering', lecturer_id: 'L001', credit_hours: 3, threshold: 75, venue: 'Block B' },
      { course_id: 'CSC301', course_code: 'CSC301', course_name: 'Algorithms and Data Structures', lecturer_id: 'L001', credit_hours: 3, threshold: 75, venue: 'Computer Lab 2' },
      { course_id: 'PHY312', course_code: 'PHY312', course_name: 'Electronics and Circuit Theory', lecturer_id: 'L001', credit_hours: 4, threshold: 75, venue: 'Physics Lab' },
      { course_id: 'MAT204', course_code: 'MAT204', course_name: 'Applied Mathematics', lecturer_id: 'L001', credit_hours: 3, threshold: 75, venue: 'Lecture Theatre 3' }
    ],
    enrollments: [
      ['CSC392','2021CSC034'], ['CSC392','2022CSC019'], ['CSC392','2021CSC051'], ['CSC392','2021CSC078'],
      ['CSC301','2021CSC034'], ['CSC301','2022CSC019'], ['CSC301','2021CSC051'], ['CSC301','2021CSC078'],
      ['PHY312','2021CSC034'], ['PHY312','2022CSC019'], ['PHY312','2021CSC051'],
      ['MAT204','2021CSC034'], ['MAT204','2022CSC019'], ['MAT204','2021CSC078']
    ].map(([course_id, student_id], i) => ({ enrollment_id: i + 1, course_id, student_id, status: 'registered' })),
    class_schedules: [
      { schedule_id: 1, course_id: 'CSC392', lecturer_id: 'L001', day: 'Monday', class_date: today, start_time: '08:00', end_time: '10:00', venue: 'Block B', status: 'scheduled' },
      { schedule_id: 2, course_id: 'CSC301', lecturer_id: 'L001', day: 'Tuesday', class_date: today, start_time: '10:00', end_time: '12:00', venue: 'Computer Lab 2', status: 'scheduled' },
      { schedule_id: 3, course_id: 'PHY312', lecturer_id: 'L001', day: 'Wednesday', class_date: today, start_time: '12:00', end_time: '14:00', venue: 'Physics Lab', status: 'scheduled' },
      { schedule_id: 4, course_id: 'MAT204', lecturer_id: 'L001', day: 'Thursday', class_date: today, start_time: '10:00', end_time: '12:00', venue: 'Lecture Theatre 3', status: 'scheduled' }
    ],
    attendance_sessions: [
      { session_id: 1, course_id: 'CSC392', lecturer_id: 'L001', schedule_id: 1, date: today, start_time: daysAgo(0, 8), end_time: null, status: 'open', notes: 'Live demo session' },
      { session_id: 2, course_id: 'CSC301', lecturer_id: 'L001', schedule_id: 2, date: today, start_time: daysAgo(1, 10), end_time: daysAgo(1, 12), status: 'closed', notes: 'Algorithms lecture' },
      { session_id: 3, course_id: 'PHY312', lecturer_id: 'L001', schedule_id: 3, date: today, start_time: daysAgo(2, 12), end_time: daysAgo(2, 14), status: 'closed', notes: 'Lab session' },
      { session_id: 4, course_id: 'MAT204', lecturer_id: 'L001', schedule_id: 4, date: today, start_time: daysAgo(3, 10), end_time: daysAgo(3, 12), status: 'closed', notes: 'Tutorial' }
    ],
    attendance_records: [
      { record_id: 1, session_id: 1, student_id: '2021CSC034', timestamp: daysAgo(0, 8), status: 'present', capture_method: 'scanner' },
      { record_id: 2, session_id: 1, student_id: '2022CSC019', timestamp: daysAgo(0, 8), status: 'present', capture_method: 'scanner' },
      { record_id: 3, session_id: 2, student_id: '2021CSC034', timestamp: daysAgo(1, 10), status: 'present', capture_method: 'scanner' },
      { record_id: 4, session_id: 2, student_id: '2022CSC019', timestamp: daysAgo(1, 10), status: 'present', capture_method: 'scanner' },
      { record_id: 5, session_id: 2, student_id: '2021CSC051', timestamp: daysAgo(1, 10), status: 'present', capture_method: 'manual' },
      { record_id: 6, session_id: 3, student_id: '2021CSC034', timestamp: daysAgo(2, 12), status: 'late', capture_method: 'scanner' },
      { record_id: 7, session_id: 3, student_id: '2022CSC019', timestamp: daysAgo(2, 12), status: 'present', capture_method: 'scanner' },
      { record_id: 8, session_id: 4, student_id: '2022CSC019', timestamp: daysAgo(3, 10), status: 'present', capture_method: 'scanner' },
      { record_id: 9, session_id: 4, student_id: '2021CSC078', timestamp: daysAgo(3, 10), status: 'present', capture_method: 'scanner' }
    ],
    exceptions: [
      { exception_id: 1, session_id: 1, barcode_value: 'STU-UNKNOWN', reason: 'invalid', timestamp: daysAgo(0, 8), message: 'Barcode does not match any student.' }
    ]
  };
}

function loadDb() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const seed = seedDatabase();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveDb(db) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function fullName(student) {
  return `${student.first_name} ${student.last_name}`;
}

function courseById(db, id) {
  return db.courses.find(c => c.course_id === id);
}

function studentById(db, id) {
  return db.students.find(s => s.student_id === id);
}

function findUserForCredentials(db, role, identifier) {
  const clean = String(identifier || '').trim().toLowerCase();
  if (role === 'student') {
    return db.users.find(u => u.role === 'student' && String(u.student_id || u.id).toLowerCase() === clean);
  }
  return db.users.find(u => (u.role === 'lecturer' || u.role === 'admin') && String(u.email || '').toLowerCase() === clean);
}

function makeToken(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    student_id: user.student_id,
    createdAt: new Date().toISOString()
  });
  return token;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error('Invalid JSON body'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': contentType, ...headers });
  res.end(text);
}

function sendError(res, status, message, details) {
  sendJson(res, status, { ok: false, error: message, details });
}

function getAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  return sessions.get(token) || null;
}

function requireAuth(req, res) {
  const user = getAuth(req);
  if (!user) {
    sendError(res, 401, 'Authentication required. Please log in again.');
    return null;
  }
  return user;
}

function hasRole(user, roles) {
  return roles.includes(user.role);
}

function requireRoles(req, res, roles) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!hasRole(user, roles)) {
    sendError(res, 403, 'You are not authorized to perform this action.');
    return null;
  }
  return user;
}

function canAccessCourse(user, course) {
  return user.role === 'admin' || (user.role === 'lecturer' && course.lecturer_id === user.id);
}

function nextNumber(items, key) {
  return items.length ? Math.max(...items.map(x => Number(x[key]) || 0)) + 1 : 1;
}

function statusForPercent(percent, threshold = 75) {
  if (percent >= threshold + 10) return 'Safe';
  if (percent >= threshold) return 'Watch closely';
  return 'At risk';
}

function getStudentCourseStats(db, student_id) {
  const studentEnrollments = db.enrollments.filter(e => e.student_id === student_id && e.status === 'registered');
  return studentEnrollments.map(e => {
    const course = courseById(db, e.course_id);
    const courseSessions = db.attendance_sessions.filter(s => s.course_id === e.course_id && s.status === 'closed');
    const attended = courseSessions.filter(s => db.attendance_records.some(r => r.session_id === s.session_id && r.student_id === student_id && ['present', 'late'].includes(r.status))).length;
    const total = courseSessions.length || 1;
    const percent = Math.round((attended / total) * 100);
    return {
      course_id: e.course_id,
      course_code: course?.course_code || e.course_id,
      course_name: course?.course_name || e.course_id,
      threshold: course?.threshold || 75,
      attended,
      total_sessions: courseSessions.length,
      percent,
      status: statusForPercent(percent, course?.threshold || 75)
    };
  });
}

function getReportRows(db, filters = {}) {
  const rows = [];
  for (const enrollment of db.enrollments) {
    if (filters.courseId && enrollment.course_id !== filters.courseId) continue;
    if (filters.studentId && enrollment.student_id !== filters.studentId) continue;
    const course = courseById(db, enrollment.course_id);
    if (!course) continue;
    const student = studentById(db, enrollment.student_id);
    if (!student) continue;
    const sessionsForCourse = db.attendance_sessions.filter(s => {
      if (s.course_id !== enrollment.course_id) return false;
      if (filters.sessionId && String(s.session_id) !== String(filters.sessionId)) return false;
      const date = String(s.date || s.start_time || '').slice(0, 10);
      if (filters.start && date < filters.start) return false;
      if (filters.end && date > filters.end) return false;
      return true;
    });
    const total = sessionsForCourse.length;
    const present = sessionsForCourse.filter(session => db.attendance_records.some(r => r.session_id === session.session_id && r.student_id === student.student_id && ['present', 'late'].includes(r.status))).length;
    const percent = total ? Math.round((present / total) * 100) : 0;
    rows.push({
      course_id: course.course_id,
      course_name: course.course_name,
      student_id: student.student_id,
      student_name: fullName(student),
      total_sessions: total,
      attended: present,
      absent: Math.max(total - present, 0),
      percentage: percent,
      status: statusForPercent(percent, course.threshold || 75)
    });
  }
  return rows.sort((a, b) => a.course_id.localeCompare(b.course_id) || a.student_name.localeCompare(b.student_name));
}

function toCSV(rows) {
  const headers = ['course_id','course_name','student_id','student_name','total_sessions','attended','absent','percentage','status'];
  const esc = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(row => headers.map(h => esc(row[h])).join(','))].join('\n');
}

async function handleApi(req, res, url) {
  const db = loadDb();
  const method = req.method;
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, system: db.meta.name, time: new Date().toISOString() });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const role = String(body.role || 'lecturer').toLowerCase();
    const identifier = role === 'student' ? body.studentId : body.email;
    const user = findUserForCredentials(db, role, identifier);
    if (!user || user.passwordHash !== hashPassword(body.password || '')) {
      return sendError(res, 401, 'Invalid credentials. Please check your login details.');
    }
    const token = makeToken(user);
    return sendJson(res, 200, {
      ok: true,
      token,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        student_id: user.student_id,
        programme: user.programme,
        department: user.department
      }
    });
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) sessions.delete(token);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/me') {
    const user = requireAuth(req, res);
    if (!user) return;
    return sendJson(res, 200, { ok: true, user });
  }

  if (method === 'GET' && pathname === '/api/dashboard') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role === 'student') {
      const student = studentById(db, user.student_id || user.id);
      const courseStats = getStudentCourseStats(db, student.student_id);
      const overall = courseStats.length ? Math.round(courseStats.reduce((sum, c) => sum + c.percent, 0) / courseStats.length) : 0;
      return sendJson(res, 200, {
        ok: true,
        role: 'student',
        student,
        stats: {
          overall,
          registered_courses: courseStats.length,
          at_risk: courseStats.filter(c => c.status === 'At risk').length,
          attended: courseStats.reduce((sum, c) => sum + c.attended, 0),
          total_sessions: courseStats.reduce((sum, c) => sum + c.total_sessions, 0)
        },
        courses: courseStats,
        alerts: courseStats.filter(c => c.status === 'At risk' || c.status === 'Watch closely')
      });
    }
    const courses = db.courses.filter(c => user.role === 'admin' || c.lecturer_id === user.id);
    const courseIds = new Set(courses.map(c => c.course_id));
    const today = todayISO();
    const todaysSchedules = db.class_schedules.filter(s => courseIds.has(s.course_id) && s.class_date === today);
    const openSessions = db.attendance_sessions.filter(s => courseIds.has(s.course_id) && s.status === 'open');
    const reportRows = getReportRows(db, {});
    const relevantRows = reportRows.filter(r => courseIds.has(r.course_id));
    const avg = relevantRows.length ? Math.round(relevantRows.reduce((sum, r) => sum + r.percentage, 0) / relevantRows.length) : 0;
    return sendJson(res, 200, {
      ok: true,
      role: user.role,
      stats: {
        classes_today: todaysSchedules.length,
        avg_attendance: avg,
        open_sessions: openSessions.length,
        at_risk: relevantRows.filter(r => r.status === 'At risk').length
      },
      courses,
      schedules: todaysSchedules,
      open_sessions: openSessions.map(s => ({ ...s, course: courseById(db, s.course_id) })),
      at_risk: relevantRows.filter(r => r.status === 'At risk').slice(0, 6)
    });
  }

  if (method === 'GET' && pathname === '/api/courses') {
    const user = requireAuth(req, res);
    if (!user) return;
    let courses;
    if (user.role === 'student') {
      const courseIds = new Set(db.enrollments.filter(e => e.student_id === (user.student_id || user.id)).map(e => e.course_id));
      courses = db.courses.filter(c => courseIds.has(c.course_id));
    } else {
      courses = db.courses.filter(c => user.role === 'admin' || c.lecturer_id === user.id);
    }
    return sendJson(res, 200, { ok: true, courses });
  }

  if (method === 'POST' && pathname === '/api/courses') {
    const user = requireRoles(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    const course_id = String(body.course_id || body.course_code || '').trim().toUpperCase();
    if (!course_id || !body.course_name) return sendError(res, 400, 'Course code and course name are required.');
    if (db.courses.some(c => c.course_id === course_id)) return sendError(res, 409, 'Course already exists.');
    const course = {
      course_id,
      course_code: course_id,
      course_name: String(body.course_name).trim(),
      lecturer_id: body.lecturer_id || 'L001',
      credit_hours: Number(body.credit_hours || 3),
      threshold: Number(body.threshold || 75),
      venue: body.venue || 'TBA'
    };
    db.courses.push(course);
    saveDb(db);
    return sendJson(res, 201, { ok: true, course });
  }

  if (method === 'GET' && pathname === '/api/students') {
    const user = requireRoles(req, res, ['lecturer', 'admin']);
    if (!user) return;
    const courseId = url.searchParams.get('courseId');
    let students = db.students;
    if (courseId) {
      const course = courseById(db, courseId);
      if (!course || !canAccessCourse(user, course)) return sendError(res, 403, 'You cannot view students for this course.');
      const enrolled = new Set(db.enrollments.filter(e => e.course_id === courseId).map(e => e.student_id));
      students = students.filter(s => enrolled.has(s.student_id));
    }
    return sendJson(res, 200, { ok: true, students });
  }

  if (method === 'POST' && pathname === '/api/students') {
    const user = requireRoles(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    const student_id = String(body.student_id || '').trim().toUpperCase();
    if (!student_id || !body.first_name || !body.last_name) return sendError(res, 400, 'Student ID, first name, and last name are required.');
    if (db.students.some(s => s.student_id === student_id)) return sendError(res, 409, 'Student already exists.');
    const student = {
      student_id,
      first_name: String(body.first_name).trim(),
      last_name: String(body.last_name).trim(),
      email: body.email || `${student_id.toLowerCase()}@student.uneswa.ac.sz`,
      programme: body.programme || 'Not specified',
      barcode_value: body.barcode_value || `STU-${student_id}`,
      status: 'active'
    };
    db.students.push(student);
    db.users.push({ id: student_id, role: 'student', name: fullName(student), email: student.email, student_id, passwordHash: hashPassword(body.password || 'password123'), programme: student.programme });
    saveDb(db);
    return sendJson(res, 201, { ok: true, student });
  }

  const studentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
  if (studentMatch && method === 'DELETE') {
    const user = requireRoles(req, res, ['admin']);
    if (!user) return;
    const studentId = decodeURIComponent(studentMatch[1]).toUpperCase();
    const before = db.students.length;
    db.students = db.students.filter(s => s.student_id !== studentId);
    db.users = db.users.filter(u => u.student_id !== studentId && u.id !== studentId);
    db.enrollments = db.enrollments.filter(e => e.student_id !== studentId);
    if (before === db.students.length) return sendError(res, 404, 'Student not found.');
    saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/schedules') {
    const user = requireRoles(req, res, ['lecturer', 'admin']);
    if (!user) return;
    let schedules = db.class_schedules;
    if (user.role !== 'admin') schedules = schedules.filter(s => s.lecturer_id === user.id);
    schedules = schedules.map(s => ({ ...s, course: courseById(db, s.course_id) }));
    return sendJson(res, 200, { ok: true, schedules });
  }

  if (method === 'POST' && pathname === '/api/schedules') {
    const user = requireRoles(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    const course = courseById(db, body.course_id);
    if (!course) return sendError(res, 404, 'Course not found.');
    const schedule = {
      schedule_id: nextNumber(db.class_schedules, 'schedule_id'),
      course_id: course.course_id,
      lecturer_id: body.lecturer_id || course.lecturer_id,
      day: body.day || 'Monday',
      class_date: body.class_date || todayISO(),
      start_time: body.start_time || '08:00',
      end_time: body.end_time || '10:00',
      venue: body.venue || course.venue || 'TBA',
      status: 'scheduled'
    };
    db.class_schedules.push(schedule);
    saveDb(db);
    return sendJson(res, 201, { ok: true, schedule });
  }

  if (method === 'GET' && pathname === '/api/attendance-sessions') {
    const user = requireRoles(req, res, ['lecturer', 'admin']);
    if (!user) return;
    let results = db.attendance_sessions;
    const courseId = url.searchParams.get('courseId');
    const status = url.searchParams.get('status');
    if (courseId) results = results.filter(s => s.course_id === courseId);
    if (status) results = results.filter(s => s.status === status);
    results = results.filter(s => {
      const course = courseById(db, s.course_id);
      return course && canAccessCourse(user, course);
    }).map(s => ({ ...s, course: courseById(db, s.course_id), scans: db.attendance_records.filter(r => r.session_id === s.session_id).length }));
    return sendJson(res, 200, { ok: true, sessions: results });
  }

  if (method === 'POST' && pathname === '/api/attendance-sessions') {
    const user = requireRoles(req, res, ['lecturer', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    const course = courseById(db, body.course_id);
    if (!course) return sendError(res, 404, 'Course not found.');
    if (!canAccessCourse(user, course)) return sendError(res, 403, 'You cannot create a session for this course.');
    const scheduleId = body.schedule_id ? Number(body.schedule_id) : null;
    const duplicate = db.attendance_sessions.find(s => s.course_id === course.course_id && s.status === 'open' && (!scheduleId || Number(s.schedule_id) === scheduleId));
    if (duplicate) return sendError(res, 409, 'An open attendance session already exists for this course or class period.', { session_id: duplicate.session_id });
    const session = {
      session_id: nextNumber(db.attendance_sessions, 'session_id'),
      course_id: course.course_id,
      lecturer_id: user.role === 'admin' ? course.lecturer_id : user.id,
      schedule_id: scheduleId,
      date: body.date || todayISO(),
      start_time: new Date().toISOString(),
      end_time: null,
      status: 'open',
      notes: body.notes || ''
    };
    db.attendance_sessions.push(session);
    saveDb(db);
    return sendJson(res, 201, { ok: true, session: { ...session, course } });
  }

  const sessionMatch = pathname.match(/^\/api\/attendance-sessions\/(\d+)(?:\/(scan|close))?$/);
  if (sessionMatch) {
    const sessionId = Number(sessionMatch[1]);
    const action = sessionMatch[2];
    const session = db.attendance_sessions.find(s => s.session_id === sessionId);
    if (!session) return sendError(res, 404, 'Attendance session not found.');
    const course = courseById(db, session.course_id);

    if (method === 'GET' && !action) {
      const user = requireRoles(req, res, ['lecturer', 'admin']);
      if (!user) return;
      if (!canAccessCourse(user, course)) return sendError(res, 403, 'You cannot access this session.');
      const records = db.attendance_records.filter(r => r.session_id === sessionId).map(r => ({ ...r, student: studentById(db, r.student_id) }));
      return sendJson(res, 200, { ok: true, session: { ...session, course }, records });
    }

    if (method === 'PATCH' && action === 'close') {
      const user = requireRoles(req, res, ['lecturer', 'admin']);
      if (!user) return;
      if (!canAccessCourse(user, course)) return sendError(res, 403, 'You cannot close this session.');
      if (session.status === 'closed') return sendJson(res, 200, { ok: true, message: 'Session was already closed.', session });
      session.status = 'closed';
      session.end_time = new Date().toISOString();
      saveDb(db);
      return sendJson(res, 200, { ok: true, message: 'Attendance session closed.', session });
    }

    if (method === 'POST' && action === 'scan') {
      const user = requireRoles(req, res, ['lecturer', 'admin']);
      if (!user) return;
      if (!canAccessCourse(user, course)) return sendError(res, 403, 'You cannot scan for this session.');
      const body = await parseBody(req);
      const barcode = String(body.barcode || body.student_id || '').trim().toUpperCase();
      if (!barcode) return sendError(res, 400, 'Barcode value is required.');
      if (session.status !== 'open') return sendError(res, 400, 'This attendance session is closed. Open a new session before scanning.');
      const student = db.students.find(s => String(s.barcode_value).toUpperCase() === barcode || String(s.student_id).toUpperCase() === barcode || `STU-${String(s.student_id).toUpperCase()}` === barcode);
      if (!student) {
        const exception = { exception_id: nextNumber(db.exceptions, 'exception_id'), session_id: sessionId, barcode_value: barcode, reason: 'invalid', timestamp: new Date().toISOString(), message: 'Barcode does not match any student.' };
        db.exceptions.push(exception); saveDb(db);
        return sendError(res, 404, 'Invalid barcode. No matching student was found.', exception);
      }
      const enrolled = db.enrollments.some(e => e.course_id === session.course_id && e.student_id === student.student_id && e.status === 'registered');
      if (!enrolled) {
        const exception = { exception_id: nextNumber(db.exceptions, 'exception_id'), session_id: sessionId, barcode_value: barcode, student_id: student.student_id, reason: 'unregistered', timestamp: new Date().toISOString(), message: 'Student exists but is not registered for this course.' };
        db.exceptions.push(exception); saveDb(db);
        return sendError(res, 403, `${fullName(student)} is not registered for ${session.course_id}.`, exception);
      }
      const existing = db.attendance_records.find(r => r.session_id === sessionId && r.student_id === student.student_id);
      if (existing) {
        const exception = { exception_id: nextNumber(db.exceptions, 'exception_id'), session_id: sessionId, barcode_value: barcode, student_id: student.student_id, reason: 'duplicate', timestamp: new Date().toISOString(), message: 'Duplicate scan blocked.' };
        db.exceptions.push(exception); saveDb(db);
        return sendJson(res, 409, { ok: false, warning: 'Duplicate scan blocked.', student, existing_record: existing, exception });
      }
      const record = { record_id: nextNumber(db.attendance_records, 'record_id'), session_id: sessionId, student_id: student.student_id, timestamp: new Date().toISOString(), status: body.status || 'present', capture_method: body.capture_method || 'scanner' };
      db.attendance_records.push(record); saveDb(db);
      return sendJson(res, 201, { ok: true, message: `${fullName(student)} marked present.`, record, student, course });
    }
  }

  if (method === 'GET' && pathname === '/api/reports/attendance') {
    const user = requireRoles(req, res, ['lecturer', 'admin']);
    if (!user) return;
    const filters = {
      courseId: url.searchParams.get('courseId') || '',
      studentId: url.searchParams.get('studentId') || '',
      sessionId: url.searchParams.get('sessionId') || '',
      start: url.searchParams.get('start') || '',
      end: url.searchParams.get('end') || ''
    };
    let rows = getReportRows(db, filters);
    if (user.role !== 'admin') rows = rows.filter(row => db.courses.some(c => c.course_id === row.course_id && c.lecturer_id === user.id));
    if (url.searchParams.get('format') === 'csv') {
      return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="smart-attend-report.csv"' });
    }
    const summary = {
      rows: rows.length,
      avg_percentage: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.percentage, 0) / rows.length) : 0,
      at_risk: rows.filter(row => row.status === 'At risk').length
    };
    return sendJson(res, 200, { ok: true, filters, summary, rows });
  }

  if (method === 'GET' && pathname === '/api/student/attendance') {
    const user = requireRoles(req, res, ['student']);
    if (!user) return;
    const stats = getStudentCourseStats(db, user.student_id || user.id);
    return sendJson(res, 200, { ok: true, courses: stats });
  }

  if (method === 'GET' && pathname === '/api/student/barcode') {
    const user = requireRoles(req, res, ['student']);
    if (!user) return;
    const student = studentById(db, user.student_id || user.id);
    return sendJson(res, 200, { ok: true, barcode: student.barcode_value, student });
  }

  if (method === 'GET' && pathname === '/api/student/history') {
    const user = requireRoles(req, res, ['student']);
    if (!user) return;
    const studentId = user.student_id || user.id;
    const rows = db.attendance_sessions
      .filter(s => db.enrollments.some(e => e.course_id === s.course_id && e.student_id === studentId))
      .map(s => {
        const record = db.attendance_records.find(r => r.session_id === s.session_id && r.student_id === studentId);
        return { session: s, course: courseById(db, s.course_id), record, status: record ? record.status : 'absent' };
      })
      .sort((a, b) => String(b.session.start_time).localeCompare(String(a.session.start_time)));
    return sendJson(res, 200, { ok: true, history: rows });
  }

  return sendError(res, 404, `API route not found: ${method} ${pathname}`);
}

function serveStatic(req, res, url) {
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = decodeURIComponent(filePath);
  const safePath = path.normalize(filePath).replace(/^([.][.][/\\])+/, '');
  const full = path.join(PUBLIC_DIR, safePath);
  if (!full.startsWith(PUBLIC_DIR)) return sendError(res, 403, 'Forbidden');
  fs.readFile(full, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, fallbackData) => {
        if (fallbackErr) return sendError(res, 404, 'File not found');
        sendText(res, 200, fallbackData, 'text/html; charset=utf-8');
      });
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
    sendText(res, 200, data, type);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    sendError(res, err.status || 500, err.message || 'Internal server error');
  }
});

loadDb();
server.listen(PORT, () => {
  console.log(`SmartAttend final website running on http://localhost:${PORT}`);
  console.log('Demo logins: lecturer@uneswa.ac.sz / password123 | 2021CSC034 / password123 | admin@uneswa.ac.sz / admin123');
});
