/**
 * Hospital Management System - MySQL Backend Server
 * This server uses MySQL for reliable data storage
 */

const fs = require('fs');
const path = require('path');

// Standard .env loading
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);
require('dotenv').config();

console.log('-------------------------------------------');
console.log('🚀 SERVER STARTING...');
console.log(`📂 Current Directory: ${__dirname}`);
console.log(`📄 .env file found: ${envExists ? 'YES' : 'NO'}`);
console.log(`📡 PORT configured: ${process.env.PORT || '3001 (Default)'}`);
console.log('-------------------------------------------');

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();

// ============ SIMPLE FILE LOGGER ============
const logFile = path.join(__dirname, 'app.log');
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function logToFile(type, args) {
  try {
    const message = args.map(arg => {
      try {
        return (typeof arg === 'object' ? JSON.stringify(arg) : String(arg));
      } catch (e) {
        return "[Unserializable Object]";
      }
    }).join(' ');

    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] ${message}\n`;

    // Append to file asynchronously
    fs.appendFile(logFile, logLine, (err) => {
      // Fail silently to avoid infinite loops if logging fails
    });
  } catch (e) {
    // Ultimate fallback if even the above fails
  }
}

console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  logToFile('INFO', args);
};

console.error = (...args) => {
  originalConsoleError.apply(console, args);
  logToFile('ERROR', args);
};
// ===========================================
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// 1. Strict No-Cache for API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// 2. Intelligent caching for Static Files (applied later)

// MySQL connection pool
let pool;
let dbConnected = false;

async function createPool() {
  const dbConfig = {
    waitForConnections: true,
    connectionLimit: process.env.DB_CONNECTION_LIMIT || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: 'Z',
    decimalNumbers: true
  };

  if (process.env.DATABASE_URL) {
    console.log('🔗 Using DATABASE_URL for connection');
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      ...dbConfig
    });
  } else {
    console.log('🔗 Using Explicit Environment Variables for connection');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   User: ${process.env.DB_USER || 'root'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'hospital_db'}`);

    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hospital_db',
      port: process.env.DB_PORT || 3306,
      ...dbConfig
    });
  }
}

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Helper function to convert MySQL rows with dates to ISO format
function convertRowDates(row) {
  if (!row) return row;

  const converted = { ...row };

  // Convert CreatedAt if it exists
  if (converted.CreatedAt && !(converted.CreatedAt instanceof Date)) {
    const date = new Date(converted.CreatedAt);
    if (!isNaN(date.getTime())) {
      converted.CreatedAt = date.toISOString();
    } else {
      // Keep original or set to null/default? 
      // Safest is to keep original string or null, but for this app consistency:
      converted.CreatedAt = new Date().toISOString();
    }
  }

  // Convert other date fields
  ['UpdatedAt', 'NotifiedAt', 'CollectedAt', 'VisitDate', 'TestDate', 'ReportDate', 'FollowUpDate'].forEach(field => {
    if (converted[field] && !(converted[field] instanceof Date)) {
      const date = new Date(converted[field]);
      if (!isNaN(date.getTime())) {
        converted[field] = date.toISOString();
      }
    }
  });

  // Convert JSON fields if they are strings (some MySQL drivers don't auto-parse JSON columns)
  ['Data', 'Medicines', 'LabTests', 'Tests', 'Services', 'Items', 'SelectedTests'].forEach(field => {
    if (converted[field] && typeof converted[field] === 'string') {
      try {
        // Check if it's actually a JSON string (starts with { or [)
        const trimmed = converted[field].trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          converted[field] = JSON.parse(converted[field]);
        }
      } catch (e) {
        // Not a JSON string or already handled
      }
    }
  });

  return converted;
}

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create connection pool
    await createPool();

    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database');
    connection.release();

    // Patients table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Patients (
        ID VARCHAR(50) PRIMARY KEY,
        Name VARCHAR(255) NOT NULL,
        Age INT,
        Gender VARCHAR(20),
        Phone VARCHAR(20),
        Address TEXT,
        VisitDate VARCHAR(50),
        Symptoms TEXT,
        CreatedBy VARCHAR(100),
        CreatedByRole VARCHAR(50),
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attempt to add new columns if they don't exist (migration)
    try { await pool.execute("ALTER TABLE Patients ADD COLUMN CreatedBy VARCHAR(100)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Patients ADD COLUMN CreatedByRole VARCHAR(50)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Patients ADD COLUMN CreatedByRole VARCHAR(50)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Patients ADD COLUMN GuardianName VARCHAR(255)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Patients ADD COLUMN CNIC VARCHAR(20)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Patients ADD COLUMN AgeMonths INT DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Patients ADD COLUMN AgeDays INT DEFAULT 0"); } catch (e) { }

    // Stock table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Stock (
        ID VARCHAR(50) PRIMARY KEY,
        Name VARCHAR(255) NOT NULL,
        Category VARCHAR(100),
        Quantity INT DEFAULT 0,
        Price DECIMAL(10, 2) DEFAULT 0,
        LowStockThreshold INT DEFAULT 10,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Payments table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Payments (
        ID VARCHAR(50) PRIMARY KEY,
        PatientID VARCHAR(50),
        PatientName VARCHAR(255),
        ConsultationFee DECIMAL(10, 2) DEFAULT 0,
        LabFee DECIMAL(10, 2) DEFAULT 0,
        MedicineFee DECIMAL(10, 2) DEFAULT 0,
        TotalAmount DECIMAL(10, 2) DEFAULT 0,
        PaymentMode VARCHAR(50),
        Medicines TEXT,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attempt to add Items column to Payments (Migration)
    try { await pool.execute("ALTER TABLE Payments ADD COLUMN Items TEXT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payments ADD COLUMN LabPatientID VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("CREATE INDEX idx_payments_patientid ON Payments(PatientID)"); } catch (e) { }
    try { await pool.execute("CREATE INDEX idx_payments_labpatientid ON Payments(LabPatientID)"); } catch (e) { }

    // Prescriptions table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Prescriptions (
        ID VARCHAR(50) PRIMARY KEY,
        PatientID VARCHAR(50),
        PatientName VARCHAR(255),
        PatientAge INT,
        Diagnosis TEXT,
        Medicines TEXT,
        LabTests TEXT,
        DoctorNotes TEXT,
        Precautions TEXT,
        GeneratedText TEXT,
        FollowUpDate VARCHAR(50),
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Auto-migration: Add new columns if they don't exist
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN Complaints TEXT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN History TEXT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN OnExamination TEXT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN TreatmentInHospital TEXT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN TreatmentAtHome TEXT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN CtgUsgReport TEXT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN PatientAgeMonths INT DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN PatientAgeDays INT DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN Status VARCHAR(20) DEFAULT 'Draft'"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN FinalizedAt DATETIME NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN LastUpdatedAt DATETIME NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN IsLocked TINYINT(1) DEFAULT 0"); } catch (e) { }

    // Ensure Medicines and LabTests are JSON type (for MySQL 5.7+)
    try { await pool.execute("ALTER TABLE Prescriptions MODIFY COLUMN Medicines JSON"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions MODIFY COLUMN LabTests JSON"); } catch (e) { }


    // PrescriptionMedicines table - For doctor prescriptions AND master clinical list
    // If PrescriptionID is NULL, it's a master clinical medicine
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS PrescriptionMedicines (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        PrescriptionID VARCHAR(50),
        MedicineName VARCHAR(255) NOT NULL,
        Category VARCHAR(100),
        Dosage VARCHAR(50),
        Frequency VARCHAR(100),
        Duration VARCHAR(50),
        Quantity INT DEFAULT 1,
        FOREIGN KEY (PrescriptionID) REFERENCES Prescriptions(ID) ON DELETE CASCADE
      )
    `);

    // Visits table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Visits (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        PatientID VARCHAR(50),
        VisitDate VARCHAR(50),
        Symptoms TEXT,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (PatientID) REFERENCES Patients(ID) ON DELETE CASCADE
      )
    `);

    // LabTestsCatalog table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS LabTestsCatalog (
        ID VARCHAR(50) PRIMARY KEY,
        Name VARCHAR(255) NOT NULL,
        Category VARCHAR(100),
        Unit VARCHAR(50),
        NormalRange VARCHAR(255),
        Price DECIMAL(10, 2) DEFAULT 0,
        ReferenceRangeMale VARCHAR(255),
        ReferenceRangeFemale VARCHAR(255),
        ReferenceRangeChild VARCHAR(255),
        CriticalValueRange VARCHAR(255),
        SampleType VARCHAR(100),
        Method VARCHAR(255),
        TurnaroundTime VARCHAR(100),
        Status VARCHAR(50) DEFAULT 'Active',
        IsProfile TINYINT(1) DEFAULT 0,
        ProfileTests JSON,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrations for LabTestsCatalog (if columns missing)
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN ReferenceRangeMale VARCHAR(255)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN ReferenceRangeFemale VARCHAR(255)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN ReferenceRangeChild VARCHAR(255)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN CriticalValueRange VARCHAR(255)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN SampleType VARCHAR(100)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN Method VARCHAR(255)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN TurnaroundTime VARCHAR(100)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN Status VARCHAR(50) DEFAULT 'Active'"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN IsProfile TINYINT(1) DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN ProfileTests JSON"); } catch (e) { }


    // LabResults table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS LabResults (
        ID VARCHAR(50) PRIMARY KEY,
        LabPatientID VARCHAR(50) NOT NULL,
        PatientName VARCHAR(255),
        PatientAge INT,
        TestDate VARCHAR(50),
        ReportDate VARCHAR(50),
        Tests TEXT,
        Notes TEXT,
        Technician VARCHAR(255),
        Status VARCHAR(50),
        ReferredBy VARCHAR(255) DEFAULT 'Self',
        NotifiedAt DATETIME NULL,
        CollectedAt DATETIME NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrations for LabResults
    try { await pool.execute("ALTER TABLE LabResults CHANGE COLUMN PatientID LabPatientID VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults CHANGE COLUMN ClinicPatientID LabPatientID VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN LabPatientID VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults MODIFY COLUMN LabPatientID VARCHAR(50) NOT NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN PatientAge INT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN ReportDate VARCHAR(50)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN Notes TEXT"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN Technician VARCHAR(255)"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN NotifiedAt DATETIME NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN CollectedAt DATETIME NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN ReferredBy VARCHAR(255) DEFAULT 'Self'"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults DROP COLUMN ClinicPatientID"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults DROP COLUMN PatientID"); } catch (e) { }

    // LabTestsCatalog Phase 1: machine assignment
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN Machine VARCHAR(100) NULL"); } catch (e) { }

    // LabPatients table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS LabPatients (
        ID VARCHAR(50) PRIMARY KEY,
        Name VARCHAR(255) NOT NULL,
        GuardianName VARCHAR(255),
        Age INT,
        AgeMonths INT DEFAULT 0,
        AgeDays INT DEFAULT 0,
        Gender VARCHAR(20),
        Phone VARCHAR(20),
        Address TEXT,
        CNIC VARCHAR(20),
        ReferringDoctorName VARCHAR(255),
        Priority VARCHAR(20) DEFAULT 'Normal',
        SelectedTests JSON NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // labpaymenthistory table (The Ledger)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS labpaymenthistory (
        ID VARCHAR(50) PRIMARY KEY,
        LabPatientID VARCHAR(50) NOT NULL,
        PatientName VARCHAR(255) NOT NULL,
        TotalAmount DECIMAL(10, 2) DEFAULT 0,
        DiscountAmount DECIMAL(10, 2) DEFAULT 0,
        PaidAmount DECIMAL(10, 2) DEFAULT 0,
        PaymentStatus VARCHAR(50) DEFAULT 'Unpaid',
        Tests JSON NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FinalizedAt DATETIME NULL
      )
    `);

    // Migrations for LabPatients
    try { await pool.execute("ALTER TABLE LabPatients ADD COLUMN SelectedTests JSON NULL"); } catch (e) { }

    // LabResults Priority migration
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN Priority VARCHAR(50) DEFAULT 'Normal'"); } catch (e) { }

    // Backfill Visits from Patients table
    // Insert a visit record for any patient who doesn't have one yet (migration for existing data)
    await pool.execute(`
      INSERT INTO Visits (PatientID, VisitDate, Symptoms, CreatedAt)
      SELECT ID, VisitDate, Symptoms, CreatedAt FROM Patients
      WHERE ID NOT IN (SELECT DISTINCT PatientID FROM Visits)
    `);













    // PatientServices table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS PatientServices(
  ID VARCHAR(50) PRIMARY KEY,
  PatientID VARCHAR(50) NOT NULL,
  Services TEXT,
  GrandTotal DECIMAL(10, 2) DEFAULT 0,
  Status VARCHAR(50) DEFAULT 'Draft',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
  `);

    // Users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Users(
    ID VARCHAR(50) PRIMARY KEY,
    Username VARCHAR(100) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Name VARCHAR(255) NOT NULL,
    Email VARCHAR(255),
    Phone VARCHAR(50),
    Role VARCHAR(50) DEFAULT 'Receptionist',
    Permissions TEXT,
    IsActive TINYINT DEFAULT 1,
    CreatedBy VARCHAR(50),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    LastLogin DATETIME
  )
  `);

    // Roles table - dynamic roles managed by admin
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Roles (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Name VARCHAR(100) UNIQUE NOT NULL,
        Description TEXT,
        IsSystem TINYINT(1) DEFAULT 0,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // RolePermissions table - default permissions for each role
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS RolePermissions (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        RoleName VARCHAR(100) NOT NULL,
        Permission VARCHAR(100) NOT NULL,
        UNIQUE KEY unique_role_perm (RoleName, Permission)
      )
    `);

    // ==========================================
    // DATABASE PERFORMANCE INDEXES (Phase 5)
    // ==========================================
    const createIndex = async (query) => {
      try { await pool.execute(query); } catch (e) { /* ER_DUP_KEYNAME is expected */ }
    };

    // Patients
    await createIndex('ALTER TABLE Patients ADD INDEX idx_patients_created_at (CreatedAt)');
    await createIndex('ALTER TABLE Patients ADD INDEX idx_patients_search (Phone, CNIC)');
    // Prescriptions
    await createIndex('ALTER TABLE Prescriptions ADD INDEX idx_rx_created_at (CreatedAt)');
    await createIndex('ALTER TABLE Prescriptions ADD INDEX idx_rx_patient_status (PatientID, Status)');
    await createIndex('ALTER TABLE Prescriptions ADD INDEX idx_rx_follow_up (FollowUpDate)');
    // Payments
    await createIndex('ALTER TABLE Payments ADD INDEX idx_payments_created_at (CreatedAt)');
    await createIndex('ALTER TABLE Payments ADD INDEX idx_payments_patient (PatientID)');
    // LabResults
    await createIndex('ALTER TABLE LabResults ADD INDEX idx_lab_created_at (CreatedAt)');
    await createIndex('ALTER TABLE LabResults ADD INDEX idx_lab_patient_status (LabPatientID, Status)');
    // Visits
    await createIndex('ALTER TABLE Visits ADD INDEX idx_visits_date (VisitDate)');
    await createIndex('ALTER TABLE Visits ADD INDEX idx_visits_created_at (CreatedAt)');

    // Seed default roles if none exist
    const [roleCount] = await pool.execute('SELECT COUNT(*) as count FROM Roles');
    if (roleCount[0].count === 0) {
      const defaultRoles = [
        { name: 'Admin', description: 'Full system access', isSystem: 1 },
        { name: 'Doctor', description: 'Clinical operations access', isSystem: 1 },
        { name: 'Receptionist', description: 'Front desk and patient registration', isSystem: 1 },
        { name: 'LabTechnician', description: 'Lab results management', isSystem: 1 },
      ];
      for (const role of defaultRoles) {
        await pool.execute(
          'INSERT INTO Roles (Name, Description, IsSystem) VALUES (?, ?, ?)',
          [role.name, role.description, role.isSystem]
        );
      }

      // Seed default permissions per role
      const defaultRolePermissions = {
        Admin: ['page_dashboard', 'page_patients', 'page_fees', 'page_medicines', 'page_pharmacy', 'page_prescriptions', 'page_lab_registration', 'page_lab_fees', 'page_lab_results', 'page_pathology', 'page_users', 'page_expenses', 'page_settings'],
        Doctor: ['page_dashboard', 'page_patients', 'page_medicines', 'page_prescriptions', 'page_settings'],
        Receptionist: ['page_dashboard', 'page_patients', 'page_fees', 'page_pharmacy', 'page_expenses', 'page_settings'],
        LabTechnician: ['page_dashboard', 'page_lab_registration', 'page_lab_fees', 'page_lab_results', 'page_pathology', 'page_settings'],
      };
      for (const [roleName, permissions] of Object.entries(defaultRolePermissions)) {
        for (const perm of permissions) {
          await pool.execute(
            'INSERT IGNORE INTO RolePermissions (RoleName, Permission) VALUES (?, ?)',
            [roleName, perm]
          );
        }
      }
      console.log('✅ Default roles and permissions seeded');
    }

    // Insert default users if none exist
    const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM Users');
    if (userCount[0].count === 0) {
      const defaultUsers = [
        { id: 'USR-000', username: 'admin', password: 'Admin123@#', name: 'System Admin', role: 'Admin' },
        { id: 'USR-001', username: 'receptionist', password: 'reception123', name: 'Front Desk', role: 'Receptionist' },
        { id: 'USR-002', username: 'doctor', password: 'doctor123', name: 'Dr. Admin', role: 'Doctor' },
        { id: 'USR-003', username: 'labtech', password: 'lab123', name: 'Lab Technician', role: 'LabTechnician' },
      ];

      for (const user of defaultUsers) {
        await pool.execute(
          'INSERT INTO Users (ID, Username, Password, Name, Role) VALUES (?, ?, ?, ?, ?)',
          [user.id, user.username, user.password, user.name, user.role]
        );
      }
    } else {
      // Force update admin password if table already exists (as requested by user)
      await pool.execute(
        "UPDATE Users SET Password = ? WHERE Username = 'admin'",
        ['Admin123@#']
      );
    }
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS DailyExpenses(
    ID VARCHAR(50) PRIMARY KEY,
    Date VARCHAR(50),
    Description TEXT,
    Category VARCHAR(100),
    Amount DECIMAL(10, 2) DEFAULT 0,
    PaymentMethod VARCHAR(50),
    CreatedBy VARCHAR(100),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `);

    // LabVisits table with payment columns
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS LabVisits (
        ID VARCHAR(50) PRIMARY KEY,
        LabPatientID VARCHAR(50) NOT NULL,
        VisitDate DATE NOT NULL,
        Status VARCHAR(50) DEFAULT 'Pending',
        SelectedTests JSON NULL,
        TotalAmount DECIMAL(10, 2) DEFAULT 0,
        DiscountAmount DECIMAL(10, 2) DEFAULT 0,
        PaidAmount DECIMAL(10, 2) DEFAULT 0,
        PaymentStatus VARCHAR(50) DEFAULT 'Unpaid',
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // LabFeesLedger table for the ledger
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS LabFeesLedger (
        ID VARCHAR(50) PRIMARY KEY,
        LabPatientID VARCHAR(50) NOT NULL,
        VisitID VARCHAR(50) NOT NULL,
        AmountPaid DECIMAL(10, 2) NOT NULL,
        PaymentMethod VARCHAR(50) DEFAULT 'Cash',
        Notes TEXT,
        PaymentDate DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Stock table (Medicine Inventory - separate from prescriptions)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS stock(
    ID VARCHAR(50) PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    Category VARCHAR(100),
    Quantity INT DEFAULT 0,
    Price DECIMAL(10, 2) DEFAULT 0,
    LowStockThreshold INT DEFAULT 10,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
  `);

    // Insert default users if none exist
    const [users] = await pool.execute('SELECT COUNT(*) as count FROM Users');
    if (users[0].count === 0) {
      const defaultUsers = [
        { id: 'USR-000', username: 'admin', password: 'admin123', name: 'System Admin', role: 'Admin' },
        { id: 'USR-001', username: 'receptionist', password: 'reception123', name: 'Front Desk', role: 'Receptionist' },
        { id: 'USR-002', username: 'doctor', password: 'doctor123', name: 'Dr. Admin', role: 'Doctor' },
        { id: 'USR-003', username: 'labtech', password: 'lab123', name: 'Lab Technician', role: 'LabTechnician' },
      ];

      for (const user of defaultUsers) {
        await pool.execute(
          'INSERT INTO Users (ID, Username, Password, Name, Role) VALUES (?, ?, ?, ?, ?)',
          [user.id, user.username, user.password, user.name, user.role]
        );
      }
    }

    // Check if Prescriptions table has new columns, if not add them
    try {
      await pool.execute('SELECT Complaints FROM Prescriptions LIMIT 1');
    } catch (error) {
      console.log('⚡ Adding new columns to Prescriptions table...');
      try { await pool.execute('ALTER TABLE Prescriptions ADD COLUMN Complaints TEXT'); } catch (e) { }
      try { await pool.execute('ALTER TABLE Prescriptions ADD COLUMN History TEXT'); } catch (e) { }
      try { await pool.execute('ALTER TABLE Prescriptions ADD COLUMN OnExamination TEXT'); } catch (e) { }
      try { await pool.execute('ALTER TABLE Prescriptions ADD COLUMN TreatmentInHospital TEXT'); } catch (e) { }
      try { await pool.execute('ALTER TABLE Prescriptions ADD COLUMN TreatmentAtHome TEXT'); } catch (e) { }
    }
    // AppSettings table - For Global and User-specific settings
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS AppSettings (
        ID VARCHAR(50) PRIMARY KEY, -- 'GLOBAL' or UserID
        Category VARCHAR(50) NOT NULL, -- 'Global' or 'User'
        Data JSON,
        UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert Default Global Settings if not exists
    const [settingsCount] = await pool.execute("SELECT COUNT(*) as count FROM AppSettings WHERE ID = 'GLOBAL'");
    if (settingsCount[0].count === 0) {
      const defaultGlobalSettings = {
        clinicName: 'Salamaat Medicare',
        address: 'Qabarastan Road Wah Cantt',
        city: 'Wah Cantt',
        phone: '+91 98765 43210',
        email: 'care@salamaat.com',
        logo: null,
        pdfSettings: {
          primaryColor: '#1a56db',
          secondaryColor: '#64748b',
          footerText: 'Please consult your doctor before taking any medicine. Self-medication can be harmful.',
          showLogo: true,
          showWatermark: true,
        },
        themeColor: '221 83% 53%'
      };
      await pool.execute(
        "INSERT INTO AppSettings (ID, Category, Data) VALUES (?, ?, ?)",
        ['GLOBAL', 'Global', JSON.stringify(defaultGlobalSettings)]
      );
      console.log('✅ Default Global Settings initialized');
    }

    console.log('✅ Prescriptions table schema updated');

    // GenericMedicines table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS GenericMedicines (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Name VARCHAR(255) NOT NULL,
        Category VARCHAR(100),
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);


    const [genericCount] = await pool.execute('SELECT COUNT(*) as count FROM GenericMedicines');
    if (genericCount[0].count === 0) {
      console.log('⚡ Auto-seeding 201 Generic Medicines...');
      const meds = [{ "Name": "Acefyl Syrup", "Category": "Syrup" }, { "Name": "Aldomet (Methyldopa) 250mg Tablet", "Category": "Tablet" }, { "Name": "Amaryl (Glimepiride) 1mg Tablet", "Category": "Tablet" }, { "Name": "Amaryl (Glimepiride) 2mg Tablet", "Category": "Tablet" }, { "Name": "Amaryl (Glimepiride) 3mg Tablet", "Category": "Tablet" }, { "Name": "Amikacin (Amikin) 500mg IV/IM", "Category": "Injection" }, { "Name": "Aminoplasmal (Amino Acids) Infusion 500ml (Drip)", "Category": "Liquid" }, { "Name": "Amoxil (Amoxicillin) 250mg Capsule", "Category": "Capsule" }, { "Name": "Amoxil (Amoxicillin) 500mg Capsule", "Category": "Capsule" }, { "Name": "Amoxil Drops (100mg/ml)", "Category": "Syrup" }, { "Name": "Atropine Sulphate 1mg/ml Ampoule", "Category": "Injection" }, { "Name": "Atrovent (Ipratropium) Nebulizer Solution", "Category": "Liquid" }, { "Name": "Augmentin (Amoxicillin/Clavulanate) 1g Tablet", "Category": "Tablet" }, { "Name": "Augmentin (Amoxicillin/Clavulanate) 375mg Tablet", "Category": "Tablet" }, { "Name": "Augmentin (Amoxicillin/Clavulanate) 625mg Tablet", "Category": "Tablet" }, { "Name": "Augmentin Suspension (156mg/5ml)", "Category": "Syrup" }, { "Name": "Augmentin Suspension (312mg/5ml)", "Category": "Syrup" }, { "Name": "Avil (Pheniramine) 22.7mg/2ml IM/IV", "Category": "Injection" }, { "Name": "Betnesol Eye/Ear Drops", "Category": "Liquid" }, { "Name": "Betnovate (Betamethasone) Cream", "Category": "Cream" }, { "Name": "Brufen (Ibuprofen) 400mg Tablet", "Category": "Tablet" }, { "Name": "Brufen Syrup (100mg/5ml)", "Category": "Syrup" }, { "Name": "Buscopan (Hyoscine) 10mg Tablet", "Category": "Tablet" }, { "Name": "Buscopan (Hyoscine) 20mg/ml IM/IV", "Category": "Injection" }, { "Name": "Cac-1000 Plus (Calcium) Effervescent Tablet", "Category": "Tablet" }, { "Name": "Calcium Gluconate 10% 10ml Ampoule", "Category": "Injection" }, { "Name": "Calpol Syrup (120mg/5ml)", "Category": "Syrup" }, { "Name": "Canesten (Clotrimazole) Vaginal Tablet", "Category": "Tablet" }, { "Name": "Cataflam (Diclofenac Potassium) 50mg Tablet", "Category": "Tablet" }, { "Name": "Ciproxin (Ciprofloxacin) 200mg/100ml Infusion (Drip)", "Category": "Liquid" }, { "Name": "Ciproxin (Ciprofloxacin) 250mg Tablet", "Category": "Tablet" }, { "Name": "Ciproxin (Ciprofloxacin) 500mg Tablet", "Category": "Tablet" }, { "Name": "Claforan (Cefotaxime) 1g IV", "Category": "Injection" }, { "Name": "Clenil (Beclomethasone) Inhaler", "Category": "Liquid" }, { "Name": "Clomid (Clomiphene Citrate) 50mg Tablet", "Category": "Tablet" }, { "Name": "Concor (Bisoprolol) 5mg Tablet", "Category": "Tablet" }, { "Name": "Cotton Roll 400g", "Category": "Supplies" }, { "Name": "Cranmax Sachet", "Category": "Other" }, { "Name": "Crepe Bandage 3-inch", "Category": "Supplies" }, { "Name": "Cyclogest (Progesterone) 200mg Pessary", "Category": "Tablet" }, { "Name": "Cyclogest (Progesterone) 400mg Pessary", "Category": "Tablet" }, { "Name": "Cytotec (Misoprostol) 200mcg Tablet", "Category": "Tablet" }, { "Name": "D-Watson (Vitamin D3) 200,000 IU Injection/Ampoule", "Category": "Injection" }, { "Name": "Daktarin (Miconazole) Oral Gel", "Category": "Cream" }, { "Name": "Dermovate (Clobetasol) Cream", "Category": "Cream" }, { "Name": "Dexacort (Dexamethasone) 4mg/ml IM/IV", "Category": "Injection" }, { "Name": "Dexacort (Dexamethasone) 4mg/ml Injection (Maturity)", "Category": "Injection" }, { "Name": "Dextrose 10% Water (D10W) 500ml (Drip)", "Category": "Liquid" }, { "Name": "Dextrose 25% Water (D25W) 20ml Ampoule", "Category": "Liquid" }, { "Name": "Dextrose 5% Water (D5W) 1000ml (Drip)", "Category": "Liquid" }, { "Name": "Dextrose 5% Water (D5W) 500ml (Drip)", "Category": "Liquid" }, { "Name": "Dextrose Saline (D5 1/2NS) 1000ml (Drip)", "Category": "Liquid" }, { "Name": "Diazepam (Valium) 10mg/2ml Injection", "Category": "Injection" }, { "Name": "Dicloran (Diclofenac) 50mg Suppository", "Category": "Tablet" }, { "Name": "Disprin (Aspirin) 300mg Soluble Tablet", "Category": "Tablet" }, { "Name": "Duphalac (Lactulose) Syrup", "Category": "Syrup" }, { "Name": "Duphaston (Dydrogesterone) 10mg Tablet", "Category": "Tablet" }, { "Name": "Epinephrine (Adrenaline) 1mg/ml Ampoule", "Category": "Injection" }, { "Name": "Erythrocin (Erythromycin) 250mg Tablet", "Category": "Tablet" }, { "Name": "Fasigyn (Tinidazole) 500mg Tablet", "Category": "Tablet" }, { "Name": "Fefol Vit Capsule", "Category": "Capsule" }, { "Name": "Feris (Iron) Syrup", "Category": "Syrup" }, { "Name": "Fexet (Fexofenadine) 120mg Tablet", "Category": "Tablet" }, { "Name": "Fexet (Fexofenadine) 60mg Tablet", "Category": "Tablet" }, { "Name": "Flagyl (Metronidazole) 200mg Tablet", "Category": "Tablet" }, { "Name": "Flagyl (Metronidazole) 400mg Tablet", "Category": "Tablet" }, { "Name": "Flagyl (Metronidazole) 500mg/100ml Infusion (Drip)", "Category": "Liquid" }, { "Name": "Flagyl Suspension (200mg/5ml)", "Category": "Syrup" }, { "Name": "Folgard Tablet", "Category": "Tablet" }, { "Name": "Folic Acid 5mg Tablet", "Category": "Tablet" }, { "Name": "Fucicort (Fusidic Acid/Betamethasone) Cream", "Category": "Cream" }, { "Name": "Fucidin (Fusidic Acid) Cream 2%", "Category": "Cream" }, { "Name": "Gauze Swab Pack", "Category": "Supplies" }, { "Name": "Gaviscon Syrup", "Category": "Syrup" }, { "Name": "Gelofusine Infusion 500ml (Drip)", "Category": "Liquid" }, { "Name": "Gentamicin (Garamycin) 80mg/2ml IV/IM", "Category": "Injection" }, { "Name": "Glucophage (Metformin) 500mg Tablet", "Category": "Tablet" }, { "Name": "Glucophage (Metformin) 850mg Tablet", "Category": "Tablet" }, { "Name": "Glucovance 500/5mg Tablet", "Category": "Tablet" }, { "Name": "Gravibinon Injection", "Category": "Injection" }, { "Name": "Gravinate (Dimenhydrinate) 50mg Tablet", "Category": "Tablet" }, { "Name": "Gravinate (Dimenhydrinate) 50mg/ml IM/IV", "Category": "Injection" }, { "Name": "Gravinate Syrup", "Category": "Syrup" }, { "Name": "Gyno-Daktarin (Miconazole) Vaginal Cream", "Category": "Cream" }, { "Name": "Haemaccel Infusion 500ml (Drip)", "Category": "Liquid" }, { "Name": "Humulin 70/30 (Insulin) 100IU/ml", "Category": "Injection" }, { "Name": "Hydrozole (Hydrocortisone/Clotrimazole) Cream", "Category": "Cream" }, { "Name": "Hydryllin Syrup", "Category": "Syrup" }, { "Name": "Iberet Folic 500 Tablet", "Category": "Tablet" }, { "Name": "Inderal (Propranolol) 10mg Tablet", "Category": "Tablet" }, { "Name": "Inderal (Propranolol) 40mg Tablet", "Category": "Tablet" }, { "Name": "IV Branula (Cannula) 20G (Pink)", "Category": "Equipment" }, { "Name": "IV Branula (Cannula) 22G (Blue)", "Category": "Equipment" }, { "Name": "IV Branula (Cannula) 24G (Yellow)", "Category": "Equipment" }, { "Name": "Ketanov (Ketorolac) 30mg/ml Injection", "Category": "Injection" }, { "Name": "Kytril (Granisetron) 1mg/1ml Injection", "Category": "Injection" }, { "Name": "Kytril (Granisetron) 3mg/3ml Injection", "Category": "Injection" }, { "Name": "Lantus (Insulin Glargine) 100IU/ml", "Category": "Injection" }, { "Name": "Lasix (Furosemide) 20mg/2ml Injection", "Category": "Injection" }, { "Name": "Leflox (Levofloxacin) 250mg Tablet", "Category": "Tablet" }, { "Name": "Leflox (Levofloxacin) 500mg Tablet", "Category": "Tablet" }, { "Name": "Leflox (Levofloxacin) 500mg/100ml Infusion (Drip)", "Category": "Liquid" }, { "Name": "Letrozole 2.5mg Tablet", "Category": "Tablet" }, { "Name": "Lilac (Lactulose) Syrup", "Category": "Syrup" }, { "Name": "Lipget (Atorvastatin) 10mg Tablet", "Category": "Tablet" }, { "Name": "Lipget (Atorvastatin) 20mg Tablet", "Category": "Tablet" }, { "Name": "Magnesium Sulphate 50% Injection", "Category": "Injection" }, { "Name": "Mannitol 20% Infusion 500ml (Drip)", "Category": "Liquid" }, { "Name": "Maxolon (Metoclopramide) 10mg/2ml Injection", "Category": "Injection" }, { "Name": "Meropenem (Meronem) 1g IV", "Category": "Injection" }, { "Name": "Meropenem (Meronem) 500mg IV", "Category": "Injection" }, { "Name": "Methergin (Methylergometrine) 0.125mg Tablet", "Category": "Tablet" }, { "Name": "Methergin (Methylergometrine) 0.2mg Injection", "Category": "Injection" }, { "Name": "Methopt Eye Drops", "Category": "Liquid" }, { "Name": "Methycobal (Mecobalamin) 500mcg Injection", "Category": "Injection" }, { "Name": "Midazolam (Dormicum) 15mg/3ml Injection", "Category": "Injection" }, { "Name": "Mixtard 30 (Insulin) 100IU/ml", "Category": "Injection" }, { "Name": "Monurol (Fosfomycin) 3g Sachet", "Category": "Other" }, { "Name": "Morphine Sulphate 15mg/ml Injection", "Category": "Injection" }, { "Name": "Motilium (Domperidone) 10mg Tablet", "Category": "Tablet" }, { "Name": "Motilium Suspension", "Category": "Syrup" }, { "Name": "Mucaine Gel Syrup", "Category": "Syrup" }, { "Name": "Nalbuphine (Nubain) 10mg/ml Injection", "Category": "Injection" }, { "Name": "Neo-Penotran Forte Vaginal Suppository", "Category": "Tablet" }, { "Name": "Neurobion Injection", "Category": "Injection" }, { "Name": "Nexum (Esomeprazole) 20mg Capsule", "Category": "Capsule" }, { "Name": "Nexum (Esomeprazole) 40mg Capsule", "Category": "Capsule" }, { "Name": "Nexum (Esomeprazole) 40mg IV", "Category": "Injection" }, { "Name": "Nifedipine (Adalat) 10mg Tablet", "Category": "Tablet" }, { "Name": "No-Spa 40mg Tablet", "Category": "Tablet" }, { "Name": "Normal Saline (0.9% NaCl) 1000ml (Drip)", "Category": "Liquid" }, { "Name": "Normal Saline (0.9% NaCl) 100ml (Drip)", "Category": "Liquid" }, { "Name": "Normal Saline (0.9% NaCl) 500ml (Drip)", "Category": "Liquid" }, { "Name": "Norvasc (Amlodipine) 10mg Tablet", "Category": "Tablet" }, { "Name": "Norvasc (Amlodipine) 5mg Tablet", "Category": "Tablet" }, { "Name": "ORS (Oral Rehydration Salts) Sachet", "Category": "Other" }, { "Name": "Ostocalcium Tablet", "Category": "Tablet" }, { "Name": "Panadol (Paracetamol) 500mg Tablet", "Category": "Tablet" }, { "Name": "Panadol CF Tablet", "Category": "Tablet" }, { "Name": "Panadol Extra 500/65mg Tablet", "Category": "Tablet" }, { "Name": "Panadol Syrup (120mg/5ml)", "Category": "Syrup" }, { "Name": "Paracetamol 1g/100ml Infusion (Drip)", "Category": "Liquid" }, { "Name": "Phenergan (Promethazine) 25mg/ml Injection", "Category": "Injection" }, { "Name": "Polyfax Eye Ointment", "Category": "Cream" }, { "Name": "Ponstan (Mefenamic Acid) 250mg Tablet", "Category": "Tablet" }, { "Name": "Ponstan Forte 500mg Tablet", "Category": "Tablet" }, { "Name": "Pregnacare Plus Tablet", "Category": "Tablet" }, { "Name": "Proluton Depot (Hydroxyprogesterone) 250mg Injection", "Category": "Injection" }, { "Name": "Proluton Depot (Hydroxyprogesterone) 500mg Injection", "Category": "Injection" }, { "Name": "Prostin E2 (Dinoprostone) Vaginal Tablet", "Category": "Tablet" }, { "Name": "Pulmonol Syrup", "Category": "Syrup" }, { "Name": "Pyodine (Povidone-Iodine) Solution 10%", "Category": "Liquid" }, { "Name": "Quench Cream", "Category": "Cream" }, { "Name": "Rabies Vaccine (ARV) 0.5ml IM", "Category": "Injection" }, { "Name": "Rigix (Cetirizine) 10mg Tablet", "Category": "Tablet" }, { "Name": "Rigix Syrup (5mg/5ml)", "Category": "Syrup" }, { "Name": "Ringer Lactate (RL) 1000ml (Drip)", "Category": "Liquid" }, { "Name": "Ringer Lactate (RL) 500ml (Drip)", "Category": "Liquid" }, { "Name": "Risek (Omeprazole) 20mg Capsule", "Category": "Capsule" }, { "Name": "Risek (Omeprazole) 40mg Capsule", "Category": "Capsule" }, { "Name": "Risek (Omeprazole) 40mg IV", "Category": "Injection" }, { "Name": "Rocephin (Ceftriaxone) 1g IV", "Category": "Injection" }, { "Name": "Rocephin (Ceftriaxone) 250mg IM", "Category": "Injection" }, { "Name": "Rocephin (Ceftriaxone) 500mg IM", "Category": "Injection" }, { "Name": "Sancos Syrup", "Category": "Syrup" }, { "Name": "Sangobion Capsule", "Category": "Capsule" }, { "Name": "Softin (Loratadine) 10mg Tablet", "Category": "Tablet" }, { "Name": "Solu-Cortef (Hydrocortisone) 100mg IV", "Category": "Injection" }, { "Name": "Solu-Cortef (Hydrocortisone) 250mg IV", "Category": "Injection" }, { "Name": "Spasler P Tablet", "Category": "Tablet" }, { "Name": "Sunny D (Vitamin D3) 200,000 IU Capsule", "Category": "Capsule" }, { "Name": "Surbex T Tablet", "Category": "Tablet" }, { "Name": "Surbex Z Syrup", "Category": "Syrup" }, { "Name": "Surgical Spirit (Rubbing Alcohol)", "Category": "Liquid" }, { "Name": "Syntocinon (Oxytocin) 5 IU Injection", "Category": "Injection" }, { "Name": "Syringe 3cc / 5cc", "Category": "Equipment" }, { "Name": "Tansin 0.4mg Capsule", "Category": "Capsule" }, { "Name": "Tazocin (Piperacillin/Tazobactam) 4.5g IV", "Category": "Injection" }, { "Name": "Tetanus Toxoid (TT) 0.5ml IM", "Category": "Injection" }, { "Name": "Theragram M Tablet", "Category": "Tablet" }, { "Name": "Tramal (Tramadol) 100mg/2ml Injection", "Category": "Injection" }, { "Name": "Tramal (Tramadol) 50mg/ml Injection", "Category": "Injection" }, { "Name": "Trandate (Labetalol) 200mg Tablet", "Category": "Tablet" }, { "Name": "Transamine (Tranexamic Acid) 250mg Injection", "Category": "Injection" }, { "Name": "Transamine (Tranexamic Acid) 500mg Capsule", "Category": "Capsule" }, { "Name": "Transamine 250mg/5ml IV", "Category": "Injection" }, { "Name": "Velosef (Cephradine) 250mg Capsule", "Category": "Capsule" }, { "Name": "Velosef (Cephradine) 500mg Capsule", "Category": "Capsule" }, { "Name": "Ventolin (Salbutamol) Respirator Solution", "Category": "Liquid" }, { "Name": "Voltral (Diclofenac Sodium) 50mg Tablet", "Category": "Tablet" }, { "Name": "Voltral (Diclofenac) 75mg/3ml IM", "Category": "Injection" }, { "Name": "Voltral (Diclofenac) Emulgel", "Category": "Cream" }, { "Name": "Voluven (HES) Infusion 500ml (Drip)", "Category": "Liquid" }, { "Name": "Xplended (Rosuvastatin) 10mg Tablet", "Category": "Tablet" }, { "Name": "Xylometazoline (Otrivin) Nasal Drops", "Category": "Liquid" }, { "Name": "Zantac (Ranitidine) 150mg Tablet", "Category": "Tablet" }, { "Name": "Zithromax (Azithromycin) 250mg Capsule", "Category": "Capsule" }, { "Name": "Zithromax (Azithromycin) 500mg Tablet", "Category": "Tablet" }, { "Name": "Zofran (Ondansetron) 4mg/2ml Injection", "Category": "Injection" }, { "Name": "Zofran (Ondansetron) 8mg/4ml Injection", "Category": "Injection" }, { "Name": "Zyrtec Syrup (5mg/5ml)", "Category": "Syrup" }];
      for (const med of meds) {
        await pool.execute('INSERT IGNORE INTO GenericMedicines (Name, Category) VALUES (?, ?)', [med.Name, med.Category]);
      }
      console.log('✅ Generic Medicines seeded');
    }

    console.log('✅ Database tables initialized');

    // ============ PERFORMANCE INDEXING (100K+ SCALING) ============
    console.log('⚡ Optimizing database with performance indexes...');
    const tablesToIndex = [
      { name: 'Patients', indexes: ['Name', 'Phone', 'MRN', 'CreatedAt'] },
      { name: 'Prescriptions', indexes: ['PatientID', 'CreatedAt', 'Status'] },
      { name: 'LabResults', indexes: ['PatientID', 'CreatedAt', 'Status'] },
      { name: 'LabPatients', indexes: ['Name', 'Phone', 'CreatedAt'] },
      { name: 'LabFeesLedger', indexes: ['LabPatientID', 'PaymentDate'] },
      { name: 'Payments', indexes: ['PatientID', 'CreatedAt'] },
      { name: 'DailyExpenses', indexes: ['Date', 'Category'] },
      { name: 'PatientServices', indexes: ['PatientID', 'CreatedAt'] }
    ];

    for (const table of tablesToIndex) {
      for (const col of table.indexes) {
        try {
          const indexName = `idx_${table.name.toLowerCase()}_${col.toLowerCase()}`;
          // MySQL doesn't have CREATE INDEX IF NOT EXISTS, so we catch the error if it exists
          await pool.execute(`CREATE INDEX ${indexName} ON ${table.name} (${col})`);
          console.log(`🔹 Created index ${indexName} on ${table.name}(${col})`);
        } catch (idxError) {
          // Error 1061 is "Duplicate key name" (index already exists)
          if (idxError.errno !== 1061) {
            console.warn(`⚠️ Could not create index on ${table.name}.${col}:`, idxError.message);
          }
        }
      }
    }
    console.log('✅ Performance indexing complete');

    dbConnected = true;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    dbConnected = false;
    // Keep server running to serve status page
  }
}

// ============ SETTINGS API ============

// Get Settings (Global or User)
app.get('/api/settings/:id', async (req, res) => {
  try {
    const { id } = req.params; // 'GLOBAL' or UserID
    let [rows] = await pool.execute('SELECT Data FROM AppSettings WHERE ID = ?', [id]);

    if (rows.length > 0) {
      res.json(convertRowDates(rows[0]).Data);
    } else {
      // Auto-seed GLOBAL settings if missing
      if (id === 'GLOBAL') {
        const defaultGlobalSettings = {
          clinicName: 'Salamaat Medicare',
          address: 'Qabarastan Road Wah Cantt',
          city: 'Wah Cantt',
          phone: '+91 98765 43210',
          email: 'care@salamaat.com',
          logo: null,
          pdfSettings: {
            primaryColor: '#1a56db',
            secondaryColor: '#64748b',
            footerText: 'Please consult your doctor before taking any medicine. Self-medication can be harmful.',
            showLogo: true,
            showWatermark: true,
          },
          themeColor: '221 83% 53%'
        };

        try {
          await pool.execute(
            "INSERT IGNORE INTO AppSettings (ID, Category, Data) VALUES (?, ?, ?)",
            ['GLOBAL', 'Global', JSON.stringify(defaultGlobalSettings)]
          );
          return res.json(defaultGlobalSettings);
        } catch (seedError) {
          console.error('Failed to auto-seed global settings:', seedError);
        }
      }

      // If user specific settings not found, return empty object (frontend handles defaults)
      if (id !== 'GLOBAL') {
        res.json({});
      } else {
        res.status(404).json({ error: 'Settings not found' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Settings
app.put('/api/settings/:id', async (req, res) => {
  try {
    const { id } = req.params; // 'GLOBAL' or UserID
    let data = req.body;
    const category = id === 'GLOBAL' ? 'Global' : 'User';

    // SANITIZATION: If data has numeric keys (0, 1, 2...), it means it was polluted
    // by a string-spread bug in the frontend. We strip those out.
    if (data && typeof data === 'object') {
      const sanitizedData = {};
      Object.keys(data).forEach(key => {
        // If key is NOT a number, keep it
        if (isNaN(Number(key))) {
          sanitizedData[key] = data[key];
        }
      });
      data = sanitizedData;
    }

    // Upsert logic
    await pool.execute(
      `INSERT INTO AppSettings (ID, Category, Data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE Data = VALUES(Data), Category = VALUES(Category)`,
      [id, category, JSON.stringify(data)]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GENERIC MEDICINES API ============

// Get all generic medicines
app.get('/api/generic-medicines', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM GenericMedicines ORDER BY Name ASC');
    res.json(rows.map(convertRowDates));
  } catch (error) {
    console.error('Error fetching generic medicines:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a single generic medicine
app.post('/api/generic-medicines', async (req, res) => {
  try {
    const { name, category } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO GenericMedicines (Name, Category) VALUES (?, ?)',
      [name, category || 'Other']
    );
    res.json({ id: result.insertId, name, category, success: true });
  } catch (error) {
    console.error('Error adding generic medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add multiple generic medicines (for initial seeding)
app.post('/api/generic-medicines/bulk', async (req, res) => {
  try {
    const { medicines } = req.body;
    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ error: 'Invalid medicines array' });
    }

    let count = 0;
    for (const med of medicines) {
      // Check if exists
      const [existing] = await pool.execute('SELECT ID FROM GenericMedicines WHERE Name = ?', [med.name]);
      if (existing.length === 0) {
        await pool.execute(
          'INSERT INTO GenericMedicines (Name, Category) VALUES (?, ?)',
          [med.name, med.category || 'Other']
        );
        count++;
      }
    }
    res.json({ success: true, count, message: `Successfully seeded ${count} medicines.` });
  } catch (error) {
    console.error('Error bulk adding generic medicines:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete generic medicine
app.delete('/api/generic-medicines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM GenericMedicines WHERE ID = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update generic medicine
app.put('/api/generic-medicines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;
    await pool.execute(
      'UPDATE GenericMedicines SET Name = ?, Category = ? WHERE ID = ?',
      [name, category, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PATIENTS API ============

app.get('/api/patients', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const hasPrescriptionsOnly = req.query.hasPrescriptionsOnly === 'true';
    const hasFinalizedOnly = req.query.hasFinalizedOnly === 'true';
    const fromDate = req.query.fromDate; // Expected format: YYYY-MM-DD
    const toDate = req.query.toDate;     // Expected format: YYYY-MM-DD
    const recent24h = req.query.recent24h === 'true';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    // Helper to calculate exact PKT boundaries in UTC
    const getPktDayBounds = (dateStr) => {
      // Input: '2026-02-26'. Target PKT is +05:00
      const startPkt = new Date(`${dateStr}T00:00:00+05:00`);
      const endPkt = new Date(`${dateStr}T23:59:59.999+05:00`);
      return { startUtc: startPkt.toISOString(), endUtc: endPkt.toISOString() };
    };

    if (search) {
      whereClause = 'WHERE (Name LIKE ? OR ID LIKE ? OR Phone LIKE ? OR MRN LIKE ?)';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam, searchParam];
    }

    // Filter by CreatedToday or Recent24h if requested (and no custom range/search overrides it)
    if (recent24h && !fromDate && !toDate && !search) {
      const condition = "(CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) OR UpdatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY))";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
    } else if (req.query.createdToday === 'true') {
      // "Today" means the current calendar day in PKT time
      // Determine today's date string in PKT (e.g., '2026-02-26')
      const nowInPkt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
      const todayDateStr = nowInPkt.getFullYear() + '-' + String(nowInPkt.getMonth() + 1).padStart(2, '0') + '-' + String(nowInPkt.getDate()).padStart(2, '0');
      const { startUtc, endUtc } = getPktDayBounds(todayDateStr);

      const condition = "(CreatedAt BETWEEN ? AND ? OR UpdatedAt BETWEEN ? AND ?)";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
      params.push(startUtc, endUtc, startUtc, endUtc);
    }

    // Advanced Date Range Filter
    if (fromDate && toDate) {
      const { startUtc, endUtc } = getPktDayBounds(fromDate);
      const { endUtc: endUtc2 } = getPktDayBounds(toDate);
      const condition = "CreatedAt BETWEEN ? AND ?";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
      params.push(startUtc, endUtc2);
    } else if (fromDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      const condition = "CreatedAt >= ?";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
      params.push(startUtc);
    } else if (toDate) {
      const { endUtc } = getPktDayBounds(toDate);
      const condition = "CreatedAt <= ?";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
      params.push(endUtc);
    }

    if (hasPrescriptionsOnly) {
      const condition = 'EXISTS (SELECT 1 FROM Prescriptions p WHERE p.PatientID = Patients.ID)';
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
    }

    if (hasFinalizedOnly) {
      const condition = "EXISTS (SELECT 1 FROM Prescriptions p WHERE p.PatientID = Patients.ID AND p.Status = 'Finalized')";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
    }



    // 1. Get Total Count
    // Use pool.query (not pool.execute) because the WHERE clause is built dynamically;
    // pool.execute caches prepared statements by SQL text and fails when ? count changes.
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM Patients ${whereClause} `,
      params
    );
    const total = countResult[0].total;

    // 2. Get Paginated Data
    // Sort by Last Activity (Latest of CreatedAt or UpdatedAt)
    const [rows] = await pool.query(
      `SELECT * FROM Patients ${whereClause} ORDER BY GREATEST(CreatedAt, COALESCE(UpdatedAt, CreatedAt)) DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/check-duplicate', async (req, res) => {
  try {
    const { name, guardianName } = req.query;

    console.log(`[CheckDuplicate] Request: Name='${name}', Guardian='${guardianName}'`);

    if (name && guardianName) {
      // Case-insensitive check for exact match on both fields, IGNORING WHITESPACE
      // TRIM(LOWER(col)) = TRIM(LOWER(?))
      const query = 'SELECT * FROM Patients WHERE TRIM(LOWER(Name)) = TRIM(LOWER(?)) AND TRIM(LOWER(GuardianName)) = TRIM(LOWER(?))';
      const [rows] = await pool.execute(query, [name, guardianName]);

      console.log(`[CheckDuplicate] Found ${rows.length} matches.`);

      if (rows.length > 0) {
        return res.json({ exists: true, patient: convertRowDates(rows[0]), matchType: 'Name+Guardian' });
      }
    } else {
      // If Name/Guardian not provided, we don't check for duplicates (as per user request)
      // We just return exists: false to allow registration to proceed
      return res.json({ exists: false });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/lookup', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const [rows] = await pool.execute('SELECT * FROM Patients WHERE Phone = ?', [phone]);

    if (rows.length > 0) {
      res.json(convertRowDates(rows[0]));
    } else {
      res.json(null); // Return null if not found, 200 OK
    }
  } catch (error) {
    console.error('Error looking up patient:', error);
    res.status(500).json({ error: error.message });
  }
});



app.get('/api/patients/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Patients WHERE ID = ?', [req.params.id]);
    res.json(rows[0] ? convertRowDates(rows[0]) : null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PATIENT PROFILE API ============
app.get('/api/profile/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params; // Can be MRN or PatientID

    // 1. Resolve Identifier to MRN
    // First check if identifier matches an MRN or CNIC directly
    let [rows] = await pool.execute('SELECT * FROM Patients WHERE MRN = ? OR CNIC = ?', [identifier, identifier]);

    // If no match by MRN, check if it's a PatientID and get that patient's MRN
    if (rows.length === 0) {
      const [idRows] = await pool.execute('SELECT * FROM Patients WHERE ID = ?', [identifier]);
      if (idRows.length > 0) {
        const patient = idRows[0];
        // Use the MRN if present, otherwise fall back to ID (for unlinked records)
        const targetMrn = patient.MRN || patient.ID;
        // Now fetch all records with this MRN
        [rows] = await pool.execute('SELECT * FROM Patients WHERE MRN = ? OR ID = ?', [targetMrn, targetMrn]);
      } else {
        return res.status(404).json({ error: 'Patient not found' });
      }
    }

    // Master Profile is the latest visit (or the first created? Latest visit is usually best for current info)
    // We'll sort by VisitDate (or CreatedAt) DESC
    rows.sort((a, b) => new Date(b.VisitDate || b.CreatedAt).getTime() - new Date(a.VisitDate || a.CreatedAt).getTime());

    const masterProfile = convertRowDates(rows[0]); // Latest record
    const allVisits = rows.map(convertRowDates);
    const allPatientIds = rows.map(r => r.ID);

    if (allPatientIds.length === 0) {
      return res.json({ profile: masterProfile, visits: [], history: { prescriptions: [], labResults: [], payments: [], services: [] } });
    }

    // 2. Fetch History based on Patient IDs
    const placeholders = allPatientIds.map(() => '?').join(',');

    // Helper to fetch valid resources
    const fetchResources = async (table) => {
      try {
        // Use pool.query (not pool.execute): IN(${placeholders}) has a variable ? count
        // pool.execute caches by SQL text and fails when placeholder count changes between calls
        const idCol = table === 'LabResults' ? 'LabPatientID' : 'PatientID';
        const [res] = await pool.query(`SELECT * FROM ${table} WHERE ${idCol} IN(${placeholders}) ORDER BY CreatedAt DESC`, allPatientIds);
        return res; // We'll convert dates later if needed or on frontend
      } catch (e) {
        console.warn(`Failed to fetch ${table} for profile: `, e.message);
        return [];
      }
    };

    const [prescriptions, labResults, services, payments, realVisits] = await Promise.all([
      fetchResources('Prescriptions'),
      fetchResources('LabResults'),
      fetchResources('PatientServices'),
      fetchResources('Payments'),
      pool.query(`SELECT * FROM Visits WHERE PatientID IN(${placeholders}) ORDER BY VisitDate DESC, CreatedAt DESC`, allPatientIds).then(([rows]) => rows).catch(() => [])
    ]);

    res.json({
      profile: masterProfile,
      visits: realVisits.length > 0 ? realVisits.map(convertRowDates) : allVisits, // Use real visits, fallback to patient rows if empty (legacy)
      history: {
        prescriptions,
        labResults,
        services,
        payments
      }
    });

  } catch (error) {
    console.error('Error fetching patient profile:', error);
    res.status(500).json({ error: error.message });
  }
});



app.post('/api/patients', async (req, res) => {
  try {
    const { id, name, guardianName, cnic, age, ageMonths, ageDays, gender, phone, address, visitDate, symptoms, createdBy, createdByRole, mrn } = req.body;

    // Check for duplicates before inserting (Double safety)
    if (cnic) {
      const [dupRows] = await pool.execute('SELECT * FROM Patients WHERE CNIC = ?', [cnic]);
      if (dupRows.length > 0) {
        return res.status(409).json({ error: 'Patient with this CNIC already exists', patient: dupRows[0] });
      }
    }

    const createdAt = new Date().toISOString();
    // If mrn is provided use it, otherwise use id (for new patients without history)
    const patientMrn = mrn || id;

    // Insert into Patients
    await pool.execute(
      'INSERT INTO Patients (ID, MRN, CNIC, Name, GuardianName, Age, AgeMonths, AgeDays, Gender, Phone, Address, VisitDate, Symptoms, CreatedBy, CreatedByRole, CreatedAt, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patientMrn, cnic || null, name, guardianName || null, age, ageMonths || 0, ageDays || 0, gender, phone, address || null, visitDate, symptoms || null, createdBy || null, createdByRole || null, createdAt, createdAt]
    );

    // Insert into Visits
    await pool.execute(
      'INSERT INTO Visits (PatientID, VisitDate, Symptoms, CreatedAt) VALUES (?, ?, ?, ?)',
      [id, visitDate, symptoms || null, createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error adding patient:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/patients/:id', async (req, res) => {
  try {
    const { name, guardianName, cnic, age, ageMonths, ageDays, gender, phone, address, visitDate, symptoms, isRevisit } = req.body;

    // CURRENT DATE IN PKT (UTC+5)
    const now = new Date();
    const pktDate = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    const updatedAt = pktDate.toISOString().replace('T', ' ').slice(0, 19);

    // Update Patient Profile
    await pool.execute(
      'UPDATE Patients SET Name = ?, GuardianName = ?, CNIC = ?, Age = ?, AgeMonths = ?, AgeDays = ?, Gender = ?, Phone = ?, Address = ?, VisitDate = COALESCE(?, VisitDate), Symptoms = ?, UpdatedAt = ? WHERE ID = ?',
      [
        name ?? null,
        guardianName ?? null,
        cnic ?? null,
        age ?? null,
        ageMonths ?? 0,
        ageDays ?? 0,
        gender ?? null,
        phone ?? null,
        address ?? null,
        visitDate ?? null,
        symptoms ?? null,
        updatedAt,
        req.params.id
      ]
    );

    // Insert new Visit ONLY if explicitly requested (e.g. Revisit)
    if (isRevisit === true) {
      await pool.execute(
        'INSERT INTO Visits (PatientID, VisitDate, Symptoms, CreatedAt) VALUES (?, ?, ?, ?)',
        [req.params.id, visitDate ?? null, symptoms ?? null, updatedAt]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/patients/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const patientId = req.params.id;
    console.log(`[DELETE] Starting cascading delete for patient: ${patientId}`);

    // 1. Delete Payments (updates Collection)
    await connection.execute('DELETE FROM Payments WHERE PatientID = ?', [patientId]);

    // 2. Delete Services
    await connection.execute('DELETE FROM PatientServices WHERE PatientID = ?', [patientId]);

    // 3. Delete Prescriptions & Medicines (Cascade on DB might handle medicines, but explicit is safer if not set)
    // First get prescription IDs to delete from junction table if FK cascade isn't reliable
    // But we defined FK ON DELETE CASCADE for PrescriptionMedicines, so deleting Prescriptions is enough
    await connection.execute('DELETE FROM Prescriptions WHERE PatientID = ?', [patientId]);

    // 4. Delete Visits
    await connection.execute('DELETE FROM Visits WHERE PatientID = ?', [patientId]);

    // 6. Delete Patient
    const [result] = await connection.execute('DELETE FROM Patients WHERE ID = ?', [patientId]);

    await connection.commit();
    console.log(`[DELETE] Successfully deleted patient ${patientId} and all related records.`);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ success: true, message: 'Patient and all related records deleted' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[DELETE] Error in cascading delete:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ============ LAB PATIENTS API ============

app.get('/api/lab-patients', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const gender = req.query.gender || '';
    const recent24h = req.query.recent24h === 'true';
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    const getPktDayBounds = (dateStr) => {
      const startPkt = new Date(`${dateStr}T00:00:00+05:00`);
      const endPkt = new Date(`${dateStr}T23:59:59.999+05:00`);
      return { startUtc: startPkt.toISOString(), endUtc: endPkt.toISOString() };
    };

    if (search) {
      whereClause = 'WHERE (Name LIKE ? OR ID LIKE ? OR Phone LIKE ?)';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam];
    }

    if (gender && gender !== 'all') {
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'Gender = ?';
      params.push(gender);
    }

    if (recent24h && !fromDate && !toDate) {
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)';
    } else if (fromDate && toDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      const { endUtc } = getPktDayBounds(toDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt BETWEEN ? AND ?';
      params.push(startUtc, endUtc);
    } else if (fromDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt >= ?';
      params.push(startUtc);
    } else if (toDate) {
      const { endUtc } = getPktDayBounds(toDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt <= ?';
      params.push(endUtc);
    }

    // Use pool.query (not pool.execute): dynamic whereClause means the SQL text changes per request
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM LabPatients ${whereClause}`, params);
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT * FROM LabPatients ${whereClause} ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lab-patients/lookup', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json(null);

    // Search by exact ID or exact Phone
    const [rows] = await pool.execute(
      'SELECT * FROM LabPatients WHERE ID = ? OR Phone = ? LIMIT 1',
      [query, query]
    );

    res.json(rows.length > 0 ? convertRowDates(rows[0]) : null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lab-patients/:id/profile', async (req, res) => {
  try {
    const patientId = req.params.id;

    // 1. Fetch Patient Profile
    const [profiles] = await pool.query('SELECT * FROM LabPatients WHERE ID = ?', [patientId]);
    if (profiles.length === 0) return res.status(404).json({ error: 'Lab Patient not found' });
    const profile = profiles[0];

    // 2. Fetch Visits
    const [visits] = await pool.query('SELECT * FROM LabVisits WHERE LabPatientID = ? ORDER BY CreatedAt DESC', [patientId]);

    // 3. Fetch Lab Results
    let labResults = [];
    try {
      const [lr] = await pool.query(
        'SELECT * FROM LabResults WHERE LabPatientID = ? ORDER BY CreatedAt DESC',
        [patientId]
      );
      labResults = lr;
    } catch (e) {
      console.log('Error fetching LabResults for lab patient profile:', e.message);
    }

    // 4. Fetch Payments Ledger
    const [payments] = await pool.query('SELECT * FROM LabFeesLedger WHERE LabPatientID = ? ORDER BY PaymentDate DESC', [patientId]);

    res.json({
      profile: convertRowDates(profile),
      visits: visits.map(convertRowDates),
      history: {
        prescriptions: [],
        services: [],
        labResults: labResults.map(convertRowDates),
        payments: payments.map(convertRowDates)
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lab-patients', async (req, res) => {
  try {
    const {
      id, name, guardianName, age, ageMonths, ageDays, gender, phone, address, cnic,
      referringDoctorName, priority, selectedTests
    } = req.body;
    const createdAt = new Date().toISOString();

    const query = `
      INSERT INTO LabPatients (
        ID, Name, GuardianName, Age, AgeMonths, AgeDays, Gender, Phone, Address, CNIC,
        ReferringDoctorName, Priority, SelectedTests, CreatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.execute(query, [
      id, name, guardianName || null, age || 0, ageMonths || 0, ageDays || 0, gender, phone, address || null, cnic || null,
      referringDoctorName || null, priority || 'Normal', selectedTests ? JSON.stringify(selectedTests) : null, createdAt
    ]);

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating lab patient:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/lab-patients/:id', async (req, res) => {
  try {
    const {
      name, guardianName, age, ageMonths, ageDays, gender, phone, address, cnic,
      referringDoctorName, priority, selectedTests
    } = req.body;

    const query = `
      UPDATE LabPatients SET
        Name=?, GuardianName=?, Age=?, AgeMonths=?, AgeDays=?, Gender=?, Phone=?, Address=?, CNIC=?,
        ReferringDoctorName=?, Priority=?, SelectedTests=?
      WHERE ID=?
    `;

    await pool.execute(query, [
      name, guardianName, age, ageMonths, ageDays, gender, phone, address, cnic,
      referringDoctorName || null, priority || 'Normal',
      selectedTests ? JSON.stringify(selectedTests) : null,
      req.params.id
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating lab patient:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lab-patients/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM LabPatients WHERE ID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ============ LAB PATIENT HISTORY API ============

app.get('/api/lab-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const recent24h = req.query.recent24h === 'true';
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    const getPktDayBounds = (dateStr) => {
      const startPkt = new Date(`${dateStr}T00:00:00+05:00`);
      const endPkt = new Date(`${dateStr}T23:59:59.999+05:00`);
      return { startUtc: startPkt.toISOString(), endUtc: endPkt.toISOString() };
    };

    if (search) {
      whereClause = 'WHERE (PatientName LIKE ? OR LabPatientID LIKE ?)';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam];
    }

    if (recent24h && !fromDate && !toDate) {
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)';
    } else if (fromDate && toDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      const { endUtc } = getPktDayBounds(toDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt BETWEEN ? AND ?';
      params.push(startUtc, endUtc);
    } else if (fromDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt >= ?';
      params.push(startUtc);
    } else if (toDate) {
      const { endUtc } = getPktDayBounds(toDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt <= ?';
      params.push(endUtc);
    }

    // Use pool.query (not pool.execute): dynamic whereClause means the SQL text changes per request,
    // causing mysql2's prepared statement cache to mismatch (Incorrect arguments to mysqld_stmt_execute)
    const [countResult] = await pool.query(`SELECT COUNT(*) as total, SUM(PaidAmount) as totalCollection, SUM(DiscountAmount) as totalDiscount FROM labpaymenthistory ${whereClause}`, params);
    const total = countResult[0].total;
    const totalCollection = countResult[0].totalCollection || 0;
    const totalDiscount = countResult[0].totalDiscount || 0;

    const [rows] = await pool.query(`
      SELECT * FROM labpaymenthistory 
      ${whereClause} 
      ORDER BY CreatedAt DESC 
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `, params);

    res.json({
      data: rows.map(convertRowDates),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), totalCollection, totalDiscount }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/lab-history', async (req, res) => {
  try {
    const {
      LabPatientID, PatientName, TotalAmount, DiscountAmount, PaidAmount,
      PaymentStatus, Tests
    } = req.body;

    const labPatientID = LabPatientID || req.body.labPatientId || req.body.LabPatientId;
    const patientName = PatientName || req.body.patientName;
    const totalAmount = TotalAmount !== undefined ? TotalAmount : (req.body.totalAmount || 0);
    const discountAmount = DiscountAmount !== undefined ? DiscountAmount : (req.body.discountAmount || 0);
    const paidAmount = PaidAmount !== undefined ? PaidAmount : (req.body.paidAmount || 0);
    const paymentStatus = PaymentStatus || req.body.paymentStatus;
    const tests = Tests || req.body.tests || req.body.testsWithResults || [];

    const id = `LPH-${Date.now()}`;
    const createdAt = new Date().toISOString();

    await pool.execute(
      `INSERT INTO labpaymenthistory (
        ID, LabPatientID, PatientName, TotalAmount, DiscountAmount, PaidAmount,
        PaymentStatus, Tests, CreatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, labPatientID, patientName, totalAmount, discountAmount, paidAmount,
        paymentStatus || 'Pending', JSON.stringify(tests), createdAt
      ]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating lab history:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/lab-history/:id', async (req, res) => {
  try {
    const updates = req.body;
    const id = req.params.id;

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true });
    }

    let setClause = [];
    let values = [];

    const validColumns = [
      'LabPatientID', 'PatientName', 'TotalAmount', 'DiscountAmount',
      'PaidAmount', 'PaymentStatus', 'Tests', 'FinalizedAt'
    ];

    Object.keys(updates).forEach(key => {
      let colName = validColumns.find(c => c.toLowerCase() === key.toLowerCase() || c === key || c.charAt(0).toLowerCase() + c.slice(1) === key);

      // Handle legacy mapping for tests
      if (!colName && (key.toLowerCase() === 'testswithresults' || key === 'tests')) colName = 'Tests';

      if (colName) {
        setClause.push(`${colName} = ?`);
        let val = updates[key];
        if (colName === 'Tests' && typeof val !== 'string') {
          val = JSON.stringify(val);
        }
        values.push(val);
      }
    });

    if (setClause.length > 0) {
      values.push(id);
      values.push(id); // For the OR LabPatientID = ?
      // Use pool.query: dynamic SET clause means SQL text changes per request
      await pool.query(`UPDATE labpaymenthistory SET ${setClause.join(', ')} WHERE ID = ? OR LabPatientID = ?`, values);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating lab history:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ LAB RESULT HISTORY API (Separate Clinical History) ============

app.post('/api/lab-result-history', async (req, res) => {
  try {
    const {
      ID, LabPatientID, LabReportID, PatientName, FinalizedAt, TestsWithResults, Technician, ResultStatus
    } = req.body;

    const createdAt = new Date().toISOString();

    await pool.execute(
      `INSERT INTO labresulthistory (
        ID, LabPatientID, LabReportID, PatientName, FinalizedAt, TestsWithResults, Technician, ResultStatus, CreatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ID || `LRH-${Date.now()}`,
        LabPatientID,
        LabReportID,
        PatientName,
        FinalizedAt || createdAt,
        typeof TestsWithResults === 'string' ? TestsWithResults : JSON.stringify(TestsWithResults),
        Technician,
        ResultStatus || 'Finalized',
        createdAt
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating lab result history:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lab-result-history/:labPatientId', async (req, res) => {
  try {
    const { labPatientId } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM labresulthistory WHERE LabPatientID = ? ORDER BY CreatedAt DESC',
      [labPatientId]
    );
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lab-result-history-patients', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT 
        h.LabPatientID as ID, 
        h.PatientName as Name,
        p.Phone, p.Gender
      FROM labresulthistory h
      LEFT JOIN LabPatients p ON h.LabPatientID = p.ID
      ORDER BY h.PatientName ASC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STOCK API ============

app.get('/api/stock', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Stock ORDER BY Name');
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stock', async (req, res) => {
  try {
    const { id, name, category, quantity, price, lowStockThreshold } = req.body;
    const createdAt = new Date().toISOString();

    await pool.execute(
      'INSERT INTO Stock (ID, Name, Category, Quantity, Price, LowStockThreshold, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, category, quantity, price, lowStockThreshold, createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stock/:id', async (req, res) => {
  try {
    const { name, category, quantity, price, lowStockThreshold } = req.body;

    await pool.execute(
      'UPDATE Stock SET Name = ?, Category = ?, Quantity = ?, Price = ?, LowStockThreshold = ? WHERE ID = ?',
      [name, category, quantity, price, lowStockThreshold, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stock/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM Stock WHERE ID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PAYMENTS API ============

app.get('/api/payments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Filters
    const recent24h = req.query.recent24h === 'true';
    const fromDate = req.query.fromDate; // Expected format: YYYY-MM-DD
    const toDate = req.query.toDate;     // Expected format: YYYY-MM-DD

    let whereClause = '';
    let params = [];

    // Helper to calculate exact PKT boundaries in UTC
    const getPktDayBounds = (dateStr) => {
      // Input: '2026-02-26'. Target PKT is +05:00
      const startPkt = new Date(`${dateStr}T00:00:00+05:00`);
      const endPkt = new Date(`${dateStr}T23:59:59.999+05:00`);
      return { startUtc: startPkt.toISOString(), endUtc: endPkt.toISOString() };
    };

    if (recent24h && !fromDate && !toDate) {
      // 24 hours rolling
      whereClause = 'WHERE p.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)';
    } else if (fromDate && toDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      const { endUtc } = getPktDayBounds(toDate);
      whereClause = "WHERE p.CreatedAt BETWEEN ? AND ?";
      params.push(startUtc, endUtc);
    } else if (fromDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      whereClause = "WHERE p.CreatedAt >= ?";
      params.push(startUtc);
    } else if (toDate) {
      const { endUtc } = getPktDayBounds(toDate);
      whereClause = "WHERE p.CreatedAt <= ?";
      params.push(endUtc);
    }

    // 1. Get total count and sum of collections
    // We clone the params object because the second execute() will otherwise re-use and expect the same params
    const summaryParams = [...params];
    // Use pool.query (not pool.execute): dynamic whereClause means the SQL text changes per request,
    // causing mysql2's prepared statement cache to mismatch (Incorrect arguments to mysqld_stmt_execute)
    const [summaryResult] = await pool.query(`SELECT COUNT(*) as total, SUM(TotalAmount) as totalCollection, SUM(LabFee) as totalLabFee, SUM(ConsultationFee) as totalConsultationFee FROM Payments p ${whereClause}`, summaryParams);
    const total = summaryResult[0].total;
    const totalCollection = summaryResult[0].totalCollection || 0;
    const totalLabFee = summaryResult[0].totalLabFee || 0;
    const totalConsultationFee = summaryResult[0].totalConsultationFee || 0;

    // 2. Get paginated data
    const [rows] = await pool.query(
      `SELECT p.*, 
              pat.Age as PatientAge, 
              pat.AgeMonths as PatientAgeMonths, 
              pat.AgeDays as PatientAgeDays, 
              pat.Gender as PatientGender, 
              pat.Phone as PatientPhone,
              pat.GuardianName as PatientGuardianName
       FROM Payments p
       LEFT JOIN Patients pat ON p.PatientID = pat.ID
       ${whereClause} 
       ORDER BY p.CreatedAt DESC 
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const data = rows.map(row => {
      // Parse Items and Medicines BEFORE spreading to preserve them
      const items = row.Items ? JSON.parse(row.Items) : [];
      const medicines = row.Medicines ? JSON.parse(row.Medicines) : [];

      return {
        ...convertRowDates(row),
        items,
        medicines
      };
    });

    res.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalCollection,
        totalLabFee,
        totalConsultationFee
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const { id, patientId, patientName, consultationFee, labFee, medicineFee, totalAmount, paymentMode, medicines, items, labPatientId } = req.body;
    const createdAt = new Date().toISOString();

    await pool.execute(
      'INSERT INTO Payments (ID, PatientID, PatientName, ConsultationFee, LabFee, MedicineFee, TotalAmount, PaymentMode, Medicines, Items, CreatedAt, LabPatientID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patientId, patientName, consultationFee || 0, labFee || 0, medicineFee || 0, totalAmount || 0, paymentMode, JSON.stringify(medicines || []), JSON.stringify(items || []), createdAt, labPatientId || null]
    );

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/payments/:id', async (req, res) => {
  try {
    console.log('📝 Updating payment:', req.params.id);
    console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

    const { consultationFee, labFee, medicineFee, totalAmount, paymentMode, items, medicines } = req.body;

    await pool.execute(
      'UPDATE Payments SET ConsultationFee=?, LabFee=?, MedicineFee=?, TotalAmount=?, PaymentMode=?, Items=?, Medicines=? WHERE ID=?',
      [
        consultationFee,
        labFee,
        medicineFee,
        totalAmount,
        paymentMode,
        JSON.stringify(items || []),
        JSON.stringify(medicines || []),
        req.params.id
      ]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRESCRIPTIONS API ============

async function createLabResultsFromPrescription(patientId, patientName, patientAge, patientAgeMonths, patientAgeDays, labTests) {
  if (!labTests || labTests.length === 0) return;

  const id = `LAB-${Math.floor(Math.random() * 900000) + 100000}`;
  const testDate = new Date().toISOString().split('T')[0];
  const createdAt = new Date().toISOString();

  // Create tests structure for LabResults table
  const testsJson = labTests.map(testName => ({
    name: testName,
    result: '',
    unit: '',
    range: '',
    status: 'Pending'
  }));

  await pool.execute(
    'INSERT INTO LabResults (ID, PatientID, PatientName, PatientAge, PatientAgeMonths, PatientAgeDays, TestDate, Tests, Status, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, patientId, patientName, patientAge || null, patientAgeMonths || 0, patientAgeDays || 0, testDate, JSON.stringify(testsJson), 'Pending', createdAt]
  );
  console.log('🧪 Auto-generated Lab Order:', id, 'for patient:', patientName);
}

app.get('/api/prescriptions', async (req, res) => {
  try {
    const { patientId, status, recent24h } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];
    const conditions = [];

    if (patientId) {
      conditions.push('PatientID = ?');
      params.push(patientId);
    }

    if (status) {
      conditions.push('Status = ?');
      params.push(status);
    }

    if (recent24h === 'true') {
      // Use direct JS subtraction to feed a clean UTC timestamp to MySQL
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      conditions.push('CreatedAt >= ?');
      params.push(yesterday);
    }

    if (conditions.length > 0) {
      whereClause = ' WHERE ' + conditions.join(' AND ');
    }

    // 1. Get total count
    // Use pool.query (not pool.execute) because the WHERE clause is built dynamically;
    // pool.execute caches prepared statements by SQL text and fails when ? count changes.
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM Prescriptions ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 2. Get paginated data
    const [prescriptions] = await pool.query(
      `SELECT * FROM Prescriptions ${whereClause} ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    // MySQL2 auto-parses JSON columns into JS objects when using pool.execute.
    // Guard against double-parsing: only call JSON.parse if the value is still a string.
    const prescriptionsWithMedicines = prescriptions.map((prescription) => {
      const medicines = Array.isArray(prescription.Medicines)
        ? prescription.Medicines
        : (typeof prescription.Medicines === 'string' ? JSON.parse(prescription.Medicines || '[]') : []);
      const labTests = Array.isArray(prescription.LabTests)
        ? prescription.LabTests
        : (typeof prescription.LabTests === 'string' ? JSON.parse(prescription.LabTests || '[]') : []);

      return {
        ...convertRowDates(prescription),
        Medicines: medicines,
        LabTests: labTests
      };
    });

    res.json({
      data: prescriptionsWithMedicines,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prescriptions', async (req, res) => {
  try {
    const { id, patientId, patientName, patientAge, patientAgeMonths, patientAgeDays, diagnosis, ctgUsgReport, complaints, history, onExamination, treatmentInHospital, treatmentAtHome, medicines, labTests, doctorNotes, precautions, generatedText, followUpDate, status } = req.body;
    const createdAt = new Date().toISOString();

    // Status Logic
    const isFinalized = status === 'Finalized';
    const isLocked = isFinalized ? 1 : 0;
    const finalizedAt = isFinalized ? createdAt : null;

    console.log('Creating prescription:', { id, patientId, status: status || 'Draft' });

    // Insert prescription with medicines as JSON
    await pool.execute(
      'INSERT INTO Prescriptions (ID, PatientID, PatientName, PatientAge, PatientAgeMonths, PatientAgeDays, Diagnosis, CtgUsgReport, Complaints, History, OnExamination, TreatmentInHospital, TreatmentAtHome, Medicines, LabTests, DoctorNotes, Precautions, GeneratedText, FollowUpDate, Status, CreatedAt, IsLocked, FinalizedAt, LastUpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patientId, patientName, patientAge || null, patientAgeMonths || 0, patientAgeDays || 0, diagnosis, ctgUsgReport || null, complaints || null, history || null, onExamination || null, treatmentInHospital || null, treatmentAtHome || null, JSON.stringify(medicines || []), JSON.stringify(labTests || []), doctorNotes || null, precautions || null, generatedText || null, followUpDate || null, status || 'Draft', createdAt, isLocked, finalizedAt, createdAt]
    );

    // Only deduce stock if finalized
    // Note: Stock handling logic is currently separated (handled by frontend or separate call), 
    // but typically should be here. For non-breaking changes we keep as is, but frontend must only call stock reduction if finalized.

    console.log('✅ Prescription created successfully:', id);

    // Auto-generation removed as per manual assignment requirement
    // if (isFinalized && labTests && labTests.length > 0) {
    //   await createLabResultsFromPrescription(patientId, patientName, patientAge, labTests);
    // }

    res.json({ success: true, id });
  } catch (error) {
    console.error('❌ Error creating prescription:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/prescriptions/:id', async (req, res) => {
  try {
    const { patientId, patientName, patientAge, patientAgeMonths, patientAgeDays, diagnosis, ctgUsgReport, complaints, history, onExamination, treatmentInHospital, treatmentAtHome, medicines, labTests, doctorNotes, precautions, generatedText, followUpDate, status } = req.body;
    const prescriptionId = req.params.id;

    console.log('Updating prescription:', prescriptionId, 'status:', status);

    // 1. Check if Locked
    const [existing] = await pool.execute('SELECT IsLocked, Status FROM Prescriptions WHERE ID = ?', [prescriptionId]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    if (existing[0].IsLocked || existing[0].Status === 'Finalized') {
      return res.status(403).json({ error: 'Prescription is finalized and cannot be modified.' });
    }

    // 2. Determine new state
    const isFinalized = status === 'Finalized';
    const isLocked = isFinalized ? 1 : 0;
    const finalizedAt = isFinalized ? new Date().toISOString() : null;
    const lastUpdatedAt = new Date().toISOString();

    // 3. Update prescription with medicines as JSON
    let query = 'UPDATE Prescriptions SET PatientID=?, PatientName=?, PatientAge=?, PatientAgeMonths=?, PatientAgeDays=?, Diagnosis=?, CtgUsgReport=?, Complaints=?, History=?, OnExamination=?, TreatmentInHospital=?, TreatmentAtHome=?, Medicines=?, LabTests=?, DoctorNotes=?, Precautions=?, GeneratedText=?, FollowUpDate=?, Status=?, LastUpdatedAt=?';
    const params = [patientId, patientName, patientAge, patientAgeMonths || 0, patientAgeDays || 0, diagnosis, ctgUsgReport || null, complaints || null, history || null, onExamination || null, treatmentInHospital || null, treatmentAtHome || null, JSON.stringify(medicines || []), JSON.stringify(labTests), doctorNotes, precautions, generatedText, followUpDate, status, lastUpdatedAt];

    if (isFinalized) {
      query += ', IsLocked=?, FinalizedAt=?';
      params.push(isLocked, finalizedAt);
    }

    query += ' WHERE ID=?';
    params.push(prescriptionId);

    // Use pool.query: query string is dynamically built (conditionally appends IsLocked/FinalizedAt)
    await pool.query(query, params);

    // Auto-generation removed as per manual assignment requirement
    // const wasAlreadyFinalized = existing[0].Status === 'Finalized';
    // if (isFinalized && !wasAlreadyFinalized && labTests && labTests.length > 0) {
    //   await createLabResultsFromPrescription(patientId, patientName, patientAge, labTests);
    // }

    console.log('✅ Prescription updated successfully:', prescriptionId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating prescription:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/prescriptions/:id', async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    console.log('Attempting to delete prescription:', prescriptionId);

    // 1. Check if Locked
    const [existing] = await pool.execute('SELECT IsLocked, Status FROM Prescriptions WHERE ID = ?', [prescriptionId]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    if (existing[0].IsLocked || existing[0].Status === 'Finalized') {
      console.warn(`⚠️ Blocked deletion of finalized prescription: ${prescriptionId}`);
      return res.status(403).json({ error: 'Prescription is finalized and cannot be deleted.' });
    }

    // 2. Delete prescription
    await pool.execute('DELETE FROM Prescriptions WHERE ID = ?', [prescriptionId]);

    console.log('✅ Prescription deleted successfully:', prescriptionId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting prescription:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ STOCK API (Medicine Inventory) ============

app.get('/api/stock', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM stock');
    const total = countResult[0].total;

    // Use pool.query (not pool.execute): LIMIT/OFFSET causes mysql2 prepared statement cache to mismatch
    const [rows] = await pool.query(
      'SELECT * FROM stock ORDER BY Name ASC LIMIT ? OFFSET ?',
      [Number(limit), Number(offset)]
    );

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stock', async (req, res) => {
  try {
    const { id, name, category, quantity, price, lowStockThreshold } = req.body;
    const createdAt = new Date().toISOString();

    await pool.execute(
      'INSERT INTO stock (ID, Name, Category, Quantity, Price, LowStockThreshold, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, category, quantity, price, lowStockThreshold || 10, createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stock/:id', async (req, res) => {
  try {
    const { name, category, quantity, price, lowStockThreshold } = req.body;

    await pool.execute(
      'UPDATE stock SET Name=?, Category=?, Quantity=?, Price=?, LowStockThreshold=? WHERE ID=?',
      [name, category, quantity, price, lowStockThreshold, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stock/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM stock WHERE ID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CLINICAL MEDICINES API (Master List) ============

app.get('/api/clinical-medicines', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Fetch only master medicines (where PrescriptionID is NULL)
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM PrescriptionMedicines WHERE PrescriptionID IS NULL');
    const total = countResult[0].total;

    // Use pool.query (not pool.execute): LIMIT/OFFSET causes mysql2 prepared statement cache to mismatch
    const [rows] = await pool.query(
      'SELECT * FROM PrescriptionMedicines WHERE PrescriptionID IS NULL ORDER BY MedicineName ASC LIMIT ? OFFSET ?',
      [Number(limit), Number(offset)]
    );

    res.json({
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clinical-medicines', async (req, res) => {
  try {
    const { name, category, dosage, frequency, duration } = req.body;

    // Insert new master medicine (PrescriptionID is NULL)
    await pool.execute(
      'INSERT INTO PrescriptionMedicines (PrescriptionID, MedicineName, Category, Dosage, Frequency, Duration) VALUES (NULL, ?, ?, ?, ?, ?)',
      [name, category || 'Tablet', dosage, frequency, duration]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clinical-medicines/:id', async (req, res) => {
  try {
    const { name, category, dosage, frequency, duration } = req.body;

    await pool.execute(
      'UPDATE PrescriptionMedicines SET MedicineName=?, Category=?, Dosage=?, Frequency=?, Duration=? WHERE ID=? AND PrescriptionID IS NULL',
      [name, category, dosage, frequency, duration, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clinical-medicines/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM PrescriptionMedicines WHERE ID=? AND PrescriptionID IS NULL', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LAB RESULTS API ============

app.get('/api/lab-results', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { labPatientId, status, fromDate, toDate } = req.query;

    let whereClause = '';
    let params = [];

    const getPktDayBounds = (dateStr) => {
      const startPkt = new Date(`${dateStr}T00:00:00+05:00`);
      const endPkt = new Date(`${dateStr}T23:59:59.999+05:00`);
      return { startUtc: startPkt.toISOString(), endUtc: endPkt.toISOString() };
    };

    if (labPatientId) {
      whereClause = 'WHERE LabPatientID = ?';
      params.push(labPatientId);
    }

    if (fromDate && toDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      const { endUtc } = getPktDayBounds(toDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt BETWEEN ? AND ?';
      params.push(startUtc, endUtc);
    } else if (fromDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt >= ?';
      params.push(startUtc);
    } else if (toDate) {
      const { endUtc } = getPktDayBounds(toDate);
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt <= ?';
      params.push(endUtc);
    }

    // 1. Get total count
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM LabResults ${whereClause}`, params);
    const total = countResult[0].total;

    // 2. Get paginated data
    const [rows] = await pool.query(
      `SELECT * FROM LabResults ${whereClause} ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lab-results', async (req, res) => {
  try {
    console.log('📝 Creating Lab Result. Body:', JSON.stringify(req.body, null, 2));
    const { id, labPatientId, patientName, patientAge, testDate, reportDate, tests, notes, technician, status, referredBy, patientId } = req.body;
    const createdAt = new Date().toISOString();

    // Use labPatientId if present, otherwise fallback to patientId (which is what clinic calls it)
    const finalPatientId = labPatientId || patientId || null;

    await pool.execute(
      'INSERT INTO LabResults (ID, LabPatientID, PatientName, PatientAge, TestDate, ReportDate, Tests, Notes, Technician, Status, ReferredBy, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, finalPatientId, patientName, patientAge || null, testDate, reportDate || null, JSON.stringify(tests), notes || null, technician || null, status || 'Pending', referredBy || 'Self', createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/lab-results/:id/status', async (req, res) => {
  try {
    const { status, notifiedAt, collectedAt } = req.body;

    let query = 'UPDATE LabResults SET Status = ?';
    const params = [status];

    if (notifiedAt) {
      query += ', NotifiedAt = ?';
      params.push(notifiedAt);
    }
    if (collectedAt) {
      query += ', CollectedAt = ?';
      params.push(collectedAt);
    }

    query += ' WHERE ID = ?';
    params.push(req.params.id);

    // Use pool.query: query string is dynamically built (conditionally appends NotifiedAt/CollectedAt)
    await pool.query(query, params);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Full update for lab results
app.put('/api/lab-results/:id', async (req, res) => {
  try {
    const { testDate, reportDate, tests, notes, technician, status, labPatientId } = req.body;

    await pool.execute(
      'UPDATE LabResults SET TestDate = ?, ReportDate = ?, Tests = ?, Notes = ?, Technician = ?, Status = ?, LabPatientID = ? WHERE ID = ?',
      [testDate, reportDate || null, JSON.stringify(tests), notes || null, technician || null, status, labPatientId || null, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LAB TESTS CATALOG API (Master List) ============

app.get('/api/lab-tests-catalog', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM LabTestsCatalog');
    const total = countResult[0].total;

    // Use pool.query (not pool.execute): LIMIT/OFFSET causes mysql2 prepared statement cache to mismatch
    const [rows] = await pool.query(
      'SELECT * FROM LabTestsCatalog ORDER BY Category ASC, Name ASC LIMIT ? OFFSET ?',
      [Number(limit), Number(offset)]
    );

    res.json({
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lab-tests-catalog', async (req, res) => {
  try {
    const {
      id, name, category, unit, normalRange, price,
      referenceRangeMale, referenceRangeFemale, referenceRangeChild,
      criticalValueRange, sampleType, method, turnaroundTime,
      status, isProfile, profileTests, machine
    } = req.body;

    await pool.execute(
      `INSERT INTO LabTestsCatalog (
        ID, Name, Category, Unit, NormalRange, Price,
        ReferenceRangeMale, ReferenceRangeFemale, ReferenceRangeChild,
        CriticalValueRange, SampleType, Method, TurnaroundTime,
        Status, IsProfile, ProfileTests, Machine
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, name, category, unit, normalRange, price || 0,
        referenceRangeMale || null, referenceRangeFemale || null, referenceRangeChild || null,
        criticalValueRange || null, sampleType || null, method || null, turnaroundTime || null,
        status || 'Active', isProfile ? 1 : 0, profileTests ? JSON.stringify(profileTests) : null,
        machine || null
      ]
    );
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/lab-tests-catalog/:id', async (req, res) => {
  try {
    const {
      name, category, unit, normalRange, price,
      referenceRangeMale, referenceRangeFemale, referenceRangeChild,
      criticalValueRange, sampleType, method, turnaroundTime,
      status, isProfile, profileTests, machine
    } = req.body;

    await pool.execute(
      `UPDATE LabTestsCatalog SET 
        Name = ?, Category = ?, Unit = ?, NormalRange = ?, Price = ?,
        ReferenceRangeMale = ?, ReferenceRangeFemale = ?, ReferenceRangeChild = ?,
        CriticalValueRange = ?, SampleType = ?, Method = ?, TurnaroundTime = ?,
        Status = ?, IsProfile = ?, ProfileTests = ?, Machine = ?
       WHERE ID = ?`,
      [
        name, category, unit, normalRange, price || 0,
        referenceRangeMale || null, referenceRangeFemale || null, referenceRangeChild || null,
        criticalValueRange || null, sampleType || null, method || null, turnaroundTime || null,
        status || 'Active', isProfile ? 1 : 0, profileTests ? JSON.stringify(profileTests) : null,
        machine || null,
        req.params.id
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lab-tests-catalog/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM LabTestsCatalog WHERE ID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient-services', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM PatientServices');
    const total = countResult[0].total;

    // Use pool.query (not pool.execute): LIMIT/OFFSET causes mysql2 prepared statement cache to mismatch
    const [rows] = await pool.query(
      'SELECT * FROM PatientServices ORDER BY CreatedAt DESC LIMIT ? OFFSET ?',
      [Number(limit), Number(offset)]
    );

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient-services/:patientId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const patientId = req.params.patientId;

    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM PatientServices WHERE PatientID = ?', [patientId]);
    const total = countResult[0].total;

    // Use pool.query (not pool.execute): LIMIT/OFFSET causes mysql2 prepared statement cache to mismatch
    const [rows] = await pool.query(
      'SELECT * FROM PatientServices WHERE PatientID = ? ORDER BY CreatedAt DESC LIMIT ? OFFSET ?',
      [patientId, Number(limit), Number(offset)]
    );

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient-services', async (req, res) => {
  try {
    const { id, patientId, services, grandTotal, status, isRevisit } = req.body;
    const now = new Date().toISOString();

    // 1. Insert Service Record
    await pool.execute(
      'INSERT INTO PatientServices (ID, PatientID, Services, GrandTotal, Status, CreatedAt, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, patientId, JSON.stringify(services), grandTotal, status || 'Draft', now, now]
    );

    // 2. Touch Patient UpdatedAt ONLY if it is a Revisit (explicit user action)
    // 2. Touch Patient UpdatedAt and VisitDate ONLY if it is a Revisit (explicit user action)
    if (isRevisit === true) {
      console.log(`[Revisit] Updating patient ${patientId} timestamp and creating visit record.`);

      // Get current date in PKT format YYYY-MM-DD using UTC_TIMESTAMP to avoid double offset
      const [pktDateResult] = await pool.execute("SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:00')) as pktDate");
      const pktVisitDate = pktDateResult[0].pktDate;

      // Update Patient record
      await pool.execute(
        'UPDATE Patients SET UpdatedAt = ?, VisitDate = ? WHERE ID = ?',
        [now, pktVisitDate, patientId]
      );

      // Create new Visit record
      await pool.execute(
        'INSERT INTO Visits (PatientID, VisitDate, Symptoms, CreatedAt) VALUES (?, ?, ?, ?)',
        [patientId, pktVisitDate, 'Revisit - New Service', now]
      );
    }

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/patient-services/:id', async (req, res) => {
  try {
    const { services, grandTotal, status } = req.body;

    await pool.execute(
      'UPDATE PatientServices SET Services = ?, GrandTotal = ?, Status = ?, UpdatedAt = ? WHERE ID = ?',
      [JSON.stringify(services), grandTotal, status, new Date().toISOString(), req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LAB VISITS API ============

app.post('/api/lab-visits', async (req, res) => {
  try {
    const { id, labPatientId, visitDate, selectedTests, status = 'Pending', totalAmount = 0 } = req.body;
    await pool.query(
      'INSERT INTO LabVisits (ID, LabPatientID, VisitDate, Status, SelectedTests, TotalAmount, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, labPatientId, visitDate, status, JSON.stringify(selectedTests || []), totalAmount, new Date().toISOString()]
    );
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lab-visits', async (req, res) => {
  try {
    const { labPatientId, search, recent24h, fromDate, toDate } = req.query;

    let whereConditions = [];
    let queryParams = [];

    if (labPatientId) {
      whereConditions.push('v.LabPatientID = ?');
      queryParams.push(labPatientId);
    }

    if (search) {
      const searchTerm = `%${search}%`;
      whereConditions.push('(v.ID LIKE ? OR p.Name LIKE ? OR v.LabPatientID LIKE ? OR p.Phone LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    } else {
      // Date filters only apply if not searching (matches Patients API behavior)
      if (recent24h === 'true') {
        whereConditions.push('v.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)');
      } else {
        if (fromDate) {
          whereConditions.push('DATE(v.VisitDate) >= ?');
          queryParams.push(fromDate);
        }
        if (toDate) {
          whereConditions.push('DATE(v.VisitDate) <= ?');
          queryParams.push(toDate);
        }
      }
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Legacy behavior for fetching patient specific visits without pagination limits
    if (labPatientId && !req.query.page && !req.query.limit && !search && !recent24h && !fromDate && !toDate) {
      const [rows] = await pool.query(
        `SELECT v.*, p.Name as PatientName, p.Age, p.Gender, p.Phone FROM LabVisits v JOIN LabPatients p ON v.LabPatientID = p.ID ${whereClause} ORDER BY v.CreatedAt DESC`,
        queryParams
      );
      return res.json(rows.map(convertRowDates));
    }

    // Pagination for all visits
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // 1. Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM LabVisits v 
      JOIN LabPatients p ON v.LabPatientID = p.ID
      ${whereClause}
    `;
    const [countResult] = await pool.query(countQuery, queryParams);
    const total = countResult[0].total;

    // 2. Fetch paginated data
    const dataQuery = `
      SELECT v.*, p.Name as PatientName, p.Age, p.Gender, p.Phone 
      FROM LabVisits v 
      JOIN LabPatients p ON v.LabPatientID = p.ID
      ${whereClause}
      ORDER BY v.CreatedAt DESC LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(dataQuery, [...queryParams, limit, offset]);

    // 3. Calculate summary stats (totalCollection, totalDiscount) using the SAME whereClause
    const statsQuery = `
      SELECT 
        SUM(v.PaidAmount) as totalCollection, 
        SUM(v.DiscountAmount) as totalDiscount,
        COUNT(v.ID) as totalVisits
      FROM LabVisits v 
      JOIN LabPatients p ON v.LabPatientID = p.ID
      ${whereClause}
    `;
    const [statsResult] = await pool.query(statsQuery, queryParams);
    const totalCollection = statsResult[0].totalCollection || 0;
    const totalDiscount = statsResult[0].totalDiscount || 0;
    const totalVisits = statsResult[0].totalVisits || 0;

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalCollection,
        totalDiscount,
        totalTests: totalVisits
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/lab-visits/:id', async (req, res) => {
  try {
    const { status, selectedTests, totalAmount, discountAmount, paidAmount, balanceAmount, paymentStatus } = req.body;
    // Build dynamic update query
    let updateFields = [];
    let queryParams = [];

    if (status !== undefined) {
      updateFields.push('Status = ?');
      queryParams.push(status);
    }
    if (selectedTests !== undefined) {
      updateFields.push('SelectedTests = ?');
      queryParams.push(JSON.stringify(selectedTests));
    }
    if (totalAmount !== undefined) {
      updateFields.push('TotalAmount = ?');
      queryParams.push(totalAmount);
    }
    if (discountAmount !== undefined) {
      updateFields.push('DiscountAmount = ?');
      queryParams.push(discountAmount);
    }
    if (paidAmount !== undefined) {
      updateFields.push('PaidAmount = ?');
      queryParams.push(paidAmount);
    }
    if (balanceAmount !== undefined) {
      updateFields.push('BalanceAmount = ?');
      queryParams.push(balanceAmount);
    }
    if (paymentStatus !== undefined) {
      updateFields.push('PaymentStatus = ?');
      queryParams.push(paymentStatus);
    }

    if (updateFields.length > 0) {
      queryParams.push(req.params.id);
      await pool.query(
        `UPDATE LabVisits SET ${updateFields.join(', ')} WHERE ID = ?`,
        queryParams
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record a new payment for a lab visit
app.post('/api/lab-visits/:id/payment', async (req, res) => {
  try {
    const { labPatientId, amountPaid, paymentMethod, notes, discountAmount } = req.body;
    const visitId = req.params.id;

    // 1. Fetch current visit
    const [visits] = await pool.query('SELECT * FROM LabVisits WHERE ID = ?', [visitId]);
    if (visits.length === 0) return res.status(404).json({ error: 'Visit not found' });
    const visit = visits[0];

    // 2. Calculate new totals
    const newDiscount = Number(visit.DiscountAmount) + Number(discountAmount || 0);
    const newPaid = Number(visit.PaidAmount) + Number(amountPaid || 0);
    const newBalance = Number(visit.TotalAmount) - newDiscount - newPaid;
    const paymentStatus = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Unpaid');

    // 3. Update the Visit record
    await pool.query(
      'UPDATE LabVisits SET DiscountAmount = ?, PaidAmount = ?, PaymentStatus = ? WHERE ID = ?',
      [newDiscount, newPaid, paymentStatus, visitId]
    );

    // 4. Create ledger entry if some money actually changed hands
    if (Number(amountPaid) > 0) {
      const paymentId = `LPMT-${Date.now().toString(36).toUpperCase()}`;
      await pool.query(
        'INSERT INTO LabFeesLedger (ID, LabPatientID, VisitID, AmountPaid, PaymentMethod, Notes, PaymentDate) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [paymentId, labPatientId, visitId, amountPaid, paymentMethod || 'Cash', notes || '', new Date().toISOString()]
      );
    }

    res.json({ success: true, paymentStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment ledger for a lab patient
app.get('/api/lab-visits/:patientId/payments', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT h.*, v.TotalAmount, v.DiscountAmount, v.PaidAmount AS VisitPaidAmount ' +
      'FROM LabFeesLedger h ' +
      'JOIN LabVisits v ON h.VisitID = v.ID ' +
      'WHERE h.LabPatientID = ? ORDER BY h.PaymentDate DESC',
      [req.params.patientId]
    );
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lab-visits/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM LabVisits WHERE ID = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Lab Visit not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ============ ROLES API ============

// All available permission keys in the system
// Page-based + button-level permissions
const ALL_PERMISSIONS = [
  // ── Pages ──
  { key: 'page_dashboard', label: 'Dashboard', group: 'Pages' },
  { key: 'page_patients', label: 'Patients', group: 'Pages' },
  { key: 'page_fees', label: 'Fee Collection', group: 'Pages' },
  { key: 'page_medicines', label: 'Medicines', group: 'Pages' },
  { key: 'page_pharmacy', label: 'Pharmacy', group: 'Pages' },
  { key: 'page_prescriptions', label: 'Prescriptions', group: 'Pages' },
  { key: 'page_lab_results', label: 'Lab Results', group: 'Pages' },
  { key: 'page_lab_management', label: 'Lab Management', group: 'Pages' },
  { key: 'page_users', label: 'User Management', group: 'Pages' },
  { key: 'page_expenses', label: 'Daily Expenses', group: 'Pages' },
  { key: 'page_settings', label: 'Settings', group: 'Pages' },
  // ── Button actions ──
  { key: 'btn_add_patient', label: 'Add Patient', group: 'Actions' },
  { key: 'btn_edit_patient', label: 'Edit Patient', group: 'Actions' },
  { key: 'btn_delete_patient', label: 'Delete Patient', group: 'Actions' },
  { key: 'btn_manage_stock', label: 'Manage Stock', group: 'Actions' },
  { key: 'btn_add_lab_test', label: 'Add Lab Test', group: 'Actions' },
  { key: 'btn_edit_lab_test', label: 'Edit Lab Test', group: 'Actions' },
  { key: 'btn_delete_lab_test', label: 'Delete Lab Test', group: 'Actions' },
];

// GET /api/permissions - list all available permission keys
app.get('/api/permissions', (req, res) => {
  res.json(ALL_PERMISSIONS);
});

// GET /api/roles - list all roles with their permissions
app.get('/api/roles', async (req, res) => {
  try {
    const [roles] = await pool.execute('SELECT * FROM Roles ORDER BY IsSystem DESC, Name ASC');
    const [rolePerms] = await pool.execute('SELECT RoleName, Permission FROM RolePermissions');

    const rolesWithPerms = roles.map(role => ({
      id: role.ID,
      name: role.Name,
      description: role.Description,
      isSystem: role.IsSystem === 1,
      createdAt: role.CreatedAt,
      permissions: rolePerms.filter(rp => rp.RoleName === role.Name).map(rp => rp.Permission),
    }));

    res.json(rolesWithPerms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/roles - create a new role
app.post('/api/roles', async (req, res) => {
  try {
    const { name, description, permissions = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name is required' });

    await pool.execute(
      'INSERT INTO Roles (Name, Description, IsSystem) VALUES (?, ?, 0)',
      [name, description || '']
    );

    // Insert permissions for this role
    for (const perm of permissions) {
      await pool.execute(
        'INSERT IGNORE INTO RolePermissions (RoleName, Permission) VALUES (?, ?)',
        [name, perm]
      );
    }

    res.json({ success: true, message: `Role '${name}' created` });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A role with this name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/roles/:name - update role name/description
app.put('/api/roles/:name', async (req, res) => {
  try {
    const { name: oldName } = req.params;
    const { name: newName, description } = req.body;

    // Check if it's a system role (cannot rename)
    const [existing] = await pool.execute('SELECT * FROM Roles WHERE Name = ?', [oldName]);
    if (!existing[0]) return res.status(404).json({ error: 'Role not found' });
    if (existing[0].IsSystem && newName && newName !== oldName) {
      return res.status(403).json({ error: 'System roles cannot be renamed' });
    }

    await pool.execute(
      'UPDATE Roles SET Name = ?, Description = ? WHERE Name = ?',
      [newName || oldName, description ?? existing[0].Description, oldName]
    );

    // If name changed, update RolePermissions references
    if (newName && newName !== oldName) {
      await pool.execute('UPDATE RolePermissions SET RoleName = ? WHERE RoleName = ?', [newName, oldName]);
      await pool.execute('UPDATE Users SET Role = ? WHERE Role = ?', [newName, oldName]);
    }

    res.json({ success: true, message: 'Role updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/roles/:name/permissions - update default permissions for a role
app.put('/api/roles/:name/permissions', async (req, res) => {
  try {
    const { name } = req.params;
    const { permissions = [] } = req.body;

    // Delete existing permissions for this role
    await pool.execute('DELETE FROM RolePermissions WHERE RoleName = ?', [name]);

    // Insert new permissions
    for (const perm of permissions) {
      await pool.execute(
        'INSERT IGNORE INTO RolePermissions (RoleName, Permission) VALUES (?, ?)',
        [name, perm]
      );
    }

    res.json({ success: true, message: 'Permissions updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/roles/:name - delete a role (blocked if users are assigned)
app.delete('/api/roles/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // Block deletion of system roles
    const [existing] = await pool.execute('SELECT * FROM Roles WHERE Name = ?', [name]);
    if (!existing[0]) return res.status(404).json({ error: 'Role not found' });
    if (existing[0].IsSystem) return res.status(403).json({ error: 'System roles cannot be deleted' });

    // Block if users are assigned to this role
    const [assignedUsers] = await pool.execute('SELECT COUNT(*) as count FROM Users WHERE Role = ?', [name]);
    if (assignedUsers[0].count > 0) {
      return res.status(409).json({ error: `Cannot delete role: ${assignedUsers[0].count} user(s) are assigned to it` });
    }

    await pool.execute('DELETE FROM RolePermissions WHERE RoleName = ?', [name]);
    await pool.execute('DELETE FROM Roles WHERE Name = ?', [name]);

    res.json({ success: true, message: `Role '${name}' deleted` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ USERS API ============

// Get all users (excluding passwords)
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT ID, Username, Name, Email, Phone, Role, Permissions, IsActive, CreatedBy, CreatedAt, UpdatedAt, LastLogin FROM Users ORDER BY CreatedAt DESC'
    );
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT ID, Username, Name, Email, Phone, Role, Permissions, IsActive, CreatedBy, CreatedAt, UpdatedAt, LastLogin FROM Users WHERE ID = ?',
      [req.params.id]
    );
    res.json(rows[0] ? convertRowDates(rows[0]) : null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  try {
    const { id, username, password, name, email, phone, role, permissions, createdBy } = req.body;
    const createdAt = new Date().toISOString();
    const permissionsJson = typeof permissions === 'string' ? permissions : JSON.stringify(permissions || []);

    await pool.execute(
      'INSERT INTO Users (ID, Username, Password, Name, Email, Phone, Role, Permissions, IsActive, CreatedBy, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, username, password, name, email || null, phone || null, role || 'Receptionist', permissionsJson, 1, createdBy || null, createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { username, name, email, phone, role, isActive } = req.body;

    await pool.execute(
      'UPDATE Users SET Username = ?, Name = ?, Email = ?, Phone = ?, Role = ?, IsActive = ? WHERE ID = ?',
      [username, name, email || null, phone || null, role, isActive !== undefined ? isActive : 1, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user permissions
app.put('/api/users/:id/permissions', async (req, res) => {
  try {
    const { permissions } = req.body;
    const permissionsJson = typeof permissions === 'string' ? permissions : JSON.stringify(permissions || []);

    await pool.execute(
      'UPDATE Users SET Permissions = ? WHERE ID = ?',
      [permissionsJson, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user password
app.put('/api/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;

    await pool.execute(
      'UPDATE Users SET Password = ? WHERE ID = ?',
      [password, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Soft delete user (set IsActive to 0)
app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE Users SET IsActive = 0 WHERE ID = ?',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint
app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.execute(
      'SELECT ID, Username, Name, Email, Phone, Role, Permissions FROM Users WHERE Username = ? AND Password = ? AND IsActive = 1',
      [username, password]
    );

    if (rows.length > 0) {
      const user = rows[0];

      // Update last login timestamp
      await pool.execute(
        'UPDATE Users SET LastLogin = ? WHERE ID = ?',
        [new Date().toISOString(), user.ID]
      );

      // Load user's own permissions first; fall back to role defaults if empty
      let userPerms = [];
      try {
        const raw = user.Permissions;
        userPerms = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      } catch { userPerms = []; }

      if (!userPerms || userPerms.length === 0) {
        // Fall back to role-level permissions
        const [rolePerms] = await pool.execute(
          'SELECT Permission FROM RolePermissions WHERE RoleName = ?',
          [user.Role]
        );
        userPerms = rolePerms.map(rp => rp.Permission);
      }

      const permissions = JSON.stringify(userPerms);
      res.json({ success: true, user: { ...convertRowDates(user), Permissions: permissions } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DAILY EXPENSES API ============

// Get all expenses
app.get('/api/daily-expenses', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const month = req.query.month; // e.g. YYYY-MM

    let whereClause = '';
    let params = [];

    if (month && month.trim() !== '') {
      whereClause = 'WHERE Date LIKE ?';
      params.push(`${month}%`);
    }

    // 1. Get total count and monthly sum
    const [countResult] = await pool.query(`SELECT COUNT(*) as total, SUM(Amount) as monthlyTotal FROM DailyExpenses ${whereClause}`, params);
    const total = countResult[0].total || 0;
    const monthlyTotal = parseFloat(countResult[0].monthlyTotal) || 0;


    // 2. Get paginated data
    // Use pool.query (not pool.execute): dynamic whereClause means the SQL text changes per request
    let query = `SELECT * FROM DailyExpenses ${whereClause} ORDER BY Date DESC, CreatedAt DESC`;
    let queryParams = [...params];

    if (limit !== -1) {
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(Number(limit), Number(offset));
    }

    const [rows] = await pool.query(query, queryParams);

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        monthlyTotal
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new expense
app.post('/api/daily-expenses', async (req, res) => {
  try {
    const { id, date, description, category, amount, paymentMethod, createdBy } = req.body;
    const createdAt = new Date().toISOString();

    await pool.execute(
      'INSERT INTO DailyExpenses (ID, Date, Description, Category, Amount, PaymentMethod, CreatedBy, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, date, description, category, amount, paymentMethod, createdBy || 'System', createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete expense
app.delete('/api/daily-expenses/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM DailyExpenses WHERE ID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'MySQL', timestamp: new Date().toISOString() });
});

// Status Page - accessible at /api/status AND /
const getStatusPage = (req, res) => {
  const statusColor = dbConnected ? '#dcfce7' : '#fee2e2';
  const statusTextColor = dbConnected ? '#166534' : '#991b1b';
  const statusText = dbConnected ? 'Connected' : 'Disconnected';

  const html = `
    < !DOCTYPE html >
    <html>
      <head>
        <title>HMS Backend Status</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {font - family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
            .card {background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); width: 90%; max-width: 400px; }
            h1 {margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #0f172a; text-align: center; }
            .subtitle {text - align: center; color: #64748b; margin-bottom: 2rem; font-size: 0.9rem; }
            .status-container {display: flex; flex-direction: column; gap: 1rem; }
            .status-item {display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; }
            .badge {padding: 0.35rem 0.75rem; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; }
            .footer {margin - top: 2rem; text-align: center; font-size: 0.8rem; color: #94a3b8; }
          </style>
      </head>
      <body>
        <div class="card">
          <h1>🏥 HMS Backend</h1>
          <p class="subtitle">Hospital Management System API</p>

          <div style="background: #fffbeb; border: 1px solid #fef3c7; color: #92400e; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.875rem; text-align: center; font-weight: 600; line-height: 1.5;">
            🚧 Deployment is in progress.<br>
              Please refresh this page in a few minutes.
          </div>

          <div class="status-container">
            <div class="status-item">
              <span>Server Status</span>
              <span class="badge" style="background: #dcfce7; color: #166534">Online</span>
            </div>
            <div class="status-item">
              <span>Database</span>
              <span class="badge" style="background: ${statusColor}; color: ${statusTextColor}">
                ${statusText}
              </span>
            </div>
          </div>

          <div class="footer">
            Deployed on Hostinger<br>
              Time: ${new Date().toISOString()}
          </div>
        </div>
      </body>
    </html>
`;
  res.send(html);
};

app.get('/api/status', getStatusPage);
// app.get('/', getStatusPage);

// Favicon Handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ============ SERVE REACT FRONTEND ============
// This hybrid logic ensures the frontend works regardless of whether backend is 
// in the same folder as the build, or in a sibling nodejs/public_html structure.
const possiblePaths = [
  path.join(__dirname, '..', 'public_html', 'dist'),          // Sibling public_html (Previous structure)
  path.join(__dirname, 'dist'),                              // Local dist folder (Flash/NodeJS folder)
  path.join(__dirname, '..', 'public_html'),                 // Sibling public_html root
  path.join(__dirname, 'build'),                             // Local build folder
  __dirname                                                  // Flat in current folder
];

let publicHtmlDistPath = path.join(__dirname, '..', 'public_html', 'dist'); // Default fallback
let publicHtmlIndexPath = path.join(publicHtmlDistPath, 'index.html');

for (const p of possiblePaths) {
  const indexPath = path.join(p, 'index.html');
  if (fs.existsSync(indexPath)) {
    publicHtmlDistPath = p;
    publicHtmlIndexPath = indexPath;
    console.log('📂 Frontend Dist Path found at:', p);
    break;
  }
}

// 1. Serve Static Assets (JS, CSS, Images, Fonts) with long-term caching
// Since Vite uses content hashing, it's safe to cache these indefinitely.
app.use('/assets', express.static(path.join(publicHtmlDistPath, 'assets'), {
  immutable: true,
  maxAge: '1y',
  etag: true
}));

// 2. Serve other static files (robots.txt, etc.)
app.use(express.static(publicHtmlDistPath, {
  index: false, // We handle index.html manually below
  etag: true
}));

// 2. SPA Fallback / Status Page
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  if (fs.existsSync(publicHtmlIndexPath)) {
    // ALWAYS set index.html to no-cache so the browser checks for updates
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(publicHtmlIndexPath);
  } else {
    // If missing, show the "Deployment in Progress" status page
    getStatusPage(req, res);
  }
});


// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Initialize database (catch any promise rejections)
initializeDatabase().catch(err => {
  console.error('🔥 Database initialization failed:', err.message);
  dbConnected = false;
});

// Start server immediately
try {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏥 Hospital Management Backend running on http://0.0.0.0:${PORT}`);
    console.log(`📁 Database: MySQL - ${process.env.DB_NAME}`);
    console.log(`🔗 Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please stop the existing process or use a different port.`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
    }
  });
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}