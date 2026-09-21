# EvoERP — Product & UI/UX Design

## 1. Design Goals

- Modern school ERP feel
- Simple navigation
- Role-specific dashboards
- Mobile-friendly responsive layouts
- Consistent forms, tables, filters, actions and feedback
- Minimize cognitive load for teachers and administrative staff

## 2. Global Application Shell

- Sidebar
- Top header
- School/tenant context
- User menu
- Notifications
- Breadcrumbs
- Page title
- Main content area

## 3. Role-Specific Navigation

### Admin
Dashboard, Users, Students, Teachers, Classes, Attendance, Exams, Fees, Reports, Notices, Settings

### Teacher
Dashboard, My Classes, Attendance, Exams/Marks, Students, Notices

### Accountant
Dashboard, Fee Structures, Invoices, Payments, Receipts, Reports

### Parent
Dashboard, Child Profile, Attendance, Marks, Fees, Notices

### Student
Dashboard, Attendance, Marks, Fees, Timetable, Notices

## 4. Core Screen Inventory

### Authentication
- Login
- Forgot password
- Session/error states

### Student Management
- Student list
- Add/edit student
- Student profile
- Admission/document section
- Search/filter

### Attendance
- Select class/date
- Mark attendance
- Attendance history
- Attendance summary

### Exams
- Exam list
- Exam setup
- Marks entry
- Grade calculation
- Report card

### Fees
- Fee structure
- Invoice list
- Invoice detail
- Payment entry
- Receipt
- Defaulter report

### Parent Portal
- Child selector
- Attendance
- Grades
- Fee status
- Notices

## 5. Design System

Define:
- typography scale
- spacing scale
- buttons
- inputs
- selects
- tables
- cards
- badges/statuses
- dialogs
- toast/error states
- empty states
- loading states

## 6. UX Rules

- Destructive actions require confirmation.
- Validation errors appear near the relevant field.
- Lists need search/filter/pagination where data can grow.
- Every major operation should provide success/failure feedback.
- Permissions must be reflected in both UI visibility and server authorization.

## 7. Wireframe Requirement

Before implementing a major module, create a simple screen flow and data-flow sketch. Final visual polish can be iterated after the workflow is proven.
