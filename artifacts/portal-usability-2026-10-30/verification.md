# Portal usability pass — 30 October 2026

## Implemented scope

Existing school administration routes were retained. Prefix the following paths with your school URL, for example `/aptechinternationalinstitute/admin`.

| Route | Change |
|---|---|
| `/documents` | Individual, class/bulk and archived views; class/section/name/identifier student lookup; server-side pages of 20; no full student directory in picker choices. |
| `/parents` | Directory first; separate Add/Manage Children dialog; directory class/section/status/search filters; paginated child finder retaining selected children across searches. |
| `/teachers/leave-requests` | Actual employment department, role and employee ID; search, department/status/date-overlap filters; separate review dialog. |
| `/attendance/staff` | Separate daily/monthly views; one search/filter toolbar; audited correction dialog rather than a form below the register. |
| `/payroll` | Register/totals views; separate whole-month calculation confirmation; filtered print action; removed duplicate table search. |
| `/payroll/salaries` | Searchable employee cards, pagination and employee-specific dialog; salary history collapsed; salary change explicitly opt-in. |
| `/attendance/calendar` | Search/day-type filters, Add/Edit dialog and plain-language day-type explanations. Existing date-upsert and payroll locks retained. |
| `/academics/sessions` | Create/Edit dialogs; search/status/date overlap filters. |
| `/academics/classes` | Separate Add dialog; class/name/code/level search. |
| `/academics/sections` | Separate Add dialog; class filter and section/class/room search. |
| `/academics/subjects` | Separate aligned Add dialog; subject/code/class/teacher search and class filter. |
| `/academics/timetable` | Separate Add Lesson dialog; session/class/section/search controls. Existing Monday–Saturday weekly grid retained. |
| `/attendance/students` | Individual student names, student/admission IDs and rolls; class/section/date/status/search controls; 25-row table pages. |

Shared `PhotoRecordPicker` also uses a searchable, paginated selection dialog with class/section filters for students and role filters for staff. It searches the records supplied by each caller. The new document/parent child finder instead queries the server and does not load all students.

## Verification

- TypeScript: exit 0.
- Production build: exit 0; all 151 static pages generated. Existing lint warnings remain; no lint errors in the successful run.
- Organization/portal integration suite: 274 checks passed against disposable local MongoDB fixtures. Includes lookup pagination, literal regex handling, invalid parameters, parent linkage, branch/tenant isolation, attendance student identity and actual staff leave department/employee ID.
- Workforce integration suite: 136 real HTTP/MongoDB checks passed, including attendance processing, payroll actions, correction audits, permissions and approved-period locks.
- `git diff --check`: passed (line-ending notices only).
- Initial regression rerun failed because local MongoDB was stopped. Restarted loopback MongoDB on port 27018; subsequent workforce run passed. The failed run was not counted as a pass.

Browser verification used only `http://127.0.0.1:3005`, API port 5005 and the isolated local demo school. Production data and `.env` were not changed. No real salary payment, parent permission change or leave decision was submitted through the browser.

### Browser observations

- Document Class 1 / Section A / Ali Ahmed returned one matching student. Individual preview opened a real admission form. Class/bulk tab showed only the class printing workflow.
- Parent Add dialog opened separately from the directory; Class 1 / A / Ali Ahmed returned one child. Desktop and mobile dialog bounds were checked; at CSS 400 × 900 neither page nor dialog had horizontal overflow.
- Document Library at CSS 800 × 1000 wrapped its workspace tabs and filters without page horizontal overflow; tablet screenshot saved. Temporary viewport overrides were reset.
- Staff correction opened in a dialog. Payroll calculation confirmation explained that display filters do not limit whole-month calculation; Register and Totals views switched correctly.
- Salary search found Sana Ahmed and opened her own employment editor. Add a salary change was off by default.
- Calendar, sessions, classes, sections and subjects Add dialogs were opened and rendered screenshots reviewed.
- Student attendance Class 1 / A / Ali Ahmed showed four dated records, correct identifiers and 75% attendance (three present, one absent) from the local fixture.
- Leave requests displayed Teaching and actual employee IDs from employment records.
- Timetable weekly columns remained Monday–Saturday. No timetable entries were created or changed during this pass.

Screenshots initially failed but capture recovered after local servers restarted. Saved PNGs in this directory contain only synthetic demo records.

## Limits / remaining review

This is the named School Admin workflow pass, not a claim that every page of every portal has been visually approved. Shared components affect other callers, but Finance/Teacher/Parent/Reception/Examination portals have not each received a complete visual walkthrough in this pass. Only representative mobile layout checks were made; not every page/device/browser combination was tested. Parent directory filtering currently operates on the authorized loaded directory; its table is paginated, while child lookup pagination is server-side.

Manual review: sign in normally, choose a specific branch, open the routes above and test Add/Edit/Cancel, search and clear filters. Only save changes on a disposable test school. Confirm business permissions with the intended role before using any payroll or account action.
