# Annamithra — Restaurant & Branch Order Management System (`annamithra1`)

Enterprise Multi-Tenant Restaurant & Branch Order Management System built with React + Vite frontend, Spring Boot 3 Java backend, and Supabase PostgreSQL.

## Features
- **4 Dedicated Roles & Portals**:
  - **Master Admin**: Provision organisations, organisation admins, manage organisation status (Active/Suspended/Trial).
  - **Organisation Admin**: Create branches, provision branch manager credentials, configure central warehouse store manager credentials, monitor purchase order history.
  - **Store Manager**: Central warehouse inventory management, receiving items against purchase orders or directly, aggregating and fulfilling branch requests, dispatching stock, comprehensive reports (Orders, Inventory Entries, Dispatches).
  - **Branch Manager**: Fast keyboard item entry, autocomplete search across catalogue, request multi-item orders, delivery acknowledgement, returns management, request history.
- **Full Mobile Responsiveness**:
  - Tested across mobile screen widths (320px, 375px, 390px, 430px), tablets, and desktop displays.
  - Slide-in mobile drawer with touch navigation, user badge, and accessible logout.
  - Container-constrained touch scrolling (`-webkit-overflow-scrolling: touch`) for all data tables.
  - 16px minimum font size on mobile inputs to eliminate iOS Safari auto-zooming.
- **Bilingual Interface**: Seamless instant toggle between English and Tamil (தமிழ்).
- **PDF & CSV Export**: Download professional purchase order PDFs and CSV reports.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18+
- **Java**: JDK 17+
- **Maven**: 3.8+
- **PostgreSQL / Supabase**: Supabase connection string

### 2. Configure Supabase PostgreSQL
Set your database credentials as environment variables before starting the backend:

**Windows PowerShell:**
```powershell
$env:DATABASE_URL="jdbc:postgresql://YOUR_SUPABASE_HOST:5432/postgres?sslmode=require"
$env:DATABASE_USERNAME="YOUR_DATABASE_USER"
$env:DATABASE_PASSWORD="YOUR_DATABASE_PASSWORD"
```

**Linux / macOS:**
```bash
export DATABASE_URL='jdbc:postgresql://YOUR_SUPABASE_HOST:5432/postgres?sslmode=require'
export DATABASE_USERNAME='YOUR_DATABASE_USER'
export DATABASE_PASSWORD='YOUR_DATABASE_PASSWORD'
```

### 3. Run Backend (Spring Boot)
```bash
cd backend
mvn spring-boot:run
```
Backend runs on `http://localhost:8080`.
Health endpoint: `http://localhost:8080/api/health`

### 4. Run Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.
