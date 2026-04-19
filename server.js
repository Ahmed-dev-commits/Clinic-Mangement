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
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');

const JWT_SECRET = process.env.JWT_SECRET || 'salamaat_extreme_secret_key_99';
const apiCache = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // Cache for 60s by default

// Helper to flush all patient-related cache keys
function flushPatientCache() {
  const keys = apiCache.keys();
  const patientKeys = keys.filter(k => k.includes('/api/patients') || k.includes('/api/profile'));
  if (patientKeys.length > 0) {
    console.log(`[CACHE] Flushing ${patientKeys.length} patient-related keys:`);
    patientKeys.forEach(k => console.log(`  - 🗑️ ${k}`));
    apiCache.del(patientKeys);
  }
}

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

// 1. Strict No-Cache for API responses on the browser (We control caching Server-Side)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Connection', 'keep-alive'); // Explicitly help proxy maintain connection
  next();
});

// 1.5 JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  try {
    // When mounted at '/api', Express strips that prefix — req.path is RELATIVE
    // e.g. POST /api/users/login becomes req.path === '/users/login'
    const openPaths = ['/users/login', '/health', '/status'];
    // Also allow settings (needed for login page branding before auth)
    if (openPaths.includes(req.path) || req.path.startsWith('/settings/')) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access Denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
      }
      req.user = user;
      next();
    });
  } catch (criticalErr) {
    console.error('🔥 Critical Auth Middleware Error:', criticalErr);
    res.status(500).json({ error: 'Internal Security Error' });
  }
};

// Apply JWT Guard to all API routes
app.use('/api', authenticateToken);

// 1.8 Universal High-Concurrency Database Cache Middleware
const cacheMiddleware = (req, res, next) => {
  // If the user presses the 'Refresh' button on the UI frontend, it sends a ?refresh flag.
  // We bust the cache for all patient-related queries to ensure a fresh start.
  if (req.query.refresh === 'true' || req.query.refresh === '1') {
    if (req.originalUrl.includes('/api/patients') || req.originalUrl.includes('/api/profile')) {
      flushPatientCache();
    } else {
      apiCache.del(req.originalUrl);
    }
  } else {
    const cachedData = apiCache.get(req.originalUrl);
    if (cachedData) {
      return res.json(cachedData);
    }
  }

  // Intercept the final JSON response to populate the cache
  const originalJson = res.json;
  res.json = function (body) {
    // Only cache successful OK responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      apiCache.set(req.originalUrl, body);
    }
    originalJson.call(this, body);
  };
  next();
};

// 2. Intelligent caching for Static Files (applied later)

// MySQL connection pool
let pool;
let dbConnected = false;

async function createPool() {
  const dbConfig = {
    connectTimeout: 30000, // 30s to establish connection
    waitForConnections: true,
    connectionLimit: process.env.DB_CONNECTION_LIMIT || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000, // 10s delay
    timezone: 'Z',
    dateStrings: [
      'DATE',
      'VARCHAR(50)'
    ],
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: true
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

  // --- POOL EVENT LOGGING & RESILIENCE ---
  pool.on('connection', (connection) => {
    console.log('📡 New database connection established');
  });

  pool.on('error', (err) => {
    console.error('🔥 MySQL Pool Error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      console.log('🔄 Attempting to re-establish connection pool...');
      dbConnected = false;
      // The pool usually handles this, but we log it for visibility
    }
  });

  // --- HEARTBEAT MONITOR ---
  setInterval(async () => {
    if (pool) {
      try {
        const [rows] = await pool.query('SELECT 1');
        if (!dbConnected) {
          console.log('✅ Database connection recovered');
          dbConnected = true;
        }
      } catch (err) {
        console.error('⚠️ Database Heartbeat Failed:', err.message);
        dbConnected = false;
      }
    }
  }, 30000); // Check every 30 seconds
}

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

function convertRowDates(row) {
  if (!row) return row;

  const converted = { ...row };

  // --- CHAT SPECIFIC MAPPING ---
  // Map PascalCase database columns to camelCase for the frontend
  if (converted.Content !== undefined) converted.content = converted.Content;
  if (converted.SenderID !== undefined) converted.senderId = converted.SenderID;
  if (converted.ConversationID !== undefined) converted.conversationId = converted.ConversationID;
  if (converted.CreatedAt !== undefined) converted.createdAt = converted.CreatedAt;

  // Helper to safely convert any value to ISO string
  const toIso = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    if (s === '0000-00-00 00:00:00' || s === '0000-00-00' || s === '') return null;

    const hasTimezone = s.includes('Z') || s.includes('+') || (s.includes('T') && s.length > 20);
    if (!hasTimezone) {
      const datePart = s.split('.')[0].replace(' ', 'T');
      const candidate = datePart.includes('T') ? `${datePart}+05:00` : `${datePart}T00:00:00+05:00`;
      const d = new Date(candidate);
      return isNaN(d.getTime()) ? null : candidate;
    }

    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const dateFields = [
    'CreatedAt', 'UpdatedAt', 'VisitDate', 'TestDate', 'ReportDate', 
    'FollowUpDate', 'ApprovalTime', 'FinalizedAt', 'LastUpdatedAt', 'CollectedAt'
  ];

  dateFields.forEach(field => {
    if (converted[field]) {
      // Apply ISO conversion
      const isoDate = toIso(converted[field]);
      converted[field] = isoDate;
      // Also provide camelCase version for the frontend
      const camelField = field.charAt(0).toLowerCase() + field.slice(1);
      converted[camelField] = isoDate;
    }
  });

  ['Data', 'Medicines', 'LabTests', 'Tests', 'Services', 'Items', 'SelectedTests', 'FormData'].forEach(field => {
    if (converted[field] && typeof converted[field] === 'string') {
      try {
        const trimmed = converted[field].trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          converted[field] = JSON.parse(converted[field]);
        }
      } catch (e) {}
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

    // ============ UNIVERSAL TIME MIGRATION SUITE ============
    // This converts all legacy DATETIME columns to VARCHAR(50) to prevent timezone stripping.
    const migrateToText = async (table, column) => {
      try {
        await pool.execute(`ALTER TABLE ${table} MODIFY COLUMN ${column} VARCHAR(50)`);
        console.log(`✅ Migrated ${table}.${column} to VARCHAR(50)`);
      } catch (e) {
        // Column might not exist or already be VARCHAR
      }
    };

    console.log('⏳ Running Universal Time Migration...');
    await migrateToText('Patients', 'CreatedAt');
    await migrateToText('Patients', 'UpdatedAt');
    await migrateToText('Visits', 'CreatedAt');
    await migrateToText('Stock', 'CreatedAt');
    await migrateToText('Payments', 'CreatedAt');
    await migrateToText('Prescriptions', 'CreatedAt');
    await migrateToText('Prescriptions', 'FinalizedAt');
    await migrateToText('Prescriptions', 'LastUpdatedAt');
    await migrateToText('LabTestsCatalog', 'CreatedAt');
    await migrateToText('AdvancePayments', 'ApprovalTime');
    await migrateToText('LabResults', 'CreatedAt');
    await migrateToText('LabResults', 'NotifiedAt');
    await migrateToText('LabResults', 'CollectedAt');
    await migrateToText('LabPatients', 'CreatedAt');
    await migrateToText('labpaymenthistory', 'CreatedAt');
    await migrateToText('labpaymenthistory', 'FinalizedAt');
    await migrateToText('Users', 'CreatedAt');
    await migrateToText('Users', 'UpdatedAt');
    await migrateToText('Users', 'LastLogin');
    await migrateToText('Roles', 'CreatedAt');
    await migrateToText('Employees', 'CreatedAt');
    await migrateToText('LeaveRequests', 'CreatedAt');
    await migrateToText('Appointments', 'CreatedAt');
    await migrateToText('PatientServices', 'CreatedAt');
    await migrateToText('PatientServices', 'UpdatedAt');
    await migrateToText('AppSettings', 'UpdatedAt');
    console.log('✅ Universal Time Migration Complete.');

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
        CreatedAt VARCHAR(50)
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
        CreatedAt VARCHAR(50)
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
        CreatedAt VARCHAR(50)
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
        CreatedAt VARCHAR(50)
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
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN FinalizedAt VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Prescriptions ADD COLUMN LastUpdatedAt VARCHAR(50) NULL"); } catch (e) { }
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
        CreatedAt VARCHAR(50),
        FOREIGN KEY (PatientID) REFERENCES Patients(ID) ON DELETE CASCADE
      )
    `);

    // ClinicalForms table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ClinicalForms (
        ID VARCHAR(50) PRIMARY KEY,
        PatientID VARCHAR(50),
        PatientName VARCHAR(255),
        FormType VARCHAR(50),
        FormData JSON,
        CreatedBy VARCHAR(100),
        CreatedAt VARCHAR(50),
        UpdatedAt VARCHAR(50),
        IsDeleted TINYINT(1) DEFAULT 0
      )
    `);
    try { await pool.execute("ALTER TABLE ClinicalForms ADD COLUMN IsDeleted TINYINT(1) DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE ClinicalForms MODIFY COLUMN FormData JSON"); } catch (e) { }

    // --- CHAT MODULE TABLES ---
    
    // 1. Conversations
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ChatConversations (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Type ENUM('Direct', 'Group') DEFAULT 'Direct',
        Name VARCHAR(255) NULL,
        CreatedAt VARCHAR(50),
        UpdatedAt VARCHAR(50)
      )
    `);

    // 2. Participants
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ChatParticipants (
        ConversationID INT,
        UserID VARCHAR(50),
        JoinedAt VARCHAR(50),
        PRIMARY KEY (ConversationID, UserID),
        FOREIGN KEY (ConversationID) REFERENCES ChatConversations(ID) ON DELETE CASCADE
      )
    `);

    // 3. Messages
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ChatMessages (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        ConversationID INT,
        SenderID VARCHAR(50),
        Content TEXT,
        MessageType ENUM('Text', 'Image', 'System') DEFAULT 'Text',
        IsRead TINYINT(1) DEFAULT 0,
        CreatedAt VARCHAR(50),
        FOREIGN KEY (ConversationID) REFERENCES ChatConversations(ID) ON DELETE CASCADE
      )
    `);

    // Performance Index for Chat History
    try { 
      await pool.execute("CREATE INDEX idx_chat_history ON ChatMessages (ConversationID, CreatedAt DESC)"); 
    } catch (e) { }

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
        CreatedAt VARCHAR(50)
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


    // Attempt to add Approval tracking columns to AdvancePayments (Migration)
    try { await pool.execute("ALTER TABLE AdvancePayments ADD COLUMN ApprovedBy VARCHAR(100) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE AdvancePayments ADD COLUMN ApprovalTime VARCHAR(50) NULL"); } catch (e) { }

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
        NotifiedAt VARCHAR(50) NULL,
        CollectedAt VARCHAR(50) NULL,
        CreatedAt VARCHAR(50)
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
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN NotifiedAt VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN CollectedAt VARCHAR(50) NULL"); } catch (e) { }
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
        CreatedAt VARCHAR(50)
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
        CreatedAt VARCHAR(50),
        FinalizedAt VARCHAR(50) NULL
      )
    `);

    // Migrations for LabPatients
    try { await pool.execute("ALTER TABLE LabPatients ADD COLUMN SelectedTests JSON NULL"); } catch (e) { }

    // LabResults Priority migration
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN Priority VARCHAR(50) DEFAULT 'Normal'"); } catch (e) { }

    // HR Upgrade Migrations
    try { await pool.execute("ALTER TABLE Employees ADD COLUMN StandardDailyHours INT DEFAULT 8"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Employees ADD COLUMN ShiftStartTime TIME DEFAULT '09:00:00'"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Employees ADD COLUMN ShiftEndTime TIME DEFAULT '17:00:00'"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN OvertimeHours DECIMAL(5, 2) DEFAULT 0.00"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN OvertimeAmount DECIMAL(10, 2) DEFAULT 0.00"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN GrossSalary DECIMAL(10, 2) DEFAULT 0.00"); } catch (e) { }

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
        CreatedAt VARCHAR(50),
        UpdatedAt VARCHAR(50),
        LastLogin VARCHAR(50)
      )
    `);

    // Roles table - dynamic roles managed by admin
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Roles (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Name VARCHAR(100) UNIQUE NOT NULL,
        Description TEXT,
        IsSystem TINYINT(1) DEFAULT 0,
        CreatedAt VARCHAR(50)
      )
    `);

    // Employees table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Employees (
          ID VARCHAR(50) PRIMARY KEY,
          UserID VARCHAR(50) NULL,
          Name VARCHAR(255) NOT NULL,
          Designation VARCHAR(100),
          Phone VARCHAR(20),
          JoiningDate DATE,
          BasicSalary DECIMAL(10, 2) DEFAULT 0,
          StandardDailyHours INT DEFAULT 8,
          ShiftStartTime TIME DEFAULT '09:00:00',
          ShiftEndTime TIME DEFAULT '17:00:00',
          Status VARCHAR(20) DEFAULT 'Active',
          CreatedAt VARCHAR(50),
          FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE SET NULL
      )
    `);

    // LeaveRequests table (now safe as Employees exists)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS LeaveRequests (
          ID VARCHAR(50) PRIMARY KEY,
          EmployeeID VARCHAR(50) NOT NULL,
          StartDate DATE NOT NULL,
          EndDate DATE NOT NULL,
          Reason TEXT,
          Status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
          ApprovedBy VARCHAR(50),
          CreatedAt VARCHAR(50),
          FOREIGN KEY (EmployeeID) REFERENCES Employees(ID) ON DELETE CASCADE
      )
    `);

    // Appointments table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Appointments (
          ID VARCHAR(50) PRIMARY KEY,
          PatientID VARCHAR(50) NULL,
          PatientName VARCHAR(255) NOT NULL,
          Phone VARCHAR(20) NOT NULL,
          ApptDate DATE NOT NULL,
          ApptTime TIME NOT NULL,
          Service VARCHAR(100) DEFAULT 'Consultation',
          Status VARCHAR(50) DEFAULT 'Pending',
          Notes TEXT NULL,
          TokenNumber INT NOT NULL DEFAULT 1,
          CreatedBy VARCHAR(100) NULL,
          CreatedAt VARCHAR(50)
      )
    `);
    // Index for fast daily lookups
    try { await pool.execute('CREATE INDEX idx_appt_date ON Appointments (ApptDate)'); } catch (e) { }
    // Migration: ensure page_appointments permission exists for existing roles
    try {
      await pool.execute("INSERT IGNORE INTO RolePermissions (RoleName, Permission) VALUES ('Admin', 'page_appointments')");
      await pool.execute("INSERT IGNORE INTO RolePermissions (RoleName, Permission) VALUES ('Receptionist', 'page_appointments')");
      await pool.execute("INSERT IGNORE INTO RolePermissions (RoleName, Permission) VALUES ('Doctor', 'page_appointments')");
    } catch (e) { }

    // Backfill Visits from Patients table
    try {
      await pool.execute(`
        INSERT INTO Visits (PatientID, VisitDate, Symptoms, CreatedAt)
        SELECT ID, VisitDate, Symptoms, CreatedAt FROM Patients
        WHERE ID NOT IN (SELECT DISTINCT PatientID FROM Visits)
      `);
    } catch (e) {
      console.warn('⚠️ Could not backfill visits:', e.message);
    }

    // PatientServices table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS PatientServices(
  ID VARCHAR(50) PRIMARY KEY,
  PatientID VARCHAR(50) NOT NULL,
  Services TEXT,
  GrandTotal DECIMAL(10, 2) DEFAULT 0,
  Status VARCHAR(50) DEFAULT 'Draft',
  CreatedAt VARCHAR(50),
  UpdatedAt VARCHAR(50)
)
  `);

    // Attendance
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Attendance (
          ID INT AUTO_INCREMENT PRIMARY KEY,
          EmployeeID VARCHAR(50) NOT NULL,
          Date DATE NOT NULL,
          Status ENUM('Present', 'Absent', 'Leave', 'Late') DEFAULT 'Present',
          CheckIn TIME,
          CheckOut TIME,
          Notes TEXT,
          UNIQUE KEY emp_date (EmployeeID, Date)
      )
    `);

    // AdvancePayments
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS AdvancePayments (
          ID VARCHAR(50) PRIMARY KEY,
          EmployeeID VARCHAR(50) NOT NULL,
          Date DATE NOT NULL,
          Amount DECIMAL(10, 2) NOT NULL,
          Description TEXT,
          Status ENUM('Pending', 'Deducted', 'Cancelled') DEFAULT 'Pending'
      )
    `);

    // Payroll
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS Payroll (
          ID VARCHAR(50) PRIMARY KEY,
          EmployeeID VARCHAR(50) NOT NULL,
          Month INT NOT NULL,
          Year INT NOT NULL,
          BasicSalary DECIMAL(10, 2) NOT NULL,
          Bonus DECIMAL(10, 2) DEFAULT 0,
          Deductions DECIMAL(10, 2) DEFAULT 0,
          NetSalary DECIMAL(10, 2) NOT NULL,
          PaymentStatus ENUM('Paid', 'Unpaid') DEFAULT 'Unpaid',
          PaymentDate VARCHAR(50),
          CreatedAt VARCHAR(50)
      )
    `);
    // Ensure all Payroll columns exist (Migration)
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN OvertimeHours DECIMAL(10, 2) DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN OvertimeAmount DECIMAL(10, 2) DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN GrossSalary DECIMAL(10, 2) DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN PresentDays INT DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN LeaveDays INT DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN AbsentDays INT DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN WorkingDays INT DEFAULT 30"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN LeaveThreshold INT DEFAULT 0"); } catch (e) { }
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
        Admin: [
          'page_dashboard', 'page_appointments', 'page_patients', 'page_fees', 'page_medicines', 'page_pharmacy',
          'page_prescriptions', 'page_lab_registration', 'page_lab_fees', 'page_lab_results', 'page_pathology',
          'page_users', 'page_expenses', 'page_settings', 'page_hr', 'page_salary_settings', 'btn_manage_staff',
          'page_clinical_forms'
        ],
        Doctor: ['page_dashboard', 'page_appointments', 'page_patients', 'page_medicines', 'page_prescriptions', 'page_settings', 'page_clinical_forms'],
        Receptionist: ['page_dashboard', 'page_appointments', 'page_patients', 'page_fees', 'page_pharmacy', 'page_expenses', 'page_settings', 'page_clinical_forms'],
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

    // Seed default users if none exist
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
      try {
        await pool.execute(
          "UPDATE Users SET Password = ? WHERE Username = 'admin'",
          ['Admin123@#']
        );
      } catch (e) { }
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
        UpdatedAt VARCHAR(50)
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

    // Insert Default Salary Configuration if not exists
    const [salaryConfigCount] = await pool.execute("SELECT COUNT(*) as count FROM AppSettings WHERE ID = 'SALARY_CONFIG'");
    if (salaryConfigCount[0].count === 0) {
      const defaultSalaryConfig = {
        workingDaysMethod: 'Fixed',
        fixedWorkingDays: 30,
        paidLeavesPerMonth: 2,
        overtimeEnabled: true,
        overtimeRateMultiplier: 1.0,
        lateRuleEnabled: true,
        latesForOneDayDeduction: 3,
        absentDeductionEnabled: true
      };
      await pool.execute(
        "INSERT INTO AppSettings (ID, Category, Data) VALUES (?, ?, ?)",
        ['SALARY_CONFIG', 'Global', JSON.stringify(defaultSalaryConfig)]
      );
      console.log('✅ Default Salary Configuration initialized');
    }

    console.log('✅ Prescriptions table schema updated');

    // GenericMedicines table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS GenericMedicines (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Name VARCHAR(255) NOT NULL,
        Category VARCHAR(100),
        CreatedAt VARCHAR(50)
      )
    `);

    // ClinicalForms table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ClinicalForms (
        ID VARCHAR(50) PRIMARY KEY,
        PatientID VARCHAR(50),
        PatientName VARCHAR(255),
        FormType VARCHAR(50) NOT NULL,
        FormData JSON,
        CreatedBy VARCHAR(100),
        CreatedAt VARCHAR(50),
        UpdatedAt VARCHAR(50)
      )
    `);
    try { await pool.execute('ALTER TABLE ClinicalForms ADD INDEX idx_cf_patient (PatientID)'); } catch (e) { }
    try { await pool.execute('ALTER TABLE ClinicalForms ADD INDEX idx_cf_type (FormType)'); } catch (e) { }


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

app.get('/api/patients', cacheMiddleware, async (req, res) => {
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
      const condition = "(CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) OR VisitDate >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY))";
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
      const { startUtc } = getPktDayBounds(fromDate);
      const { endUtc: endUtc2 } = getPktDayBounds(toDate);
      const condition = "(CreatedAt BETWEEN ? AND ? OR VisitDate BETWEEN ? AND ?)";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
      params.push(startUtc, endUtc2, startUtc, endUtc2);
    } else if (fromDate) {
      const { startUtc } = getPktDayBounds(fromDate);
      const condition = "(CreatedAt >= ? OR VisitDate >= ?)";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
      params.push(startUtc, startUtc);
    } else if (toDate) {
      const { endUtc } = getPktDayBounds(toDate);
      const condition = "(CreatedAt <= ? OR VisitDate <= ?)";
      if (whereClause) {
        whereClause += ` AND ${condition}`;
      } else {
        whereClause = `WHERE ${condition}`;
      }
      params.push(endUtc, endUtc);
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
    // Sort by VisitDate (Latest Activity)
    const [rows] = await pool.query(
      `SELECT * FROM Patients ${whereClause} ORDER BY VisitDate DESC, CreatedAt DESC LIMIT ? OFFSET ?`,
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

    // Use literal PKT string (Standard Local Strategy)
    // Use standard UTC ISO string (Pure UTC Strategy)
    const now = new Date().toISOString();
    
    // For VisitDate, we also use the current moment's UTC string.
    const finalVisitDate = visitDate || now;

    // If mrn is provided use it, otherwise use id (for new patients without history)
    const patientMrn = mrn || id;

    // Insert into Patients
    await pool.execute(
      'INSERT INTO Patients (ID, MRN, CNIC, Name, GuardianName, Age, AgeMonths, AgeDays, Gender, Phone, Address, VisitDate, Symptoms, CreatedBy, CreatedByRole, CreatedAt, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patientMrn, cnic || null, name, guardianName || null, age, ageMonths || 0, ageDays || 0, gender, phone, address || null, finalVisitDate, symptoms || null, createdBy || null, createdByRole || null, now, now]
    );

    // Insert into Visits
    await pool.execute(
      'INSERT INTO Visits (PatientID, VisitDate, Symptoms, CreatedAt) VALUES (?, ?, ?, ?)',
      [id, finalVisitDate, symptoms || null, now]
    );

    flushPatientCache();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error adding patient:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CLINICAL FORMS API ============

app.get('/api/clinical-forms', async (req, res) => {
  try {
    const { type, patientId } = req.query;
    // Always filter by IsDeleted = 0 (Soft Delete)
    let query = 'SELECT * FROM ClinicalForms WHERE IsDeleted = 0';
    let params = [];
    let whereAdded = true;

    if (type) {
      query += ' AND FormType = ?';
      params.push(type);
    }
    if (patientId) {
      query += ' AND PatientID = ?';
      params.push(patientId);
    }

    query += ' ORDER BY CreatedAt DESC';
    const [rows] = await pool.execute(query, params);
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clinical-forms/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM ClinicalForms WHERE ID = ? AND IsDeleted = 0', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Form not found or has been deleted' });
    res.json(convertRowDates(rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clinical-forms', async (req, res) => {
  try {
    const { id, patientId, patientName, formType, formData, createdBy } = req.body;
    const now = new Date().toISOString();

    await pool.execute(
      'INSERT INTO ClinicalForms (ID, PatientID, PatientName, FormType, FormData, CreatedBy, CreatedAt, UpdatedAt, IsDeleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patientId || null, patientName || null, formType, JSON.stringify(formData), createdBy || null, now, now, 0]
    );

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clinical-forms/:id', async (req, res) => {
  try {
    const { formData } = req.body;
    const now = new Date().toISOString();

    await pool.execute(
      'UPDATE ClinicalForms SET FormData = ?, UpdatedAt = ? WHERE ID = ? AND IsDeleted = 0',
      [JSON.stringify(formData), now, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clinical-forms/:id', async (req, res) => {
  try {
    // Soft Delete Logic: Set IsDeleted to 1 instead of removing row
    await pool.execute('UPDATE ClinicalForms SET IsDeleted = 1 WHERE ID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CHAT MODULE API ============

// Get all conversations for the logged-in user
app.get('/api/chat/conversations', async (req, res) => {
  try {
    const userId = req.user.id;
    // 1. Fetch conversations and basic stats
    const [rows] = await pool.execute(`
      SELECT c.*, 
             (SELECT Content FROM ChatMessages WHERE ConversationID = c.ID ORDER BY CreatedAt DESC LIMIT 1) as LastMessage,
             (SELECT CreatedAt FROM ChatMessages WHERE ConversationID = c.ID ORDER BY CreatedAt DESC LIMIT 1) as LastMessageAt,
             (SELECT COUNT(*) FROM ChatMessages WHERE ConversationID = c.ID AND SenderID != ? AND IsRead = 0) as UnreadCount
      FROM ChatConversations c
      JOIN ChatParticipants p ON c.ID = p.ConversationID
      WHERE p.UserID = ?
      ORDER BY LastMessageAt DESC, c.UpdatedAt DESC
    `, [userId, userId]);

    if (rows.length === 0) return res.json([]);

    // 2. Optimized: Fetch ALL participants for these conversations in ONE query
    const convIds = rows.map(r => r.ID);
    const [allParticipants] = await pool.execute(`
      SELECT u.ID, u.Username, u.Role, u.LastLogin, p.ConversationID
      FROM Users u
      JOIN ChatParticipants p ON u.ID = p.UserID
      WHERE p.ConversationID IN (${convIds.map(() => '?').join(',')})
    `, convIds);

    // 3. Group participants by conversation
    const conversations = rows.map(conv => {
      const participants = allParticipants
        .filter(p => p.ConversationID === conv.ID)
        .map(p => {
          const { ConversationID, ...user } = p;
          return convertRowDates(user);
        });
      return { ...conv, participants };
    });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start a new 1-on-1 conversation
app.post('/api/chat/conversations', async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    const now = new Date().toISOString();

    // 1. Check if a 1-on-1 conversation already exists between these two
    const [existing] = await pool.execute(`
      SELECT p1.ConversationID 
      FROM ChatParticipants p1
      JOIN ChatParticipants p2 ON p1.ConversationID = p2.ConversationID
      JOIN ChatConversations c ON p1.ConversationID = c.ID
      WHERE c.Type = 'Direct' AND p1.UserID = ? AND p2.UserID = ?
    `, [userId, targetUserId]);

    if (existing.length > 0) {
      return res.json({ id: existing[0].ConversationID });
    }

    // 2. Create new conversation
    const [result] = await pool.execute(
      'INSERT INTO ChatConversations (Type, CreatedAt, UpdatedAt) VALUES (?, ?, ?)',
      ['Direct', now, now]
    );
    const convId = result.insertId;
    // 3. Add both participants
    await pool.execute('INSERT INTO ChatParticipants (ConversationID, UserID, JoinedAt) VALUES (?, ?, ?)', [convId, userId, now]);
    await pool.execute('INSERT INTO ChatParticipants (ConversationID, UserID, JoinedAt) VALUES (?, ?, ?)', [convId, targetUserId, now]);

    res.json({ id: convId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a conversation with pagination
app.get('/api/chat/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, beforeId } = req.query;
    
    let query = `
      SELECT m.*, m.IsRead as isRead, u.Username as SenderName 
      FROM ChatMessages m
      JOIN Users u ON m.SenderID = u.ID
      WHERE m.ConversationID = ?
    `;
    const params = [conversationId];

    if (beforeId) {
      query += ` AND m.ID < ?`;
      params.push(beforeId);
    }

    // Use .query instead of .execute for LIMIT to avoid "Incorrect arguments" error in some mysql2 versions
    query += ` ORDER BY CreatedAt DESC LIMIT ${parseInt(limit) || 50}`;

    const [rows] = await pool.query(query, params);
    res.json(rows.map(convertRowDates).reverse()); // Chronological order
  } catch (error) {
    console.error('❌ Chat History Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all messages in a conversation as read
app.put('/api/chat/messages/:conversationId/read', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    await pool.execute(
      'UPDATE ChatMessages SET IsRead = 1 WHERE ConversationID = ? AND SenderID != ?',
      [conversationId, userId]
    );
    
    // Notify others in the room that messages were read
    const io = req.app.get('io');
    if (io) {
      io.to(`room_${conversationId}`).emit('messages-read', {
        conversationId: Number(conversationId),
        readBy: userId
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/patients/:id', async (req, res) => {
  try {
    const { name, guardianName, cnic, age, ageMonths, ageDays, gender, phone, address, visitDate, symptoms, isRevisit } = req.body;

    const now = new Date().toISOString();

    // Pure UTC Strategy: 
    // If it's a revisit, we ALWAYS use the current absolute moment (UTC ISO).
    let finalVisitDate = visitDate;
    if (isRevisit === true) {
      finalVisitDate = now;
    }

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
        finalVisitDate ?? null,
        symptoms ?? null,
        now,
        req.params.id
      ]
    );

    // Insert new Visit ONLY if explicitly requested (e.g. Revisit)
    if (isRevisit === true) {
      // DEDUPLICATION LOGIC
      const [existingVisits] = await pool.execute(
        'SELECT ID FROM Visits WHERE PatientID = ? AND CreatedAt > DATE_SUB(?, INTERVAL 12 HOUR) ORDER BY CreatedAt DESC LIMIT 1',
        [req.params.id, now]
      );

      if (existingVisits.length === 0) {
        await pool.execute(
          'INSERT INTO Visits (PatientID, VisitDate, Symptoms, CreatedAt) VALUES (?, ?, ?, ?)',
          [req.params.id, finalVisitDate, symptoms || 'Revisit Recorded', now]
        );
      } else {
        console.log(`[Deduplication] Skipping duplicate visit for patient ${req.params.id}`);
        if (symptoms) {
          await pool.execute(
            'UPDATE Visits SET Symptoms = CONCAT(Symptoms, " | ", ?), VisitDate = ? WHERE ID = ?',
            [symptoms, finalVisitDate, existingVisits[0].ID]
          );
        }
      }
    }

    flushPatientCache();
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

    flushPatientCache();
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

    if (status) {
      const statusList = status.split(',');
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'Status IN (' + statusList.map(() => '?').join(',') + ')';
      params.push(...statusList);
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
    // Standard UTC Strategy: Store the exact universal moment.
    
    await pool.execute(
      'INSERT INTO PatientServices (ID, PatientID, Services, GrandTotal, Status, CreatedAt, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, patientId, JSON.stringify(services), grandTotal, status || 'Draft', now, now]
    );

    // 2. Touch Patient UpdatedAt and VisitDate ONLY if it is a Revisit (explicit user action)
    if (isRevisit === true) {
      console.log(`[Revisit] Updating patient ${patientId} timestamp and checking for duplicate visit record.`);

      // Update Patient record using UTC ISO string
      await pool.execute(
        'UPDATE Patients SET UpdatedAt = ?, VisitDate = ? WHERE ID = ?',
        [now, now, patientId]
      );

      // DEDUPLICATION LOGIC
      const [existingVisits] = await pool.execute(
        'SELECT ID FROM Visits WHERE PatientID = ? AND CreatedAt > DATE_SUB(?, INTERVAL 12 HOUR) ORDER BY CreatedAt DESC LIMIT 1',
        [patientId, now]
      );

      if (existingVisits.length === 0) {
        // Create new Visit record
        await pool.execute(
          'INSERT INTO Visits (PatientID, VisitDate, Symptoms, CreatedAt) VALUES (?, ?, ?, ?)',
          [patientId, now, 'Revisit - New Service', now]
        );
      } else {
        console.log(`[Deduplication] Service recorded. Skipping duplicate visit entry for patient ${patientId}.`);
        // Append service note to existing visit
        await pool.execute(
          'UPDATE Visits SET Symptoms = CONCAT(Symptoms, " | New Service Added"), VisitDate = ? WHERE ID = ?',
          [now, existingVisits[0].ID]
        );
      }
    }

      flushPatientCache();
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/patient-services/:id', async (req, res) => {
    try {
      const { services, grandTotal, status } = req.body;

      const pktNow = getNowPKT();
      await pool.execute(
        'UPDATE PatientServices SET Services = ?, GrandTotal = ?, Status = ?, UpdatedAt = ? WHERE ID = ?',
        [JSON.stringify(services), grandTotal, status, pktNow, req.params.id]
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
    { key: 'page_appointments', label: 'Appointments', group: 'Pages' },
    { key: 'page_patients', label: 'Patients', group: 'Pages' },
    { key: 'page_fees', label: 'Fee Collection', group: 'Pages' },
    { key: 'page_medicines', label: 'Medicines', group: 'Pages' },
    { key: 'page_pharmacy', label: 'Pharmacy', group: 'Pages' },
    { key: 'page_prescriptions', label: 'Prescriptions', group: 'Pages' },
    { key: 'page_clinical_forms', label: 'Clinical Forms', group: 'Pages' },
    { key: 'page_lab_registration', label: 'Lab Registration', group: 'Pages' },
    { key: 'page_lab_fees', label: 'Lab Fees', group: 'Pages' },
    { key: 'page_pathology', label: 'Pathology', group: 'Pages' },
    { key: 'page_lab_results', label: 'Lab Results (Legacy)', group: 'Pages' },
    { key: 'page_lab_management', label: 'Lab Management', group: 'Pages' },
    { key: 'page_hr', label: 'HR Management', group: 'Pages' },
    { key: 'page_salary_settings', label: 'Salary Rules', group: 'Pages' },
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
        const payloadUser = { ...convertRowDates(user), Permissions: permissions };

        // Generate the JWT token with a 1 hour expiration
        const token = jwt.sign(
          { id: user.ID, username: user.Username, role: user.Role },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        res.json({ success: true, token, user: payloadUser });
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

  // ============ HR & PAYROLL API ============

  app.get('/api/employees/me/:userId', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM Employees WHERE UserID = ?', [req.params.userId]);
      res.json(rows[0] ? convertRowDates(rows[0]) : null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Employees ---
  app.get('/api/employees', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM Employees ORDER BY CreatedAt DESC');
      res.json(rows.map(convertRowDates));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/employees', async (req, res) => {
    try {
      const { ID, UserID, Name, Designation, Phone, JoiningDate, BasicSalary, Status, StandardDailyHours, ShiftStartTime, ShiftEndTime } = req.body;
      await pool.execute(
        'INSERT INTO Employees (ID, UserID, Name, Designation, Phone, JoiningDate, BasicSalary, Status, StandardDailyHours, ShiftStartTime, ShiftEndTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [ID, UserID || null, Name, Designation || null, Phone || null, JoiningDate || null, BasicSalary || 0, Status || 'Active', StandardDailyHours || 8, ShiftStartTime || '09:00:00', ShiftEndTime || '17:00:00']
      );
      res.json({ success: true, id: ID });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/employees/:id', async (req, res) => {
    try {
      const { UserID, Name, Designation, Phone, JoiningDate, BasicSalary, Status, StandardDailyHours, ShiftStartTime, ShiftEndTime } = req.body;
      await pool.execute(
        'UPDATE Employees SET UserID = ?, Name = ?, Designation = ?, Phone = ?, JoiningDate = ?, BasicSalary = ?, Status = ?, StandardDailyHours = ?, ShiftStartTime = ?, ShiftEndTime = ? WHERE ID = ?',
        [UserID || null, Name, Designation || null, Phone || null, JoiningDate || null, BasicSalary || 0, Status || 'Active', StandardDailyHours || 8, ShiftStartTime || '09:00:00', ShiftEndTime || '17:00:00', req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/employees/:id', async (req, res) => {
    try {
      await pool.execute('DELETE FROM Employees WHERE ID = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Attendance ---
  app.get('/api/attendance', async (req, res) => {
    try {
      const { date, employeeId, startDate, endDate } = req.query;
      let whereClause = 'WHERE 1=1';
      let params = [];

      if (date) {
        whereClause += ' AND Date = ?';
        params.push(date);
      }
      if (employeeId) {
        whereClause += ' AND EmployeeID = ?';
        params.push(employeeId);
      }
      if (startDate && endDate) {
        whereClause += ' AND Date BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }

      const [rows] = await pool.query(`SELECT * FROM Attendance ${whereClause} ORDER BY Date DESC`, params);
      res.json(rows.map(convertRowDates));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/attendance/mark', async (req, res) => {
    try {
      const { EmployeeID, Date: recordDate, Status, CheckIn, CheckOut, Notes } = req.body;

      // IP Security Validation
      let isAuthorized = true;
      try {
        const [settingsRows] = await pool.query("SELECT Data FROM AppSettings WHERE ID = 'GLOBAL'");
        if (settingsRows.length > 0 && settingsRows[0].Data) {
          const globalData = typeof settingsRows[0].Data === 'string' ? JSON.parse(settingsRows[0].Data) : settingsRows[0].Data;

          if (globalData.clinicIpAddress && globalData.clinicIpAddress.trim() !== '') {
            // Get client IP
            const rawClientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
            const clientIpStr = String(rawClientIp);
            const requiredIp = globalData.clinicIpAddress.trim();

            // Support multiple IPs separated by comma
            const allowedIps = requiredIp.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);

            const isAllowedIP = allowedIps.some(ip => clientIpStr.includes(ip));

            if (!isAllowedIP) {
              console.log(`[ATTENDANCE BLOCKED] Required IP(s): ${requiredIp}, Client IP: ${clientIpStr}`);
              isAuthorized = false;
            }
          }
        }
      } catch (e) {
        console.error("Error reading IP settings:", e);
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: "You cannot mark the attendance right now. Please connect to the clinic's Wi-Fi network." });
      }

      // Check for existing record to prevent status changing
      const [existing] = await pool.query("SELECT Status FROM Attendance WHERE EmployeeID = ? AND Date = ?", [EmployeeID, recordDate]);
      if (existing.length > 0 && existing[0].Status && existing[0].Status !== Status) {
        return res.status(403).json({ error: `Attendance is already marked as '${existing[0].Status}' and cannot be changed.` });
      }

      await pool.execute(
        `INSERT INTO Attendance (EmployeeID, Date, Status, CheckIn, CheckOut, Notes) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE Status = VALUES(Status), CheckIn = VALUES(CheckIn), CheckOut = VALUES(CheckOut), Notes = VALUES(Notes)`,
        [EmployeeID, recordDate, Status, CheckIn || null, CheckOut || null, Notes || null]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Leave Management ---
  app.get('/api/leaves', async (req, res) => {
    try {
      const { employeeId, status } = req.query;
      let whereClause = 'WHERE 1=1';
      let params = [];
      if (employeeId) {
        whereClause += ' AND EmployeeID = ?';
        params.push(employeeId);
      }
      if (status) {
        whereClause += ' AND Status = ?';
        params.push(status);
      }
      const [rows] = await pool.query(`SELECT * FROM LeaveRequests ${whereClause} ORDER BY CreatedAt DESC`, params);
      res.json(rows.map(convertRowDates));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/leaves', async (req, res) => {
    try {
      const { ID, EmployeeID, StartDate, EndDate, Reason } = req.body;
      await pool.execute(
        'INSERT INTO LeaveRequests (ID, EmployeeID, StartDate, EndDate, Reason, Status) VALUES (?, ?, ?, ?, ?, ?)',
        [ID, EmployeeID, StartDate, EndDate, Reason || null, 'Pending']
      );
      res.json({ success: true, id: ID });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/leaves/:id/status', async (req, res) => {
    try {
      const { status, approvedBy } = req.body;
      await pool.execute('UPDATE LeaveRequests SET Status = ?, ApprovedBy = ? WHERE ID = ?', [status, approvedBy || null, req.params.id]);

      // Auto-mark attendance
      if (status === 'Approved') {
        const [leaves] = await pool.query('SELECT EmployeeID, StartDate, EndDate FROM LeaveRequests WHERE ID = ?', [req.params.id]);
        if (leaves.length > 0) {
          const leave = leaves[0];
          let currentDate = new Date(leave.StartDate);
          const endDate = new Date(leave.EndDate);

          while (currentDate <= endDate) {
            const dateStr = [
              currentDate.getFullYear(),
              String(currentDate.getMonth() + 1).padStart(2, '0'),
              String(currentDate.getDate()).padStart(2, '0')
            ].join('-');

            await pool.execute(
              `INSERT INTO Attendance (EmployeeID, Date, Status, Notes) VALUES (?, ?, 'Leave', 'Auto-Approved Leave')
             ON DUPLICATE KEY UPDATE Status = 'Leave', Notes = 'Auto-Approved Leave'`,
              [leave.EmployeeID, dateStr]
            );
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/leaves/:id', async (req, res) => {
    try {
      await pool.execute('DELETE FROM LeaveRequests WHERE ID = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Advance Payments ---
  app.get('/api/advances', async (req, res) => {
    try {
      const { employeeId, status } = req.query;
      let whereClause = 'WHERE 1=1';
      let params = [];
      if (employeeId) {
        whereClause += ' AND EmployeeID = ?';
        params.push(employeeId);
      }
      if (status) {
        whereClause += ' AND Status = ?';
        params.push(status);
      }
      const [rows] = await pool.query(`SELECT * FROM AdvancePayments ${whereClause} ORDER BY Date DESC`, params);
      const converted = rows.map(convertRowDates);
      if (converted.length > 0) console.log('DEBUG: First Advance Row:', JSON.stringify(converted[0], null, 2));
      res.json(converted);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/advances', async (req, res) => {
    try {
      const { ID, EmployeeID, Date: advanceDate, Amount, Description, Status, ApprovedBy } = req.body;
      const finalStatus = Status || 'Pending';
      const approvalTime = (finalStatus === 'Approved' || finalStatus === 'Deducted') ? new Date() : null;

      await pool.execute(
        'INSERT INTO AdvancePayments (ID, EmployeeID, Date, Amount, Description, Status, ApprovedBy, ApprovalTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [ID, EmployeeID, advanceDate, Amount, Description || null, finalStatus, ApprovedBy || null, approvalTime]
      );
      res.json({ success: true, id: ID });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/advances/:id/status', async (req, res) => {
    try {
      const { status, approvedBy } = req.body;
      await pool.execute(
        'UPDATE AdvancePayments SET Status = ?, ApprovedBy = ?, ApprovalTime = NOW() WHERE ID = ?',
        [status, approvedBy || null, req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/advances/:id', async (req, res) => {
    try {
      await pool.execute('DELETE FROM AdvancePayments WHERE ID = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Payroll ---
  app.get('/api/payroll', async (req, res) => {
    try {
      const { month, year } = req.query;
      let whereClause = 'WHERE 1=1';
      let params = [];
      if (month && year) {
        whereClause += ' AND Month = ? AND Year = ?';
        params.push(month, year);
      }
      const [rows] = await pool.query(`SELECT * FROM Payroll ${whereClause} ORDER BY CreatedAt DESC`, params);
      res.json(rows.map(convertRowDates));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Salary Config endpoints
  app.get('/api/hr/salary-config', async (req, res) => {
    try {
      const [rows] = await pool.execute("SELECT Data FROM AppSettings WHERE ID = 'SALARY_CONFIG'");
      if (rows.length > 0) {
        const config = typeof rows[0].Data === 'string' ? JSON.parse(rows[0].Data) : rows[0].Data;
        res.json(config);
      } else {
        res.status(404).json({ error: 'Salary configuration not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/hr/salary-config', async (req, res) => {
    try {
      const data = req.body;
      await pool.execute(
        `INSERT INTO AppSettings (ID, Category, Data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE Data = VALUES(Data)`,
        ['SALARY_CONFIG', 'Global', JSON.stringify(data)]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payroll/generate', async (req, res) => {
    try {
      const { month, year, workingDays: workingDaysInput, leaveThreshold: leaveThresholdInput } = req.body;

      // 1. Fetch Global Salary Config
      let [configRows] = await pool.execute("SELECT Data FROM AppSettings WHERE ID = 'SALARY_CONFIG'");
      const config = configRows.length > 0 ? (typeof configRows[0].Data === 'string' ? JSON.parse(configRows[0].Data) : configRows[0].Data) : {
        fixedWorkingDays: 30,
        paidLeavesPerMonth: 2,
        overtimeHourlyRate: 200,
        latesForOneDayDeduction: 3,
        overtimeEnabled: true
      };

      // Parameters with Fallbacks: req.body overrides global config
      const workingDays = workingDaysInput || config.fixedWorkingDays || 30;
      const leaveThreshold = leaveThresholdInput !== undefined ? leaveThresholdInput : (config.paidLeavesPerMonth || 0);

      // 2. Get all active employees
      const [employees] = await pool.query("SELECT * FROM Employees WHERE Status = 'Active'");

      // 3. Generate payroll for each employee
      for (const emp of employees) {
        // Get attendance stats for the month
        const [attendanceStats] = await pool.query(
          "SELECT Status, COUNT(*) as count FROM Attendance WHERE EmployeeID = ? AND MONTH(Date) = ? AND YEAR(Date) = ? GROUP BY Status",
          [emp.ID, month, year]
        );

        const stats = { Present: 0, Absent: 0, Leave: 0, Late: 0 };
        attendanceStats.forEach(s => { stats[s.Status] = s.count || 0; });

        const presentOnlyDays = stats.Present || 0;
        const lateDays = stats.Late || 0;
        const absentDays = stats.Absent || 0;
        const leaveDays = stats.Leave || 0;
        const presentDays = presentOnlyDays + lateDays;

        // Late Rule Penalty
        let latePenaltyDays = 0;
        if (config.lateRuleEnabled && config.latesForOneDayDeduction > 0) {
          latePenaltyDays = Math.floor(lateDays / config.latesForOneDayDeduction);
        }

        // Calculate payable days: Total worked + Leaves (up to threshold)
        const paidLeaveDays = Math.min(leaveDays, leaveThreshold);
        const totalPayableDays = presentOnlyDays + (lateDays - latePenaltyDays) + paidLeaveDays;

        // Calculate deduction days: Total working days - Payable days
        // This includes explicit absents AND late penalty days AND unlogged days
        const totalDeductibleDays = Math.max(0, workingDays - totalPayableDays);

        // Calculate daily and hourly rate
        const stdDailyHours = emp.StandardDailyHours || 8;
        const shiftEndTime = emp.ShiftEndTime || '17:00:00';
        const perDaySalary = emp.BasicSalary / workingDays;
        const hourlyRate = perDaySalary / stdDailyHours;
        const absenceDeduction = perDaySalary * totalDeductibleDays;

        // Calculate Overtime natively with MySQL TIMEDIFF
        const [overtime] = await pool.query(
          `SELECT ROUND(SUM(TIME_TO_SEC(TIMEDIFF(CheckOut, ?))) / 3600, 2) as ot_hours 
         FROM Attendance 
         WHERE EmployeeID = ? AND MONTH(Date) = ? AND YEAR(Date) = ? 
         AND CheckOut IS NOT NULL AND CheckOut > ?`,
          [shiftEndTime, emp.ID, month, year, shiftEndTime]
        );
        const overtimeHours = parseFloat(overtime[0].ot_hours) || 0;

        // Use fixed hourly rate for overtime amount
        const otRate = config.overtimeEnabled ? (config.overtimeHourlyRate || 0) : 0;
        const overtimeAmount = overtimeHours * otRate;

        // Get pending advances
        const [advances] = await pool.query(
          "SELECT SUM(Amount) as total FROM AdvancePayments WHERE EmployeeID = ? AND Status = 'Pending' AND MONTH(Date) <= ? AND YEAR(Date) <= ?",
          [emp.ID, month, year]
        );
        const advanceDeduction = advances[0].total || 0;

        const totalDeductions = absenceDeduction + advanceDeduction;
        const bonus = 0; // Optional extension for Future Bonus APIs
        const grossSalary = parseFloat(emp.BasicSalary) + overtimeAmount + bonus;
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        const payrollId = `PR-${emp.ID}-${year}-${month}`;

        // Insert or Update Payroll
        await pool.execute(
          `INSERT INTO Payroll (ID, EmployeeID, Month, Year, BasicSalary, Bonus, Deductions, NetSalary, PaymentStatus, OvertimeHours, OvertimeAmount, GrossSalary, PresentDays, LeaveDays, AbsentDays, WorkingDays, LeaveThreshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE BasicSalary=VALUES(BasicSalary), Bonus=VALUES(Bonus), Deductions=VALUES(Deductions), NetSalary=VALUES(NetSalary), OvertimeHours=VALUES(OvertimeHours), OvertimeAmount=VALUES(OvertimeAmount), GrossSalary=VALUES(GrossSalary), PresentDays=VALUES(PresentDays), LeaveDays=VALUES(LeaveDays), AbsentDays=VALUES(AbsentDays), WorkingDays=VALUES(WorkingDays), LeaveThreshold=VALUES(LeaveThreshold)`,
          [payrollId, emp.ID, month, year, emp.BasicSalary, bonus, totalDeductions, netSalary, overtimeHours, overtimeAmount, grossSalary, presentDays, leaveDays, absentDays, workingDays, leaveThreshold]
        );

        // If there were advances deducted, mark them as Deducted
        if (advanceDeduction > 0) {
          await pool.execute(
            "UPDATE AdvancePayments SET Status = 'Deducted' WHERE EmployeeID = ? AND Status = 'Pending' AND MONTH(Date) <= ? AND YEAR(Date) <= ?",
            [emp.ID, month, year]
          );
        }
      }

      res.json({ success: true, count: employees.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/attendance/monthly-summary — per-employee attendance counts for a month
  app.get('/api/attendance/monthly-summary', async (req, res) => {
    try {
      const { month, year } = req.query;
      if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
      }

      // Aggregate attendance status counts per employee
      const [rows] = await pool.query(
        `SELECT 
         a.EmployeeID,
         e.Name AS EmployeeName,
         e.Designation,
         e.ShiftEndTime,
         SUM(CASE WHEN a.Status = 'Present' THEN 1 ELSE 0 END) AS presentDays,
         SUM(CASE WHEN a.Status = 'Absent'  THEN 1 ELSE 0 END) AS absentDays,
         SUM(CASE WHEN a.Status = 'Late'    THEN 1 ELSE 0 END) AS lateDays,
         SUM(CASE WHEN a.Status = 'Leave'   THEN 1 ELSE 0 END) AS leaveDays,
         COUNT(*)                                               AS totalMarked
       FROM Attendance a
       JOIN Employees e ON a.EmployeeID = e.ID
       WHERE MONTH(a.Date) = ? AND YEAR(a.Date) = ?
         AND e.Status = 'Active'
       GROUP BY a.EmployeeID, e.Name, e.Designation, e.ShiftEndTime`,
        [month, year]
      );

      // Also fetch overtime hours per employee for the month
      const [otRows] = await pool.query(
        `SELECT 
         a.EmployeeID,
         ROUND(SUM(TIME_TO_SEC(TIMEDIFF(a.CheckOut, e.ShiftEndTime))) / 3600, 2) AS overtimeHours
       FROM Attendance a
       JOIN Employees e ON a.EmployeeID = e.ID
       WHERE MONTH(a.Date) = ? AND YEAR(a.Date) = ?
         AND a.CheckOut IS NOT NULL AND a.CheckOut > e.ShiftEndTime
         AND e.Status = 'Active'
       GROUP BY a.EmployeeID`,
        [month, year]
      );

      const otMap = {};
      otRows.forEach(r => { otMap[r.EmployeeID] = parseFloat(r.overtimeHours) || 0; });

      const result = rows.map(r => ({
        ...r,
        overtimeHours: otMap[r.EmployeeID] || 0
      }));

      res.json(result);
    } catch (error) {
      console.error('Error fetching monthly attendance summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/payroll/:id/pay', async (req, res) => {
    try {
      await pool.execute(
        "UPDATE Payroll SET PaymentStatus = 'Paid', PaymentDate = CURRENT_TIMESTAMP WHERE ID = ?",
        [req.params.id]
      );
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

  // ============ APPOINTMENTS API ============

  // GET /api/appointments — list for a given date, with optional status & search
  app.get('/api/appointments', cacheMiddleware, async (req, res) => {
    try {
      const { date, status, search } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (date) {
        whereClause += ' AND ApptDate = ?';
        params.push(date);
      }

      if (status && status !== 'All' && status !== 'undefined') {
        whereClause += ' AND Status = ?';
        params.push(status);
      }

      if (search && search !== 'undefined') {
        whereClause += ' AND (PatientName LIKE ? OR Phone LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      const [rows] = await pool.query(
        `SELECT * FROM Appointments ${whereClause} ORDER BY TokenNumber ASC, ApptTime ASC`,
        params
      );

      res.json(rows.map(convertRowDates));
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/appointments — book a new appointment (auto-assigns daily token)
  app.post('/api/appointments', async (req, res) => {
    try {
      const { id, patientId, name, phone, date, time, service, notes, createdBy } = req.body;

      if (!name || !phone || !date || !time) {
        return res.status(400).json({ error: 'Name, phone, date and time are required.' });
      }

      // Auto-calculate next token number for the given date
      const [tokenRows] = await pool.execute(
        'SELECT COALESCE(MAX(TokenNumber), 0) + 1 AS nextToken FROM Appointments WHERE ApptDate = ?',
        [date]
      );
      const tokenNumber = tokenRows[0].nextToken;

      const apptId = id || `APPT-${Date.now().toString(36).toUpperCase()}`;

      await pool.execute(
        `INSERT INTO Appointments (ID, PatientID, PatientName, Phone, ApptDate, ApptTime, Service, Status, Notes, TokenNumber, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
        [apptId, (patientId && patientId !== '') ? patientId : null, name, phone, date, time, service || 'Consultation', notes || null, tokenNumber, createdBy || null]
      );

      res.json({ success: true, id: apptId, tokenNumber });
    } catch (error) {
      console.error('Error creating appointment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/appointments/:id — update status or other fields
  app.put('/api/appointments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { Status, PatientName, Phone, ApptDate, ApptTime, Service, Notes, PatientID } = req.body;

      // Build dynamic SET clause
      const updates = [];
      const params = [];

      if (Status !== undefined) { updates.push('Status = ?'); params.push(Status); }
      if (PatientName !== undefined) { updates.push('PatientName = ?'); params.push(PatientName); }
      if (Phone !== undefined) { updates.push('Phone = ?'); params.push(Phone); }
      if (ApptDate !== undefined) { updates.push('ApptDate = ?'); params.push(ApptDate); }
      if (ApptTime !== undefined) { updates.push('ApptTime = ?'); params.push(ApptTime); }
      if (Service !== undefined) { updates.push('Service = ?'); params.push(Service); }
      if (Notes !== undefined) { updates.push('Notes = ?'); params.push(Notes); }
      if (PatientID !== undefined) { updates.push('PatientID = ?'); params.push(PatientID); }

      if (updates.length === 0) {
        return res.json({ success: true });
      }

      params.push(id);
      await pool.query(`UPDATE Appointments SET ${updates.join(', ')} WHERE ID = ?`, params);

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating appointment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/appointments/:id
  app.delete('/api/appointments/:id', async (req, res) => {
    try {
      await pool.execute('DELETE FROM Appointments WHERE ID = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ WHATSAPP API ============
  app.post('/api/whatsappsms', async (req, res) => {
    try {
      const { to, message } = req.body;

      // Get GLOBAL settings to extract UltraMsg credentials
      const [settings] = await pool.query("SELECT Data FROM AppSettings WHERE ID = 'GLOBAL'");
      if (settings.length === 0) return res.status(400).json({ error: 'Global settings not found.' });

      let configStr = settings[0].Data;
      if (typeof configStr === 'string') configStr = JSON.parse(configStr);

      const waConfig = configStr.whatsappConfig;
      if (!waConfig || !waConfig.enabled) {
        return res.status(400).json({ error: 'WhatsApp integration is currently disabled in Settings.' });
      }
      if (!waConfig.instanceId || !waConfig.token) {
        return res.status(400).json({ error: 'WhatsApp instance ID or token missing.' });
      }

      // Format phone number to international string (remove symbols, ensure leading 92)
      let toPhone = (to || '').replace(/\D/g, '');
      if (toPhone.startsWith('0')) {
        toPhone = '92' + toPhone.substring(1);
      }

      // Use dynamic import or require
      const axios = require('axios');
      const response = await axios.post(`https://api.ultramsg.com/${waConfig.instanceId}/messages/chat`, {
        token: waConfig.token,
        to: `+${toPhone}`,
        body: message
      });

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('WhatsApp sending error:', error?.response?.data || error.message);
    }
  });

  // ============ SMS API ============
  app.post('/api/smsapi', async (req, res) => {
    try {
      const { to, message } = req.body;

      // Get GLOBAL settings to extract SMS credentials
      const [settings] = await pool.query("SELECT Data FROM AppSettings WHERE ID = 'GLOBAL'");
      if (settings.length === 0) return res.status(400).json({ error: 'Global settings not found.' });

      let configStr = settings[0].Data;
      if (typeof configStr === 'string') configStr = JSON.parse(configStr);

      const smsConfig = configStr.smsConfig;
      if (!smsConfig || !smsConfig.enabled) {
        return res.status(400).json({ error: 'SMS integration is currently disabled in Settings.' });
      }
      if (!smsConfig.providerUrlTemplate) {
        return res.status(400).json({ error: 'SMS provider URL template is missing.' });
      }

      // Format phone number to string (remove symbols, ensure leading 92 depending on standard usually required by bulkSMS, 
      // bulksms.com.pk usually wants e.g. 923001234567, but let's just strip formatting first)
      let toPhone = (to || '').replace(/\D/g, '');
      if (toPhone.startsWith('0')) {
        toPhone = '92' + toPhone.substring(1);
      }

      // Replace URL template strings
      let targetUrl = smsConfig.providerUrlTemplate
        .replace('{phone}', toPhone)
        .replace('{message}', encodeURIComponent(message));

      // Some providers might mis-use `{{phone}}` or `[phone]`. The simple replace handles exact `{phone}` string.

      // Execute request
      const axios = require('axios');
      const response = await axios.get(targetUrl);

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('SMS sending error:', error?.response?.data || error.message);
      res.status(500).json({ error: 'Failed to send SMS message.' });
    }
  });

  // ============ CHAT API ENDPOINTS ============

  // 1. Get all conversations for current user
  app.get('/api/chat/conversations', async (req, res) => {
    try {
      const userId = req.user.id;
      // Get conversations where user is a participant
      const [rows] = await pool.query(`
        SELECT c.*, 
               (SELECT Content FROM ChatMessages WHERE ConversationID = c.ID ORDER BY CreatedAt DESC LIMIT 1) as LastMessage,
               (SELECT CreatedAt FROM ChatMessages WHERE ConversationID = c.ID ORDER BY CreatedAt DESC LIMIT 1) as LastMessageAt,
               (SELECT COUNT(*) FROM ChatMessages WHERE ConversationID = c.ID AND SenderID != ? AND IsRead = 0) as UnreadCount
        FROM ChatConversations c
        JOIN ChatParticipants cp ON c.ID = cp.ConversationID
        WHERE cp.UserID = ?
        ORDER BY LastMessageAt DESC
      `, [userId, userId]);

      // Get participants for each conversation
      for (const conv of rows) {
        const [parts] = await pool.query(`
          SELECT u.ID, u.Username, u.Role, u.LastLogin
          FROM ChatParticipants cp
          JOIN Users u ON cp.UserID = u.ID
          WHERE cp.ConversationID = ?
        `, [conv.ID]);
        conv.participants = parts;
      }

      res.json(rows);
    } catch (err) {
      console.error('❌ Failed to fetch conversations:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 2. Get messages for a specific conversation
  app.get('/api/chat/messages/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { limit = 50, beforeId } = req.query;
      
      let query = 'SELECT * FROM ChatMessages WHERE ConversationID = ?';
      const params = [conversationId];

      if (beforeId) {
        query += ' AND ID < ?';
        params.push(beforeId);
      }

      query += ' ORDER BY CreatedAt DESC LIMIT ?';
      params.push(Number(limit));

      const [rows] = await pool.query(query, params);
      // Return in chronological order for the frontend
      res.json(rows.reverse());
    } catch (err) {
      console.error('❌ Failed to fetch messages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 3. Mark messages as read
  app.put('/api/chat/messages/:conversationId/read', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      await pool.execute(
        'UPDATE ChatMessages SET IsRead = 1 WHERE ConversationID = ? AND SenderID != ?',
        [conversationId, userId]
      );

      res.json({ success: true });
    } catch (err) {
      console.error('❌ Failed to mark messages as read:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 4. Start a new conversation
  app.post('/api/chat/conversations', async (req, res) => {
    try {
      const { targetUserId } = req.body;
      const userId = req.user.id;

      // Check if conversation already exists (Direct Message)
      const [existing] = await pool.query(`
        SELECT cp1.ConversationID as id
        FROM ChatParticipants cp1
        JOIN ChatParticipants cp2 ON cp1.ConversationID = cp2.ConversationID
        JOIN ChatConversations c ON cp1.ConversationID = c.ID
        WHERE cp1.UserID = ? AND cp2.UserID = ? AND c.Type = 'Direct'
      `, [userId, targetUserId]);

      if (existing.length > 0) {
        return res.json({ id: existing[0].id });
      }

      // Create new conversation with timestamps
      const now = new Date().toISOString();
      const [result] = await pool.execute(
        'INSERT INTO ChatConversations (Type, CreatedAt, UpdatedAt) VALUES (?, ?, ?)',
        ['Direct', now, now]
      );
      const conversationId = result.insertId;

      // Add participants with JoinedAt timestamp
      await pool.execute(
        'INSERT INTO ChatParticipants (ConversationID, UserID, JoinedAt) VALUES (?, ?, ?), (?, ?, ?)',
        [conversationId, userId, now, conversationId, targetUserId, now]
      );

      res.json({ id: conversationId });
    } catch (err) {
      console.error('❌ Failed to start conversation:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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


  // Database initialization moved to start sequence
  initializeDatabase().catch(err => {
    console.error('🔥 Database initialization failed:', err.message);
    dbConnected = false;
  });
  // --- SOCKET.IO REAL-TIME CHAT SETUP ---
  const http = require('http');
  const { Server } = require('socket.io');
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  app.set('io', io);

  // Presence Tracking: UserID -> { socketId, isOnChatPage, lastChatActivity }
  const userSocketMap = new Map();

  function broadcastOnlineUsers() {
    const now = Date.now();
    const onlineUserIds = [];
    
    for (const [userId, info] of userSocketMap.entries()) {
      const diff = now - info.lastChatActivity;
      const wasRecentlyActive = diff < 120000; // 2 minutes

      if (wasRecentlyActive) {
        onlineUserIds.push(userId);
        info.hasWarnedInactivity = false; // Reset flag when active
      } else {
        // If they just crossed the 2-min mark, update their "Last Seen" in DB once
        if (!info.hasWarnedInactivity) {
          const lastActiveDate = new Date(info.lastChatActivity).toISOString();
          pool.execute('UPDATE Users SET LastLogin = ? WHERE ID = ?', [lastActiveDate, userId]).catch(err => {
            console.error('❌ Failed to update LastLogin on inactivity:', err);
          });
          info.hasWarnedInactivity = true; // Prevent constant DB writes
        }
      }
    }
    
    io.emit('online-users', onlineUserIds);
  }

  // Every 60 seconds, check for inactive users and re-broadcast
  setInterval(() => {
    broadcastOnlineUsers();
  }, 60000);

  // Socket Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: No token provided"));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error("Authentication error: Invalid token"));
      socket.user = decoded; // Attach user data to socket
      next();
    });
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    
    // Initialize user info with smart activity tracking
    userSocketMap.set(userId, {
      socketId: socket.id,
      isOnChatPage: false,
      lastChatActivity: Date.now() // Start active
    });

    // Update LastLogin in database
    pool.execute('UPDATE Users SET LastLogin = ? WHERE ID = ?', [new Date().toISOString(), userId]).catch(err => {
      console.error('❌ Failed to update LastLogin:', err);
    });

    console.log(`💬 Chat: User ${socket.user.username} connected (${userId})`);
    broadcastOnlineUsers();

    // Join a specific conversation room
    socket.on('join-conversation', (conversationId) => {
      const roomName = `room_${conversationId}`;
      socket.join(roomName);
      console.log(`📍 Chat: ${socket.user.username} joined ${roomName}`);
    });

    // Handle sending message
    socket.on('send-message', async (data) => {
      const { conversationId, content, receiverId } = data;
      const roomName = `room_${conversationId}`;

      try {
        // Ensure sender is in the room
        socket.join(roomName);

        // 1. Save to Database
        const now = new Date().toISOString();
        const [result] = await pool.execute(
          'INSERT INTO ChatMessages (ConversationID, SenderID, Content, CreatedAt) VALUES (?, ?, ?, ?)',
          [Number(conversationId), userId, content, now]
        );

        const newMessage = {
          ID: result.insertId,
          conversationId,
          senderId: userId,
          content,
          createdAt: now,
          isRead: 0
        };

        // 2. Emit to everyone in the room
        io.to(roomName).emit('new-message', newMessage);

        // 3. Global notification for receiver
        if (receiverId) {
          const receiverInfo = userSocketMap.get(receiverId);
          if (receiverInfo?.socketId) {
            const receiverSocket = io.sockets.sockets.get(receiverInfo.socketId);
            if (receiverSocket && !receiverSocket.rooms.has(roomName)) {
              io.to(receiverInfo.socketId).emit('message-notification', {
                fromName: socket.user.username,
                content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
              });
            }
          }
        }
      } catch (err) {
        console.error('❌ Chat: Failed to save message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle entering/leaving the chat page
    socket.on('set-chat-status', (isOnChat) => {
      const info = userSocketMap.get(userId);
      if (info) {
        info.isOnChatPage = !!isOnChat;
        info.lastChatActivity = Date.now();
        broadcastOnlineUsers();
      }
    });

    // Explicitly mark user as active/online
    socket.on('user-active', () => {
      const info = userSocketMap.get(userId);
      if (info) {
        info.lastChatActivity = Date.now();
        broadcastOnlineUsers();
      }
    });

    socket.on('typing', (data) => {
      const { conversationId, isTyping } = data;
      io.emit('typing', {
        userId,
        isTyping,
        conversationId: Number(conversationId)
      });
    });

    socket.on('disconnect', () => {
      const info = userSocketMap.get(userId);
      // Final update to database on disconnect
      const now = new Date().toISOString();
      pool.execute('UPDATE Users SET LastLogin = ? WHERE ID = ?', [now, userId]).catch(err => {
        console.error('❌ Failed to update LastLogin on disconnect:', err);
      });

      userSocketMap.delete(userId);
      console.log(`💬 Chat: User ${socket.user.username} disconnected`);
      broadcastOnlineUsers();
    });
  });

    // --- START SERVER ---
    try {
      const serverInstance = httpServer.listen(PORT, '0.0.0.0', () => {
        console.log('-------------------------------------------');
        console.log('✅ SERVER ONLINE');
        console.log(`🏥 Hospital Management Backend: http://0.0.0.0:${PORT}`);
        console.log(`💬 Real-time Chat: Enabled (Socket.io)`);
        console.log('-------------------------------------------');
      });

      serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use.`);
          process.exit(1);
        } else {
          console.error('❌ Server error:', err);
        }
      });

      // Single Graceful Shutdown Handler
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutdown signal received. Closing server...');
        serverInstance.close(() => {
          console.log('👋 Server stopped.');
          process.exit(0);
        });
      });
    } catch (error) {
      console.error('🔥 CRITICAL ERROR during startup:', error);
      process.exit(1);
    }
