# Hospital Management System - MS Access Backend

## Prerequisites

1. **Windows 10/11** (64-bit required)
2. **Node.js v18+** - Download from https://nodejs.org
3. **Microsoft Access Database Engine 2016** (64-bit)
   - Download: https://www.microsoft.com/en-us/download/details.aspx?id=54920
   - Choose `AccessDatabaseEngine_X64.exe`

## Setup Instructions

### Step 1: Create the Access Database

1. Open **Microsoft Access**
2. Create a **New Blank Database**
3. Save as `HospitalDB.accdb` in the `backend/database/` folder
4. Create the following tables (see `database/create-database.sql` for field details):
   - **Patients** - Patient records
   - **Stock** - Medicine/supplies inventory
   - **Payments** - Fee collection records
   - **Prescriptions** - Doctor prescriptions
   - **LabResults** - Lab test results

### Step 2: Install Dependencies

```bash
cd backend
npm install
```

### Step 3: Start the Server

```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

The server will run on `http://localhost:3001`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | Get all patients |
| POST | `/api/patients` | Add new patient |
| PUT | `/api/patients/:id` | Update patient |
| DELETE | `/api/patients/:id` | Delete patient |
| GET | `/api/stock` | Get all stock items |
| POST | `/api/stock` | Add stock item |
| PUT | `/api/stock/:id` | Update stock item |
| DELETE | `/api/stock/:id` | Delete stock item |
| GET | `/api/payments` | Get all payments |
| POST | `/api/payments` | Add payment |
| GET | `/api/prescriptions` | Get all prescriptions |
| POST | `/api/prescriptions` | Add prescription |
| GET | `/api/lab-results` | Get all lab results |
| POST | `/api/lab-results` | Add lab result |
| PUT | `/api/lab-results/:id/status` | Update lab status |
| GET | `/api/health` | Health check |

## Troubleshooting

### "Provider not found" Error
- Install Microsoft Access Database Engine 2016 (64-bit)
- Ensure you're using 64-bit Node.js

### "Database is locked" Error
- Close Microsoft Access if the database is open
- Only one application can write to Access at a time

### Connection Issues
- Verify `HospitalDB.accdb` exists in `backend/database/`
- Check the file path in `server.js`
