# SmartAttend Final Website

This is the final combined Smart Attendance System website with a working backend and frontend.
It includes login, role-based dashboards, course/schedule access, attendance session creation, barcode scanning, duplicate prevention, invalid/unregistered scan handling, reports, student attendance view, and admin maintenance screens.

## How to run

1. Install Node.js.
2. Open this folder in Terminal / PowerShell.
3. Run:

```bash
npm start
```

4. Open:

```text
http://localhost:3000
```

No external packages are required for the demo version. The project stores data in `data/db.json` so it runs immediately on a laptop. A PostgreSQL schema is included in `database/schema.sql` to match the SRS database requirement.

## Demo logins

| Role | Login | Password |
|---|---|---|
| Lecturer | lecturer@uneswa.ac.sz | password123 |
| Student | 2021CSC034 | password123 |
| Administrator | admin@uneswa.ac.sz | admin123 |

## Useful barcode values for testing

| Student | Student ID | Barcode |
|---|---|---|
| Sipho Dlamini | 2021CSC034 | STU-2021CSC034 |
| Nomsa Khumalo | 2022CSC019 | STU-2022CSC019 |
| Thabo Nkosi | 2021CSC051 | STU-2021CSC051 |
| Lindiwe Maseko | 2021CSC078 | STU-2021CSC078 |
| Bongani Simelane | 2020MAT011 | STU-2020MAT011 |

## What works

- Lecturer/student/admin authentication.
- Role-based dashboards.
- Lecturer dashboard stats.
- Student personal attendance dashboard.
- Create attendance sessions.
- Prevent duplicate open sessions.
- Scan barcode or student ID.
- Block duplicate scans.
- Block scans into closed sessions.
- Detect invalid barcodes.
- Flag unregistered students.
- Close attendance sessions.
- View course and schedule data.
- Generate attendance reports with filters.
- Export report CSV.
- Admin can add students, courses, and schedules.

## Main API endpoints

- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/courses`
- `GET /api/schedules`
- `GET /api/students?courseId=CSC392`
- `POST /api/attendance-sessions`
- `GET /api/attendance-sessions?status=open`
- `POST /api/attendance-sessions/:id/scan`
- `PATCH /api/attendance-sessions/:id/close`
- `GET /api/reports/attendance?courseId=CSC392`
- `GET /api/reports/attendance?format=csv`
- `GET /api/student/attendance`
- `GET /api/student/barcode`
- `GET /api/student/history`

## Reset demo data

```bash
npm run reset-data
npm start
```

## Notes for PostgreSQL deployment

This local build uses a file-based datastore so the website can be tested immediately. For a PostgreSQL deployment, use the schema in `database/schema.sql`, then map the same API logic to PostgreSQL tables. The tables match the SRS entities: lecturer, student, course, class_schedule, attendance_session, attendance_record, barcode, enrollment, and exception_record.
