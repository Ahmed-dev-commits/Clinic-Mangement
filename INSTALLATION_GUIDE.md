# 🏥 Hospital Management System - Complete Installation Guide

## System Requirements

| Component | Requirement |
|-----------|-------------|
| Operating System | Windows 10/11 (64-bit) |
| RAM | 4 GB minimum, 8 GB recommended |
| Disk Space | 500 MB |
| Node.js | v18 or higher |
| Microsoft Access | 2016 or later (or Access Database Engine) |

---

## Step 1: Install Prerequisites

### 1.1 Install Node.js
1. Download from https://nodejs.org (LTS version)
2. Run the installer, check "Add to PATH"
3. Verify: Open Command Prompt and run:
   ```bash
   node --version
   npm --version
   ```

### 1.2 Install Microsoft Access Database Engine
1. Download from https://www.microsoft.com/en-us/download/details.aspx?id=54920
2. Choose **AccessDatabaseEngine_X64.exe** (64-bit)
3. Run the installer

### 1.3 Install Git (Optional but Recommended)
1. Download from https://git-scm.com
2. Run the installer with default settings

---

## Step 2: Get the Application

### Option A: Using Git
```bash
git clone https://github.com/YOUR-USERNAME/hospital-management.git
cd hospital-management
```

### Option B: Download ZIP
1. Go to the GitHub repository
2. Click "Code" → "Download ZIP"
3. Extract to desired location

---

## Step 3: Create the Access Database

1. Navigate to `backend/database/` folder
2. Open **Microsoft Access**
3. Create a **New Blank Desktop Database**
4. Save as `HospitalDB.accdb` in the `backend/database/` folder

### Create Tables:

#### Table 1: Patients
| Field Name | Data Type | Description |
|------------|-----------|-------------|
| ID | Short Text (20) | Primary Key |
| Name | Short Text (100) | Patient name |
| Age | Number (Integer) | Patient age |
| Gender | Short Text (10) | Male/Female/Other |
| Phone | Short Text (20) | Phone number |
| Address | Long Text | Address |
| VisitDate | Short Text (20) | Visit date |
| Symptoms | Long Text | Symptoms |
| CreatedAt | Short Text (50) | Timestamp |

#### Table 2: Stock
| Field Name | Data Type | Description |
|------------|-----------|-------------|
| ID | Short Text (20) | Primary Key |
| Name | Short Text (100) | Item name |
| Category | Short Text (50) | Category |
| Quantity | Number (Long Integer) | Stock quantity |
| Price | Number (Double) | Unit price |
| LowStockThreshold | Number (Long Integer) | Alert threshold |
| CreatedAt | Short Text (50) | Timestamp |

#### Table 3: Payments
| Field Name | Data Type | Description |
|------------|-----------|-------------|
| ID | Short Text (20) | Primary Key |
| PatientID | Short Text (20) | Patient reference |
| PatientName | Short Text (100) | Patient name |
| ConsultationFee | Number (Double) | Consultation fee |
| LabFee | Number (Double) | Lab fee |
| MedicineFee | Number (Double) | Medicine fee |
| TotalAmount | Number (Double) | Total |
| PaymentMode | Short Text (20) | Cash/Card |
| Medicines | Long Text | JSON data |
| CreatedAt | Short Text (50) | Timestamp |

#### Table 4: Prescriptions
| Field Name | Data Type | Description |
|------------|-----------|-------------|
| ID | Short Text (20) | Primary Key |
| PatientID | Short Text (20) | Patient reference |
| PatientName | Short Text (100) | Patient name |
| PatientAge | Number (Integer) | Age |
| Diagnosis | Long Text | Diagnosis |
| Medicines | Long Text | JSON data |
| LabTests | Long Text | JSON data |
| DoctorNotes | Long Text | Notes |
| Precautions | Long Text | Precautions |
| GeneratedText | Long Text | Generated prescription |
| FollowUpDate | Short Text (20) | Follow-up date |
| CreatedAt | Short Text (50) | Timestamp |

#### Table 5: LabResults
| Field Name | Data Type | Description |
|------------|-----------|-------------|
| ID | Short Text (20) | Primary Key |
| PatientID | Short Text (20) | Patient reference |
| PatientName | Short Text (100) | Patient name |
| PatientAge | Number (Integer) | Age |
| TestDate | Short Text (20) | Test date |
| ReportDate | Short Text (20) | Report date |
| Tests | Long Text | JSON data |
| Notes | Long Text | Notes |
| Technician | Short Text (100) | Technician name |
| Status | Short Text (30) | Status |
| NotifiedAt | Short Text (50) | Notification time |
| CollectedAt | Short Text (50) | Collection time |
| CreatedAt | Short Text (50) | Timestamp |

5. **Save and Close** the database

---

## Step 4: Install Application

### 4.1 Install Frontend Dependencies
```bash
cd hospital-management
npm install
```

### 4.2 Install Backend Dependencies
```bash
cd backend
npm install
```

---

## Step 5: Start the Application

### Open TWO Command Prompt Windows:

**Window 1 - Backend Server:**
```bash
cd hospital-management/backend
npm start
```
You should see: `🏥 Hospital Management Backend running on http://localhost:3001`

**Window 2 - Frontend Application:**
```bash
cd hospital-management
npm run dev
```
You should see: `Local: http://localhost:8080`

### Open Browser
Go to: **http://localhost:8080**

---

## Step 6: Create Desktop Shortcut (Optional)

1. Create a file `start-hospital.bat` in the project folder:
```batch
@echo off
echo Starting Hospital Management System...
start cmd /k "cd /d %~dp0backend && npm start"
timeout /t 3
start cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 5
start http://localhost:8080
```

2. Right-click → Send to → Desktop (create shortcut)
3. Double-click the shortcut to start the application

---

## Troubleshooting

### Problem: "Provider not found" error
**Solution:** Install Microsoft Access Database Engine 2016 (64-bit)

### Problem: Backend won't start
**Solution:** 
1. Close Microsoft Access if the database is open
2. Check that `HospitalDB.accdb` exists in `backend/database/`

### Problem: Cannot connect to backend
**Solution:** 
1. Ensure backend is running on port 3001
2. Check Windows Firewall settings

### Problem: Data not saving
**Solution:**
1. Check database file permissions
2. Ensure database is not open in Access

---

## Backup Recommendations

1. **Daily Backup:** Copy `HospitalDB.accdb` to a backup folder
2. **Location:** Store backups on a separate drive or cloud storage
3. **Retention:** Keep at least 7 days of backups

---

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the `backend/README.md` file
3. Contact your system administrator

---

**Version:** 1.0.0  
**Last Updated:** January 2026
