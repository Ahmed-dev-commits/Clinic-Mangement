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
  console.log(`[CACHE] Flushing ${keys.length} patient-related keys:`);
  keys.forEach(key => {
    if (key.includes('/api/patients') || key.includes('/api/profile')) {
      console.log(`  - 🗑️ ${key}`);
      apiCache.del(key);
    }
  });
}

function flushStockCache() {
  const keys = apiCache.keys();
  console.log(`[CACHE] Flushing stock-related keys:`);
  keys.forEach(key => {
    if (key.includes('/api/stock')) {
      console.log(`  - 🗑️ ${key}`);
      apiCache.del(key);
    }
  });
}

// Helper to flush expense-related cache keys
function flushExpenseCache() {
  const keys = apiCache.keys();
  const expenseKeys = keys.filter(k => k.includes('/api/daily-expenses'));
  if (expenseKeys.length > 0) {
    console.log(`[CACHE] Flushing ${expenseKeys.length} expense-related keys`);
    apiCache.del(expenseKeys);
  }
}

// Helper to flush appointment-related cache keys
function flushAppointmentCache() {
  const keys = apiCache.keys();
  const appointmentKeys = keys.filter(k => k.includes('/api/appointments'));
  if (appointmentKeys.length > 0) {
    console.log(`[CACHE] Flushing ${appointmentKeys.length} appointment-related keys`);
    apiCache.del(appointmentKeys);
  }
}

// Helper to flush catalog-related cache keys
function flushCatalogCache() {
  const keys = apiCache.keys();
  console.log(`[CACHE] Flushing catalog-related keys:`);
  keys.forEach(key => {
    if (key.includes('/api/lab-tests-catalog') || key.includes('/api/patient-services')) {
      console.log(`  - 🗑️ ${key}`);
      apiCache.del(key);
    }
  });
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
  next();
});

// 1.5 JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    // When mounted at '/api', Express strips that prefix — req.path is RELATIVE
    // e.g. POST /api/users/login becomes req.path === '/users/login'
    const openPaths = ['/users/login', '/health', '/status'];
    // Allow settings (needed for login page branding before auth)
    // Allow public routes (like patient report tracking) - Use originalUrl to be bulletproof against Hostinger's proxy
    if (openPaths.includes(req.path) || req.path.startsWith('/settings/') || req.originalUrl.includes('/public/')) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access Denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
      if (err) {
        return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
      }
      
      req.user = user;

    // 🛡️ MAINTENANCE MODE CHECK (Phase 4) - OPTIMIZED WITH CACHE
    try {
      const maintenanceCacheKey = 'internal_maintenance_check';
      let globalData = apiCache.get(maintenanceCacheKey);
      
      if (!globalData) {
        const [settingsRows] = await pool.query("SELECT Data FROM AppSettings WHERE ID = 'GLOBAL'");
        if (settingsRows.length > 0) {
          globalData = typeof settingsRows[0].Data === 'string' ? JSON.parse(settingsRows[0].Data) : settingsRows[0].Data;
          // Cache maintenance status for 10 seconds to reduce DB load
          apiCache.set(maintenanceCacheKey, globalData, 10);
        }
      }

      if (globalData && globalData.isMaintenanceMode) {
        const currentUserRole = String(user.role || '').trim().toLowerCase();
        console.log(`[MAINTENANCE] Checking access - User: ${user.username}, Role: "${user.role}" (normalized: "${currentUserRole}")`);
        
        // Allow SuperAdmin AND Admin through so they can disable maintenance mode
        const bypassRoles = ['superadmin', 'admin'];
        if (!bypassRoles.includes(currentUserRole)) {
          return res.status(503).json({ error: 'System is under maintenance. Please try again later.' });
        }
        console.log(`[MAINTENANCE] ACCESS GRANTED for ${user.role}: ${user.username}`);
      }
    } catch (dbErr) {
      // Fallback: If DB check fails, we allow the request to proceed but log the warning
      console.warn('⚠️ Could not check maintenance status:', dbErr.message);
    }

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
  const cacheKey = req.originalUrl;

  // If the user presses the 'Refresh' button on the UI frontend, it sends a ?refresh flag.
  // We bust the cache for all patient-related queries to ensure a fresh start.
  if (req.query.refresh === 'true' || req.query.refresh === '1') {
    if (req.originalUrl.includes('/api/patients') || req.originalUrl.includes('/api/profile')) {
      flushPatientCache();
    } else {
      apiCache.del(cacheKey);
    }
  } else {
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
  }

  // Intercept the final JSON response to populate the cache
  const originalJson = res.json;
  res.json = function (body) {
    // Only cache successful OK responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      apiCache.set(cacheKey, body);
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

  // 1. Optimize Chat Mapping (Pascal to camel)
  if (row.Content !== undefined) row.content = row.Content;
  if (row.SenderID !== undefined) row.senderId = row.SenderID;
  if (row.ConversationID !== undefined) row.conversationId = row.ConversationID;
  if (row.CreatedAt !== undefined) row.createdAt = row.CreatedAt;

  // 2. High-Performance ISO Conversion
  const toIso = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    if (!s || s === '0000-00-00 00:00:00' || s === '0000-00-00') return null;

    const hasTimezone = s.includes('Z') || s.includes('+') || (s.includes('T') && s.length > 20);
    if (!hasTimezone) {
      const datePart = s.split('.')[0].replace(' ', 'T');
      const candidate = datePart.includes('T') ? `${datePart}+05:00` : `${datePart}T00:00:00+05:00`;
      return candidate;
    }
    return s;
  };

  const dateFields = [
    'CreatedAt', 'UpdatedAt', 'VisitDate', 'TestDate', 'ReportDate', 
    'FollowUpDate', 'ApprovalTime', 'FinalizedAt', 'LastUpdatedAt', 'CollectedAt',
    'Date'
  ];

  for (const field of dateFields) {
    if (row[field]) {
      const isoDate = toIso(row[field]);
      row[field] = isoDate;
      const camelField = field.charAt(0).toLowerCase() + field.slice(1);
      row[camelField] = isoDate;
    }
  }

  // 3. Targeted JSON Parsing (Only if needed)
  const jsonFields = ['Data', 'Medicines', 'LabTests', 'Tests', 'Services', 'Items', 'SelectedTests', 'FormData'];
  for (const field of jsonFields) {
    if (row[field] && typeof row[field] === 'string') {
      const trimmed = row[field].trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { row[field] = JSON.parse(trimmed); } catch (e) {}
      }
    }
  }

  return row;
}

// ============ PKT DATE HELPERS (GLOBAL) ============
const getPktDayBounds = (dateStr) => {
  // Input: '2026-02-26'. Target PKT is +05:00
  const startPkt = new Date(`${dateStr}T00:00:00+05:00`);
  const endPkt = new Date(`${dateStr}T23:59:59.999+05:00`);
  return { startUtc: startPkt.toISOString(), endUtc: endPkt.toISOString() };
};

const getNowPKT = () => {
  // Return the current ISO string but ensuring we treat the system clock as Z 
  // and manually creating the PKT representation if needed, 
  // but for storage we usually just use .toISOString() (UTC)
  return new Date().toISOString();
};

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create connection pool
    await createPool();

    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database');
    connection.release();

    // ============ SMART MIGRATION SYSTEM ============
    // Create migration table first
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS SystemMigrations (
        Version INT PRIMARY KEY,
        AppliedAt VARCHAR(50)
      )
    `);

    const [migRows] = await pool.execute('SELECT MAX(Version) as current FROM SystemMigrations');
    const currentVersion = migRows[0].current || 0;
    console.log(`📡 Current Database Version: ${currentVersion}`);

    // Helper for version-controlled migrations
    const runMigration = async (version, label, sqls) => {
      if (currentVersion < version) {
        console.log(`🚀 Applying Migration v${version}: ${label}...`);
        for (const sql of sqls) {
          try { await pool.execute(sql); } catch (e) {
            // Ignore duplicate column errors during migration
            if (e.errno !== 1060 && e.errno !== 1061) console.warn(`   ⚠️ Warning in migration v${version}:`, e.message);
          }
        }
        await pool.execute('INSERT INTO SystemMigrations (Version, AppliedAt) VALUES (?, ?)', [version, new Date().toISOString()]);
        console.log(`✅ Migration v${version} complete.`);
      }
    };

    // v1: Core Schema & Legacy Conversions
    await runMigration(1, 'Legacy Time Conversions', [
      "ALTER TABLE Patients MODIFY COLUMN CreatedAt VARCHAR(50)",
      "ALTER TABLE Patients MODIFY COLUMN UpdatedAt VARCHAR(50)",
      "ALTER TABLE Visits MODIFY COLUMN CreatedAt VARCHAR(50)",
      "ALTER TABLE Stock MODIFY COLUMN CreatedAt VARCHAR(50)",
      "ALTER TABLE Payments MODIFY COLUMN CreatedAt VARCHAR(50)",
      "ALTER TABLE Prescriptions MODIFY COLUMN CreatedAt VARCHAR(50)",
      "ALTER TABLE LabResults MODIFY COLUMN CreatedAt VARCHAR(50)",
      "ALTER TABLE Users MODIFY COLUMN CreatedAt VARCHAR(50)"
    ]);

    // v2: Patient & Prescription Extensions
    await runMigration(2, 'Patient & Rx Extensions', [
      "ALTER TABLE Patients ADD COLUMN GuardianName VARCHAR(255)",
      "ALTER TABLE Patients ADD COLUMN CNIC VARCHAR(20)",
      "ALTER TABLE Prescriptions ADD COLUMN Status VARCHAR(20) DEFAULT 'Draft'",
      "ALTER TABLE Prescriptions ADD COLUMN FinalizedAt VARCHAR(50) NULL"
    ]);

    // v3: HR & Payroll Performance
    await runMigration(3, 'HR & Payroll Upgrades', [
      "ALTER TABLE Employees ADD COLUMN StandardDailyHours INT DEFAULT 8",
      "ALTER TABLE Payroll ADD COLUMN OvertimeHours DECIMAL(10, 2) DEFAULT 0",
      "ALTER TABLE Users ADD COLUMN IsActive TINYINT DEFAULT 1"
    ]);

    // v4: Appointment Soft Delete & Auditing
    await runMigration(4, 'Appointment Soft Delete', [
      "ALTER TABLE Appointments ADD COLUMN DeletedAt VARCHAR(50) NULL",
      "ALTER TABLE Appointments ADD COLUMN DeletedBy VARCHAR(100) NULL",
      "ALTER TABLE Appointments ADD COLUMN UpdatedAt VARCHAR(50) NULL"
    ]);

    // v5: PrescriptionTemplates CreatedBy
    await runMigration(5, 'PrescriptionTemplates CreatedBy', [
      "ALTER TABLE PrescriptionTemplates ADD COLUMN CreatedBy VARCHAR(100) DEFAULT NULL"
    ]);

    console.log('✅ All migrations verified.');

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
        CreatedAt VARCHAR(50),
        CreatedBy VARCHAR(100) DEFAULT 'System',
        UpdatedAt VARCHAR(50),
        UpdatedBy VARCHAR(100),
        IsDeleted TINYINT(1) DEFAULT 0,
        DeletedAt VARCHAR(50),
        DeletedBy VARCHAR(100),
        Unit VARCHAR(50) DEFAULT 'units'
      )
    `);

    // Migrations for Stock table
    const migrateStock = async (query) => {
      try {
        await pool.execute(query);
        console.log(`[MIGRATION] Applied: ${query}`);
      } catch (e) {
        if (!e.message.includes('Duplicate column name')) {
          console.error(`[MIGRATION ERROR] Failed: ${query}`, e.message);
        }
      }
    };

    await migrateStock("ALTER TABLE Stock ADD COLUMN CreatedBy VARCHAR(100) DEFAULT 'System'");
    await migrateStock("ALTER TABLE Stock ADD COLUMN UpdatedAt VARCHAR(50)");
    await migrateStock("ALTER TABLE Stock ADD COLUMN UpdatedBy VARCHAR(100)");
    await migrateStock("ALTER TABLE Stock ADD COLUMN IsDeleted TINYINT(1) DEFAULT 0");
    await migrateStock("ALTER TABLE Stock ADD COLUMN DeletedAt VARCHAR(50)");
    await migrateStock("ALTER TABLE Stock ADD COLUMN DeletedBy VARCHAR(100)");
    await migrateStock("ALTER TABLE Stock ADD COLUMN Unit VARCHAR(50) DEFAULT 'units'");

    // StockHistory table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS StockHistory (
        LogID INT AUTO_INCREMENT PRIMARY KEY,
        StockID VARCHAR(50),
        Action VARCHAR(50),
        QuantityChange INT,
        Details TEXT,
        PerformedBy VARCHAR(100),
        PerformedAt VARCHAR(50),
        OldQuantity INT DEFAULT 0,
        FOREIGN KEY (StockID) REFERENCES Stock(ID) ON DELETE CASCADE
      )
    `);

    // Migration for StockHistory
    const migrateStockHistory = async (query) => {
      try {
        await pool.execute(query);
        console.log(`[STOCK HISTORY MIGRATION] Applied: ${query}`);
      } catch (e) {
        if (!e.message.includes('Duplicate column name')) {
          console.error(`[STOCK HISTORY MIGRATION ERROR] Failed: ${query}`, e.message);
        }
      }
    };
    await migrateStockHistory("ALTER TABLE StockHistory ADD COLUMN OldQuantity INT DEFAULT 0");

    try { await pool.execute("CREATE INDEX idx_stockhistory_stockid ON StockHistory(StockID)"); } catch (e) { }

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

    // PrescriptionTemplates table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS PrescriptionTemplates (
        ID VARCHAR(50) PRIMARY KEY,
        Name VARCHAR(255) NOT NULL,
        Category VARCHAR(100) DEFAULT 'General',
        Diagnosis TEXT,
        Complaints TEXT,
        History TEXT,
        OnExamination TEXT,
        Precautions TEXT,
        TreatmentAtHome TEXT,
        Medicines JSON,
        LabTests JSON,
        CreatedBy VARCHAR(100) DEFAULT NULL,
        CreatedAt VARCHAR(50)
      )
    `);

    // Seed built-in templates using INSERT IGNORE
    try {
      console.log('🌱 Seeding built-in prescription templates...');
      const templatesToSeed = [
        {
          ID: 'tmpl-flu',
          Name: 'Flu / URTI Course',
          Category: 'Infection',
          Diagnosis: 'URTI (Upper Respiratory Tract Infection)',
          Complaints: 'Fever, dry cough, runny nose, body aches for 3 days.',
          History: 'No known drug allergies.',
          OnExamination: 'Throat congested, chest clear on auscultation.',
          Precautions: 'Avoid cold beverages, take steam inhalation twice daily.',
          TreatmentAtHome: 'Rest and warm liquids.',
          Medicines: JSON.stringify([
            { name: 'Panadol', dosage: '500mg', frequency: '1+1+1', duration: '5 Days', instructions: 'After meal' },
            { name: 'Arinac', dosage: '1 Tab', frequency: '1+0+1', duration: '5 Days', instructions: 'After meal' },
            { name: 'Cofcol Syrup', dosage: '2 tsp', frequency: '1+1+1', duration: '5 Days', instructions: 'After meal' }
          ]),
          LabTests: JSON.stringify([])
        },
        {
          ID: 'tmpl-gastro',
          Name: 'Acute Gastroenteritis (AGE)',
          Category: 'Infection',
          Diagnosis: 'Acute Gastroenteritis',
          Complaints: 'Vomiting, loose motions (4-5 episodes), abdominal pain since yesterday.',
          History: 'Gastroenteritis symptoms after eating outside food.',
          OnExamination: 'Abdomen soft, mild generalized tenderness, hydration status fair.',
          Precautions: 'Drink ORS after every loose stool, avoid spicy and oily food.',
          TreatmentAtHome: 'Soft diet (khichdi, yogurt).',
          Medicines: JSON.stringify([
            { name: 'Flagyl', dosage: '400mg', frequency: '1+1+1', duration: '5 Days', instructions: 'After meal' },
            { name: 'Gravinate', dosage: '50mg', frequency: '1+0+1', duration: '3 Days', instructions: 'Before meal if vomiting' },
            { name: 'ORS Sachet', dosage: '1 sachet', frequency: 'As needed', duration: '3 Days', instructions: 'Dissolve in 1 liter clean water' }
          ]),
          LabTests: JSON.stringify([])
        },
        {
          ID: 'tmpl-uti',
          Name: 'UTI Course',
          Category: 'Infection',
          Diagnosis: 'Urinary Tract Infection (UTI)',
          Complaints: 'Burning micturition, increased urinary frequency, mild lower abdominal pain.',
          History: 'No history of recurrent UTIs.',
          OnExamination: 'Suprapubic tenderness present.',
          Precautions: 'Drink plenty of water (10-12 glasses daily), maintain hygiene.',
          TreatmentAtHome: 'Complete the antibiotic course.',
          Medicines: JSON.stringify([
            { name: 'Ciproxin', dosage: '500mg', frequency: '1+0+1', duration: '5 Days', instructions: 'After meal' },
            { name: 'Cranmax Sachet', dosage: '1 sachet', frequency: '1+0+1', duration: '10 Days', instructions: 'Dissolve in a glass of water' }
          ]),
          LabTests: JSON.stringify(['Urine R/E', 'Urine C/S'])
        },
        {
          ID: 'tmpl-hypertension',
          Name: 'Hypertension Control',
          Category: 'Chronic',
          Diagnosis: 'Essential Hypertension',
          Complaints: 'Mild headache, dizziness, recorded BP of 150/95 mmHg.',
          History: 'Family history of hypertension.',
          OnExamination: 'BP: 155/92 mmHg, pulse 78/min.',
          Precautions: 'Salt restricted diet, walk 30 minutes daily.',
          TreatmentAtHome: 'Maintain daily BP charting book.',
          Medicines: JSON.stringify([
            { name: 'Loprin', dosage: '75mg', frequency: '0+1+0', duration: 'Chronic', instructions: 'After lunch' },
            { name: 'Concor', dosage: '2.5mg', frequency: '1+0+0', duration: 'Chronic', instructions: 'Empty stomach in morning' }
          ]),
          LabTests: JSON.stringify(['Serum Creatinine', 'Lipid Profile', 'ECG'])
        }
      ];

      for (const t of templatesToSeed) {
        const query = `
          INSERT IGNORE INTO PrescriptionTemplates (ID, Name, Category, Diagnosis, Complaints, History, OnExamination, Precautions, TreatmentAtHome, Medicines, LabTests, CreatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
          t.ID,
          t.Name,
          t.Category,
          t.Diagnosis,
          t.Complaints,
          t.History,
          t.OnExamination,
          t.Precautions,
          t.TreatmentAtHome,
          t.Medicines,
          t.LabTests,
          new Date().toISOString()
        ];
        await pool.query(query, params);
      }
      console.log('✅ Seeding complete.');
    } catch (err) {
      console.error('❌ Failed to seed templates:', err.message);
    }

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
        UpdatedAt VARCHAR(50),
        LastMessage TEXT NULL,
        LastMessageAt VARCHAR(50) NULL
      )
    `);
    try { await pool.execute("ALTER TABLE ChatConversations ADD COLUMN LastMessage TEXT NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE ChatConversations ADD COLUMN LastMessageAt VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE ChatConversations ADD COLUMN IsBlocked TINYINT(1) DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE ChatConversations ADD COLUMN BlockedBy VARCHAR(50) NULL"); } catch (e) { }

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
        Machine VARCHAR(100) NULL,
        CreatedAt VARCHAR(50),
        CreatedBy VARCHAR(100) NULL,
        UpdatedAt VARCHAR(50) NULL,
        UpdatedBy VARCHAR(100) NULL
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
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN CreatedBy VARCHAR(100) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN UpdatedBy VARCHAR(100) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabTestsCatalog ADD COLUMN UpdatedAt VARCHAR(50) NULL"); } catch (e) { }


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
        CollectorName VARCHAR(255) NULL,
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
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN CollectorName VARCHAR(255) NULL"); } catch (e) { }
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

    // LabVisits table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS LabVisits (
        ID VARCHAR(50) PRIMARY KEY,
        LabPatientID VARCHAR(50) NOT NULL,
        VisitDate DATE NOT NULL,
        Status VARCHAR(50) DEFAULT 'Pending',
        SelectedTests JSON NULL,
        TotalAmount DECIMAL(10, 2) DEFAULT 0.00,
        DiscountAmount DECIMAL(10, 2) DEFAULT 0.00,
        PaidAmount DECIMAL(10, 2) DEFAULT 0.00,
        PaymentStatus VARCHAR(50) DEFAULT 'Unpaid',
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrations for LabPatients
    try { await pool.execute("ALTER TABLE LabPatients ADD COLUMN SelectedTests JSON NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabPatients ADD COLUMN CreatedBy VARCHAR(100) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabVisits ADD COLUMN CreatedBy VARCHAR(100) NULL"); } catch (e) { }

    // LabResults Priority migration
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN Priority VARCHAR(50) DEFAULT 'Normal'"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN IsDeleted INT DEFAULT 0"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN DeletedAt VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE LabResults ADD COLUMN DeletedBy VARCHAR(50) NULL"); } catch (e) { }

    // HR Upgrade Migrations
    try { await pool.execute("ALTER TABLE Employees ADD COLUMN StandardDailyHours INT DEFAULT 8"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Employees ADD COLUMN ShiftStartTime TIME DEFAULT '09:00:00'"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Employees ADD COLUMN ShiftEndTime TIME DEFAULT '17:00:00'"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN OvertimeHours DECIMAL(5, 2) DEFAULT 0.00"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN OvertimeAmount DECIMAL(10, 2) DEFAULT 0.00"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN GrossSalary DECIMAL(10, 2) DEFAULT 0.00"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Employees ADD COLUMN UserID VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Users ADD COLUMN IsActive TINYINT DEFAULT 1"); } catch (e) { }

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
          CreatedAt VARCHAR(50),
          UpdatedAt VARCHAR(50) NULL,
          DeletedAt VARCHAR(50) NULL,
          DeletedBy VARCHAR(100) NULL
      )
    `);
    try { await pool.execute("ALTER TABLE Appointments ADD COLUMN UpdatedAt VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Appointments ADD COLUMN DeletedAt VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Appointments ADD COLUMN DeletedBy VARCHAR(100) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Appointments ADD COLUMN DeletedAt VARCHAR(50) NULL"); } catch (e) { }
    try { await pool.execute("ALTER TABLE Appointments ADD COLUMN DeletedBy VARCHAR(100) NULL"); } catch (e) { }
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
    try { await pool.execute("ALTER TABLE Payroll ADD COLUMN Bonus DECIMAL(10, 2) DEFAULT 0"); } catch (e) { }
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

    // CommunicationLogs table for tracking notifications sent to patients
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS CommunicationLogs (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        ReferenceID VARCHAR(50) NOT NULL,
        Type VARCHAR(50) NOT NULL,
        Recipient VARCHAR(50) NOT NULL,
        Message TEXT NOT NULL,
        Status VARCHAR(50) NOT NULL,
        ErrorCode VARCHAR(50) NULL,
        SentBy VARCHAR(100) NULL,
        SentAt VARCHAR(50) NOT NULL
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

    // Chat Module Performance
    await createIndex('ALTER TABLE ChatMessages ADD INDEX idx_conversation (ConversationID)');
    await createIndex('ALTER TABLE ChatMessages ADD INDEX idx_sender (SenderID)');
    await createIndex('ALTER TABLE ChatConversations ADD INDEX idx_lastMessage (LastMessageAt)');

    // Seed default roles if none exist
    const [roleCount] = await pool.execute('SELECT COUNT(*) as count FROM Roles');
    if (roleCount[0].count === 0) {
      const defaultRoles = [
        { name: 'SuperAdmin', description: 'Software Owner - Full System Control', isSystem: 1 },
        { name: 'Admin', description: 'Full clinic access', isSystem: 1 },
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
        SuperAdmin: [
          'page_dashboard', 'page_super_admin', 'page_appointments', 'page_patients', 'page_fees', 'page_medicines',
          'page_pharmacy', 'page_prescriptions', 'page_lab_registration', 'page_lab_fees', 'page_lab_results',
          'page_pathology', 'page_users', 'page_expenses', 'page_settings', 'page_hr', 'page_salary_settings',
          'btn_manage_staff', 'page_clinical_forms'
        ],
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
    }
    
    // Seed SuperAdmin role if missing
    const [saRoleExists] = await pool.execute("SELECT COUNT(*) as count FROM Roles WHERE Name = 'SuperAdmin'");
    if (saRoleExists[0].count === 0) {
      await pool.execute(
        'INSERT INTO Roles (Name, Description, IsSystem) VALUES (?, ?, 1)',
        ['SuperAdmin', 'Software Owner - Full System Control']
      );
      console.log('🛡️ Super Admin role created');
    }

    // Force seed SuperAdmin permissions if none exist for this role
    const [saPermCount] = await pool.execute("SELECT COUNT(*) as count FROM RolePermissions WHERE RoleName = 'SuperAdmin'");
    if (saPermCount[0].count === 0) {
      const saPermissions = [
        'page_dashboard', 'page_super_admin', 'page_appointments', 'page_patients', 'page_fees', 'page_medicines',
        'page_pharmacy', 'page_prescriptions', 'page_lab_registration', 'page_lab_fees', 'page_lab_results',
        'page_pathology', 'page_users', 'page_expenses', 'page_settings', 'page_hr', 'page_salary_settings',
        'btn_manage_staff', 'page_clinical_forms'
      ];
      
      for (const perm of saPermissions) {
        await pool.execute(
          'INSERT IGNORE INTO RolePermissions (RoleName, Permission) VALUES (?, ?)',
          ['SuperAdmin', perm]
        );
      }
      console.log('🛡️ Super Admin permissions seeded');
    }

    // Seed default users if none exist
    const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM Users');
    if (userCount[0].count === 0) {
      const defaultUsers = [
        { id: 'USR-OWNER', username: 'owner', password: 'Owner786!@#', name: 'Software Owner', role: 'SuperAdmin' },
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
    }
    
    // Seed SuperAdmin if owner is missing (works even if other users exist)
    const [ownerRows] = await pool.execute("SELECT ID FROM Users WHERE Username = 'owner'");
    if (ownerRows.length === 0) {
      await pool.execute(
        'INSERT INTO Users (ID, Username, Password, Name, Role) VALUES (?, ?, ?, ?, ?)',
        ['USR-OWNER', 'owner', 'Owner786!@#', 'Software Owner', 'SuperAdmin']
      );
      console.log('🛡️ Super Admin (Owner) account seeded');
    }

    if (userCount[0].count === 0) {
      // (The rest of the default users seeding was already handled above if count was 0, 
      // but the logic was a bit duplicated. I'll clean it up to be safe.)
    } else {
      // Force update admin password if table already exists (as requested by user)
      try {
        await pool.execute(
          "UPDATE Users SET Password = ?, IsActive = 1 WHERE Username = 'admin'",
          ['Admin123@#']
        );
        // Also force update owner password to ensure SuperAdmin login works
        await pool.execute(
          "UPDATE Users SET Password = ?, IsActive = 1, Role = 'SuperAdmin', Permissions = '[]' WHERE Username = 'owner'",
          ['Owner786!@#']
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
        reportExpiryHours: 3,
        isChatRestricted: false,
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

    // AppSettings migration to fix welcome message banned words
    try {
      const [settingsRows] = await pool.query("SELECT Data FROM AppSettings WHERE ID = 'GLOBAL'");
      if (settingsRows.length > 0) {
        let dataStr = settingsRows[0].Data;
        let modified = false;
        
        let settingsObj = null;
        if (typeof dataStr === 'string') {
          try {
            settingsObj = JSON.parse(dataStr);
          } catch (e) {}
        } else if (typeof dataStr === 'object' && dataStr !== null) {
          settingsObj = dataStr;
        }

        if (settingsObj && settingsObj.whatsappConfig && settingsObj.whatsappConfig.welcomeMessageTemplate) {
          let template = settingsObj.whatsappConfig.welcomeMessageTemplate;
          if (template.includes('Welcome') || template.includes('confirmed')) {
            template = template
              .replace(/Welcome/g, 'Greetings')
              .replace(/welcome/g, 'greetings')
              .replace(/confirmed/g, 'completed')
              .replace(/confirm/g, 'complete');
            settingsObj.whatsappConfig.welcomeMessageTemplate = template;
            modified = true;
          }
        }

        if (modified) {
          await pool.execute("UPDATE AppSettings SET Data = ? WHERE ID = 'GLOBAL'", [JSON.stringify(settingsObj)]);
          console.log("✅ Migrated welcome template to remove banned words from AppSettings");
        }
      }
    } catch (e) {
      console.error("Failed to migrate AppSettings template:", e.message);
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

    // ============ AUTO-HEAL: Reset stuck maintenance mode on startup ============
    // If the server was restarted while maintenance mode was accidentally left ON,
    // this ensures production never starts in a locked-down state.
    try {
      const [mRows] = await pool.query("SELECT Data FROM AppSettings WHERE ID = 'GLOBAL'");
      if (mRows.length > 0) {
        const mData = typeof mRows[0].Data === 'string' ? JSON.parse(mRows[0].Data) : mRows[0].Data;
        if (mData && mData.isMaintenanceMode === true) {
          mData.isMaintenanceMode = false;
          await pool.execute("UPDATE AppSettings SET Data = ? WHERE ID = 'GLOBAL'", [JSON.stringify(mData)]);
          console.log('🔧 AUTO-HEAL: Maintenance mode was ON — automatically reset to OFF on startup.');
          apiCache.del('internal_maintenance_check');
        }
      }
    } catch (healErr) {
      console.warn('⚠️ AUTO-HEAL: Could not reset maintenance mode:', healErr.message);
    }

    dbConnected = true;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    dbConnected = false;
    // Keep server running to serve status page
  }
}

// ============ SETTINGS API ============

// Get Settings (Global or User)
app.get('/api/settings/:id', cacheMiddleware, async (req, res) => {
  try {
    const { id } = req.params; // 'GLOBAL' or UserID
    let [rows] = await pool.execute('SELECT ID, Category, Data FROM AppSettings WHERE ID = ?', [id]);

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
          reportExpiryHours: 3,
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

    // 🧹 Cache Invalidation
    apiCache.del(`/api/settings/${id}`);
    apiCache.del('internal_maintenance_check'); 

    // Real-time broadcast for global settings changes
    if (id === 'GLOBAL') {
      const io = req.app.get('io');
      if (io) io.emit('settings-updated', data);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DASHBOARD STATS API ============
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Determine target date in PKT
    const todayDateStr = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
    
    const { startUtc, endUtc } = getPktDayBounds(todayDateStr);

    // Generate last 30 days date strings in PKT format (YYYY-MM-DD)
    const trends = [];
    const baseDate = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      const displayDate = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'Asia/Karachi' });
      trends.push({
        date: dateStr,
        displayDate: displayDate,
        clinicRevenue: 0,
        labRevenue: 0,
        patients: 0
      });
    }

    const startDateStr = trends[0].date;
    const { startUtc: startUtcInterval } = getPktDayBounds(startDateStr);
    
    // We execute these in parallel for maximum performance
    const [
      [patientCount],
      [clinicPaymentSum],
      [labPaymentSum],
      [prescCount],
      [lowStockRows],
      [clinicTrendRows],
      [labTrendRows],
      [patientTrendRows],
      [stockCategoryRows]
    ] = await Promise.all([
      // Use PKT boundaries for Today's Patients
      pool.query("SELECT COUNT(*) as total FROM Patients WHERE CreatedAt BETWEEN ? AND ?", [startUtc, endUtc]),
      // Use PKT boundaries for Today's Clinic Collection
      pool.query("SELECT SUM(TotalAmount) as total FROM Payments WHERE CreatedAt BETWEEN ? AND ?", [startUtc, endUtc]),
      // Use PKT boundaries for Today's Lab Collection (using LabVisits as source of truth, excluding Refunded/Cancelled)
      pool.query("SELECT SUM(CASE WHEN PaymentStatus = 'Refunded' OR PaymentStatus = 'Cancelled' THEN 0 ELSE PaidAmount END) as total FROM LabVisits WHERE CreatedAt BETWEEN ? AND ?", [startUtc, endUtc]),
      pool.query("SELECT COUNT(*) as total FROM Prescriptions"),
      pool.query("SELECT ID, Name, Category, Quantity, LowStockThreshold FROM Stock WHERE Quantity <= LowStockThreshold AND IsDeleted = 0"),
      // 30-Day Clinic collection trend query
      pool.query(`
        SELECT 
          DATE_FORMAT(CONVERT_TZ(CAST(REPLACE(SUBSTRING(CreatedAt, 1, 19), 'T', ' ') AS DATETIME), '+00:00', '+05:00'), '%Y-%m-%d') as dateStr, 
          SUM(TotalAmount) as total 
        FROM Payments 
        WHERE CreatedAt >= ? 
        GROUP BY dateStr
      `, [startUtcInterval]),
      // 30-Day Lab collection trend query (using LabVisits as source of truth, CreatedAt is DATETIME, excluding Refunded/Cancelled)
      pool.query(`
        SELECT 
          DATE_FORMAT(CONVERT_TZ(CreatedAt, '+00:00', '+05:00'), '%Y-%m-%d') as dateStr, 
          SUM(CASE WHEN PaymentStatus = 'Refunded' OR PaymentStatus = 'Cancelled' THEN 0 ELSE PaidAmount END) as total 
        FROM LabVisits 
        WHERE CreatedAt >= ? 
        GROUP BY dateStr
      `, [startUtcInterval]),
      // 30-Day Patient visits trend query
      pool.query(`
        SELECT 
          DATE_FORMAT(CONVERT_TZ(CAST(REPLACE(SUBSTRING(CreatedAt, 1, 19), 'T', ' ') AS DATETIME), '+00:00', '+05:00'), '%Y-%m-%d') as dateStr, 
          COUNT(*) as total 
        FROM Patients 
        WHERE CreatedAt >= ? 
        GROUP BY dateStr
      `, [startUtcInterval]),
      // Stock category distribution
      pool.query(`
        SELECT Category, COUNT(*) as count 
        FROM Stock 
        WHERE IsDeleted = 0 
        GROUP BY Category
      `)
    ]);

    const clinicTotal = parseFloat(clinicPaymentSum[0].total) || 0;
    const labTotal = parseFloat(labPaymentSum[0].total) || 0;

    // Merge trend values
    const clinicTrendMap = {};
    clinicTrendRows.forEach(row => {
      clinicTrendMap[row.dateStr] = parseFloat(row.total) || 0;
    });

    const labTrendMap = {};
    labTrendRows.forEach(row => {
      labTrendMap[row.dateStr] = parseFloat(row.total) || 0;
    });

    const patientTrendMap = {};
    patientTrendRows.forEach(row => {
      patientTrendMap[row.dateStr] = Number(row.total) || 0;
    });

    trends.forEach(day => {
      day.clinicRevenue = clinicTrendMap[day.date] || 0;
      day.labRevenue = labTrendMap[day.date] || 0;
      day.patients = patientTrendMap[day.date] || 0;
    });

    res.json({
      todayPatients: Number(patientCount[0].total) || 0,
      todayCollection: clinicTotal, // Reverted to Clinic only
      clinicCollection: clinicTotal,
      labCollection: labTotal,
      totalPrescriptions: Number(prescCount[0].total) || 0,
      lowStockItems: lowStockRows,
      trends: trends,
      stockCategories: stockCategoryRows.map(row => ({
        Category: row.Category || 'Other',
        count: Number(row.count) || 0
      })),
      serverTimeUTC: new Date().toISOString(),
      pktToday: todayDateStr
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ GENERIC MEDICINES API ============

// Get all generic medicines
app.get('/api/generic-medicines', cacheMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT ID, Name, Category FROM GenericMedicines ORDER BY Name ASC');
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
    // Selective fetching: Skip heavy blobs/logs unless needed
    const columns = 'ID, MRN, CNIC, Name, GuardianName, Age, AgeMonths, AgeDays, Gender, Phone, Address, VisitDate, CreatedBy AS registeredBy, CreatedByRole AS registeredByRole, CreatedAt, UpdatedAt';
    const [rows] = await pool.query(
      `SELECT ${columns} FROM Patients ${whereClause} ORDER BY VisitDate DESC, CreatedAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    // 3. Get 24h Global Stats for summary cards
    const [stats24h] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) as newToday,
        SUM(CASE WHEN CreatedAt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) AND (UpdatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) OR VisitDate >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)) THEN 1 ELSE 0 END) as revisits,
        SUM(CASE WHEN Gender = 'Male' AND (CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) OR UpdatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) OR VisitDate >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)) THEN 1 ELSE 0 END) as males,
        SUM(CASE WHEN Gender = 'Female' AND (CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) OR UpdatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) OR VisitDate >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)) THEN 1 ELSE 0 END) as females
      FROM Patients 
      WHERE CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) 
         OR UpdatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)
         OR VisitDate >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)
    `);

    const s = stats24h[0];
    const total24h = (s.newToday || 0) + (s.revisits || 0);

    res.json({
      data: rows.map(convertRowDates),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats24h: {
          total: total24h,
          newToday: s.newToday || 0,
          revisits: s.revisits || 0,
          males: s.males || 0,
          females: s.females || 0
        }
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
    const [rows] = await pool.execute('SELECT * FROM Patients WHERE ID = ? LIMIT 1', [req.params.id]);
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

// Toggle block status of a conversation (Admin only)
app.put('/api/chat/conversations/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can block users.' });
    }

    await pool.execute(
      'UPDATE ChatConversations SET IsBlocked = ?, BlockedBy = ? WHERE ID = ?',
      [isBlocked ? 1 : 0, isBlocked ? userId : null, id]
    );

    // Notify all participants about the block status change
    const io = req.app.get('io');
    if (io) {
      io.to(`room_${id}`).emit('conversation-blocked', {
        conversationId: Number(id),
        isBlocked: !!isBlocked,
        blockedBy: isBlocked ? userId : null
      });
    }

    res.json({ success: true, isBlocked: !!isBlocked });
  } catch (error) {
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

    const columns = 'ID, Name, GuardianName, Age, AgeMonths, AgeDays, Gender, Phone, Address, CNIC, ReferringDoctorName, Priority, SelectedTests, CreatedAt, (SELECT MAX(VisitDate) FROM LabVisits WHERE LabPatientID = LabPatients.ID) as VisitDate';
    const [rows] = await pool.query(
      `SELECT ${columns} FROM LabPatients ${whereClause} ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    res.json({
      data: rows.map(convertRowDates).map(r => {
        if (r) delete r.visitDate;
        return r;
      }),
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
      'SELECT *, (SELECT MAX(VisitDate) FROM LabVisits WHERE LabPatientID = LabPatients.ID) as VisitDate FROM LabPatients WHERE ID = ? OR Phone = ? LIMIT 1',
      [query, query]
    );

    if (rows.length > 0) {
      const patient = convertRowDates(rows[0]);
      if (patient) delete patient.visitDate;
      res.json(patient);
    } else {
      res.json(null);
    }
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
    const [visits] = await pool.query(
      `SELECT *, (SELECT COALESCE(ABS(SUM(AmountPaid)), 0) FROM LabFeesLedger WHERE VisitID = LabVisits.ID AND AmountPaid < 0) as RefundedAmount FROM LabVisits WHERE LabPatientID = ? ORDER BY CreatedAt DESC`,
      [patientId]
    );

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

    const columns = 'ID, LabPatientID, PatientName, TotalAmount, DiscountAmount, PaidAmount, PaymentStatus, CreatedAt, FinalizedAt';
    const [rows] = await pool.query(`
      SELECT ${columns} FROM labpaymenthistory 
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

app.post('/api/lab-result-history/recent-tests', async (req, res) => {
  try {
    const { patientId, testNames } = req.body;
    if (!patientId || !Array.isArray(testNames) || testNames.length === 0) {
      return res.json({});
    }

    const [rows] = await pool.execute(
      'SELECT TestsWithResults, FinalizedAt, CreatedAt FROM labresulthistory WHERE LabPatientID = ? ORDER BY CreatedAt DESC',
      [patientId]
    );

    const results = {};
    for (const testName of testNames) {
      results[testName] = [];
    }

    for (const row of rows) {
      let pastTests = [];
      try {
        pastTests = typeof row.TestsWithResults === 'string' ? JSON.parse(row.TestsWithResults) : (row.TestsWithResults || []);
      } catch (e) {
        pastTests = [];
      }
      
      const dateStr = row.FinalizedAt || row.CreatedAt;
      
      for (const testName of testNames) {
        if (results[testName].length >= 3) continue;
        
        const match = pastTests.find(pt => pt.name === testName || pt.testName === testName);
        const val = match?.value || match?.resultValue;
        if (val !== undefined && val !== null && val !== '') {
          results[testName].push({
            value: String(val),
            date: dateStr
          });
        }
      }
      
      if (testNames.every(name => results[name].length >= 3)) {
        break;
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching recent tests:', error);
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

app.get('/api/stock', cacheMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM Stock WHERE IsDeleted = 0');
    const total = countResult[0].total;

    // Sort by most recently updated OR created first
    const [rows] = await pool.query(
      'SELECT ID, Name, Category, Quantity, Price, LowStockThreshold, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy, Unit FROM Stock WHERE IsDeleted = 0 ORDER BY COALESCE(UpdatedAt, CreatedAt) DESC LIMIT ? OFFSET ?',
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
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stock', async (req, res) => {
  try {
    const { id, name, category, quantity, price, lowStockThreshold, unit } = req.body;
    const createdAt = new Date().toISOString();

    const q = parseInt(quantity);
    const p = parseFloat(price);
    const lst = parseInt(lowStockThreshold);

    // Capitalize first letter of name
    const formattedName = name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Unknown Item';

    const createdBy = req.user ? `${req.user.name || req.user.username || 'Staff'} (${req.user.role || 'User'})` : 'System';

    const finalId = id || `STK-${Math.floor(Math.random() * 900000) + 100000}`;

    await pool.execute(
      'INSERT INTO Stock (ID, Name, Category, Quantity, Price, LowStockThreshold, CreatedAt, CreatedBy, Unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        finalId, 
        formattedName, 
        category || 'Other', 
        isNaN(q) ? 0 : q, 
        isNaN(p) ? 0 : p, 
        isNaN(lst) ? 10 : lst, 
        createdAt,
        createdBy,
        unit || 'units'
      ]
    );

    await pool.execute(
      'INSERT INTO StockHistory (StockID, Action, QuantityChange, Details, PerformedBy, PerformedAt, OldQuantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [finalId, 'Created', isNaN(q) ? 0 : q, `Initial stock registered (Unit: ${unit || 'Units'}).`, createdBy, createdAt, 0]
    );

    flushStockCache();
    res.json({ success: true, id: finalId });
  } catch (error) {
    console.error('Error adding stock item:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stock/:id', async (req, res) => {
  try {
    const { name, category, quantity, price, lowStockThreshold, unit } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { 
      const formattedName = name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Unknown Item';
      updates.push('Name = ?'); 
      params.push(formattedName); 
    }
    if (category !== undefined) { updates.push('Category = ?'); params.push(category || 'Other'); }
    if (quantity !== undefined) {
      const q = parseInt(quantity);
      updates.push('Quantity = ?');
      params.push(isNaN(q) ? 0 : q);
    }
    if (price !== undefined) {
      const p = parseFloat(price);
      updates.push('Price = ?');
      params.push(isNaN(p) ? 0 : p);
    }
    if (lowStockThreshold !== undefined) {
      const lst = parseInt(lowStockThreshold);
      updates.push('LowStockThreshold = ?');
      params.push(isNaN(lst) ? 10 : lst);
    }
    if (unit !== undefined) {
      updates.push('Unit = ?');
      params.push(unit || 'units');
    }

    // Audit Info
    const updatedAt = new Date().toISOString();
    const updatedBy = req.user ? `${req.user.name || req.user.username || 'Staff'} (${req.user.role || 'User'})` : 'System';
    updates.push('UpdatedAt = ?', 'UpdatedBy = ?');
    params.push(updatedAt, updatedBy);

    if (updates.length === 0) return res.json({ success: true });

    // Fetch previous state for history log
    const [existing] = await pool.query('SELECT Quantity, Unit FROM Stock WHERE ID = ?', [req.params.id]);
    const oldQuantity = existing[0] ? existing[0].Quantity : 0;
    const medicineUnit = existing[0] ? existing[0].Unit : 'Units';
    
    params.push(req.params.id);
    await pool.execute(
      `UPDATE Stock SET ${updates.join(', ')} WHERE ID = ?`,
      params
    );

    // If quantity was explicitly provided in body
    if (quantity !== undefined) {
      const q = parseInt(quantity);
      const newQuantity = isNaN(q) ? 0 : q;
      const change = newQuantity - oldQuantity;
      
      let detailsStr = `Details updated.`;
      if (change !== 0) {
        detailsStr = `Quantity ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change)} ${medicineUnit}.`;
      }

      await pool.execute(
        'INSERT INTO StockHistory (StockID, Action, QuantityChange, Details, PerformedBy, PerformedAt, OldQuantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, 'Updated', change, detailsStr, updatedBy, updatedAt, oldQuantity]
      );
    } else {
      // Just some other details changed
      await pool.execute(
        'INSERT INTO StockHistory (StockID, Action, QuantityChange, Details, PerformedBy, PerformedAt, OldQuantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, 'Updated', 0, 'Details updated.', updatedBy, updatedAt, oldQuantity]
      );
    }

    flushStockCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating stock item:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stock/:id', async (req, res) => {
  try {
    const deletedAt = new Date().toISOString();
    const deletedBy = req.user ? `${req.user.name || req.user.username || 'Staff'} (${req.user.role || 'User'})` : 'System';

    await pool.execute(
      'UPDATE Stock SET IsDeleted = 1, DeletedAt = ?, DeletedBy = ? WHERE ID = ?', 
      [deletedAt, deletedBy, req.params.id]
    );

    await pool.execute(
      'INSERT INTO StockHistory (StockID, Action, QuantityChange, Details, PerformedBy, PerformedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, 'Deleted', 0, 'Stock record deleted.', deletedBy, deletedAt]
    );

    flushStockCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting stock item:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stock/:id/history', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM StockHistory WHERE StockID = ? ORDER BY PerformedAt DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching stock history:', error);
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
    const fromDate = req.query.fromDate; 
    const toDate = req.query.toDate;     
    const search = req.query.search;
    const paymentMode = req.query.paymentMode;
    const status = req.query.status; // 'Full' or 'Short'

    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push("(p.PatientName LIKE ? OR p.PatientID LIKE ? OR p.ID LIKE ? OR pat.Phone LIKE ? OR pat.MRN LIKE ?)");
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    } else {
      // Standard filters only apply if NOT searching
      if (fromDate && toDate) {
        const { startUtc } = getPktDayBounds(fromDate);
        const { endUtc } = getPktDayBounds(toDate);
        whereConditions.push("p.CreatedAt BETWEEN ? AND ?");
        params.push(startUtc, endUtc);
      } else if (fromDate) {
        const { startUtc } = getPktDayBounds(fromDate);
        whereConditions.push("p.CreatedAt >= ?");
        params.push(startUtc);
      } else if (toDate) {
        const { endUtc } = getPktDayBounds(toDate);
        whereConditions.push("p.CreatedAt <= ?");
        params.push(endUtc);
      } else if (recent24h) {
        whereConditions.push('p.CreatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)');
      }

      if (paymentMode && paymentMode !== 'All') {
        whereConditions.push("p.PaymentMode = ?");
        params.push(paymentMode);
      }

      if (status === 'Short') {
        whereConditions.push("p.TotalAmount < (p.ConsultationFee + p.LabFee + p.MedicineFee)");
      } else if (status === 'Full') {
        whereConditions.push("p.TotalAmount >= (p.ConsultationFee + p.LabFee + p.MedicineFee)");
      }

      const serviceType = req.query.serviceType;
      if (serviceType && serviceType !== 'All') {
        if (serviceType === 'Consultation') {
          whereConditions.push("p.ConsultationFee > 0");
        } else if (serviceType === 'Lab') {
          whereConditions.push("p.LabFee > 0");
        } else if (serviceType === 'Pharmacy') {
          whereConditions.push("p.MedicineFee > 0");
        }
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 1. Get total count and sum of collections
    const summaryParams = [...params];
    const [summaryResult] = await pool.query(`
      SELECT COUNT(*) as total, 
             SUM(p.TotalAmount) as totalCollection, 
             SUM(p.LabFee) as totalLabFee, 
             SUM(p.ConsultationFee) as totalConsultationFee 
      FROM Payments p
      LEFT JOIN Patients pat ON p.PatientID = pat.ID
      ${whereClause}
    `, summaryParams);

    const total = summaryResult[0].total;
    const totalCollection = summaryResult[0].totalCollection || 0;
    const totalLabFee = summaryResult[0].totalLabFee || 0;
    const totalConsultationFee = summaryResult[0].totalConsultationFee || 0;

    // 2. Get paginated data
    const columns = 'p.ID, p.PatientID, p.PatientName, p.ConsultationFee, p.LabFee, p.MedicineFee, p.TotalAmount, p.PaymentMode, p.CreatedAt, p.LabPatientID, p.Items, p.Medicines';
    const [rows] = await pool.query(
      `SELECT ${columns}, 
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
    const columns = 'ID, PatientID, PatientName, PatientAge, PatientAgeMonths, PatientAgeDays, Diagnosis, CtgUsgReport, Complaints, History, OnExamination, TreatmentInHospital, TreatmentAtHome, Medicines, LabTests, DoctorNotes, Precautions, GeneratedText, FollowUpDate, Status, CreatedAt, FinalizedAt, LastUpdatedAt, IsLocked';
    const [prescriptions] = await pool.query(
      `SELECT ${columns} FROM Prescriptions ${whereClause} ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
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


// ============ PRESCRIPTION TEMPLATES API ============

// Get all templates
app.get('/api/prescription-templates', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM PrescriptionTemplates ORDER BY CreatedAt DESC');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error fetching prescription templates:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create/Update template
app.post('/api/prescription-templates', async (req, res) => {
  try {
    const id = req.body.ID || req.body.id;
    const name = req.body.Name || req.body.name;
    const category = req.body.Category || req.body.category;
    const diagnosis = req.body.Diagnosis || req.body.diagnosis;
    const complaints = req.body.Complaints || req.body.complaints;
    const history = req.body.History || req.body.history;
    const onExamination = req.body.OnExamination || req.body.onExamination;
    const precautions = req.body.Precautions || req.body.precautions;
    const treatmentAtHome = req.body.TreatmentAtHome || req.body.treatmentAtHome;
    const medicines = req.body.Medicines || req.body.medicines;
    const labTests = req.body.LabTests || req.body.labTests;
    const createdBy = req.body.CreatedBy || req.body.createdBy || null;

    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const templateId = id || `tmpl-custom-${Date.now()}`;
    const createdAt = new Date().toISOString();

    // Check if exists
    const [existing] = await pool.query('SELECT ID FROM PrescriptionTemplates WHERE ID = ?', [templateId]);

    if (existing.length > 0) {
      // Update template
      const query = `
        UPDATE PrescriptionTemplates
        SET Name = ?, Category = ?, Diagnosis = ?, Complaints = ?, History = ?, OnExamination = ?, Precautions = ?, TreatmentAtHome = ?, Medicines = ?, LabTests = ?
        WHERE ID = ?
      `;
      const params = [
        name,
        category || 'General',
        diagnosis || '',
        complaints || '',
        history || '',
        onExamination || '',
        precautions || '',
        treatmentAtHome || '',
        JSON.stringify(medicines || []),
        JSON.stringify(labTests || []),
        templateId
      ];
      await pool.query(query, params);
    } else {
      // Insert template
      const query = `
        INSERT INTO PrescriptionTemplates (ID, Name, Category, Diagnosis, Complaints, History, OnExamination, Precautions, TreatmentAtHome, Medicines, LabTests, CreatedBy, CreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        templateId,
        name,
        category || 'General',
        diagnosis || '',
        complaints || '',
        history || '',
        onExamination || '',
        precautions || '',
        treatmentAtHome || '',
        JSON.stringify(medicines || []),
        JSON.stringify(labTests || []),
        createdBy,
        createdAt
      ];
      await pool.query(query, params);
    }

    console.log('✅ Prescription template saved successfully:', templateId);
    res.json({ success: true, id: templateId });
  } catch (error) {
    console.error('❌ Error saving prescription template:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete template
app.delete('/api/prescription-templates/:id', async (req, res) => {
  try {
    const templateId = req.params.id;
    await pool.query('DELETE FROM PrescriptionTemplates WHERE ID = ?', [templateId]);
    console.log('✅ Prescription template deleted successfully:', templateId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting prescription template:', error.message);
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
    const columns = 'ID, MedicineName, Category, Dosage, Frequency, Duration';
    const [rows] = await pool.query(
      `SELECT ${columns} FROM PrescriptionMedicines WHERE PrescriptionID IS NULL ORDER BY MedicineName ASC LIMIT ? OFFSET ?`,
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
    const { labPatientId, status, fromDate, toDate, dateRange } = req.query;

    let whereClause = 'WHERE (IsDeleted = 0 OR IsDeleted IS NULL)';
    let params = [];

    const getPktDayBounds = (dateStr) => {
      const startPkt = new Date(`${dateStr}T00:00:00+05:00`);
      const endPkt = new Date(`${dateStr}T23:59:59.999+05:00`);
      return { startUtc: startPkt.toISOString(), endUtc: endPkt.toISOString() };
    };

    const getPktRanges = (rangeOpt) => {
      const now = new Date();
      const pktNow = new Date(now.getTime() + (5 * 60 * 60 * 1000));
      const pad = (n) => String(n).padStart(2, '0');
      const pktTodayStr = `${pktNow.getUTCFullYear()}-${pad(pktNow.getUTCMonth() + 1)}-${pad(pktNow.getUTCDate())}`;

      let startUtc, endUtc;

      if (rangeOpt === 'today') {
        startUtc = new Date(`${pktTodayStr}T00:00:00+05:00`).toISOString();
        endUtc = new Date(`${pktTodayStr}T23:59:59.999+05:00`).toISOString();
      } else if (rangeOpt === 'last24h') {
        startUtc = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        endUtc = now.toISOString();
      } else if (rangeOpt === '7days') {
        const d = new Date(pktNow.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        startUtc = new Date(`${dateStr}T00:00:00+05:00`).toISOString();
        endUtc = new Date(`${pktTodayStr}T23:59:59.999+05:00`).toISOString();
      } else if (rangeOpt === '30days') {
        const d = new Date(pktNow.getTime() - 30 * 24 * 60 * 60 * 1000);
        const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        startUtc = new Date(`${dateStr}T00:00:00+05:00`).toISOString();
        endUtc = new Date(`${pktTodayStr}T23:59:59.999+05:00`).toISOString();
      } else if (rangeOpt === 'month') {
        const startOfMonthStr = `${pktNow.getUTCFullYear()}-${pad(pktNow.getUTCMonth() + 1)}-01`;
        startUtc = new Date(`${startOfMonthStr}T00:00:00+05:00`).toISOString();
        endUtc = new Date(`${pktTodayStr}T23:59:59.999+05:00`).toISOString();
      }

      return { startUtc, endUtc };
    };

    if (labPatientId) {
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'LabPatientID = ?';
      params.push(labPatientId);
    }

    if (status) {
      const statusList = status.split(',');
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'Status IN (' + statusList.map(() => '?').join(',') + ')';
      params.push(...statusList);
    }

    let startUtc, endUtc;
    if (dateRange && dateRange !== 'custom') {
      const ranges = getPktRanges(dateRange);
      startUtc = ranges.startUtc;
      endUtc = ranges.endUtc;
    } else {
      if (fromDate) startUtc = getPktDayBounds(fromDate).startUtc;
      if (toDate) endUtc = getPktDayBounds(toDate).endUtc;
    }

    if (startUtc && endUtc) {
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt BETWEEN ? AND ?';
      params.push(startUtc, endUtc);
    } else if (startUtc) {
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'CreatedAt >= ?';
      params.push(startUtc);
    } else if (endUtc) {
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

    // Fetch payment status for the retrieved lab results in batch
    const patientIds = rows.map(r => r.LabPatientID).filter(Boolean);
    const paymentStatuses = {};
    if (patientIds.length > 0) {
      const [visitRows] = await pool.query(
        `SELECT LabPatientID, PaymentStatus FROM LabVisits WHERE LabPatientID IN (${patientIds.map(() => '?').join(',')})`,
        patientIds
      );
      visitRows.forEach(v => {
        paymentStatuses[v.LabPatientID] = v.PaymentStatus;
      });
    }

    const data = rows.map(r => {
      const row = convertRowDates(r);
      const statusVal = paymentStatuses[r.LabPatientID] || 'Paid';
      row.PaymentStatus = statusVal;
      row.paymentStatus = statusVal;
      return row;
    });

    res.json({
      data,
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
    const { id, labPatientId, patientName, patientAge, testDate, reportDate, tests, notes, technician, status, referredBy, patientId, collectorName } = req.body;
    const createdAt = new Date().toISOString();

    // Use labPatientId if present, otherwise fallback to patientId (which is what clinic calls it)
    const finalPatientId = labPatientId || patientId || null;

    await pool.execute(
      'INSERT INTO LabResults (ID, LabPatientID, PatientName, PatientAge, TestDate, ReportDate, Tests, Notes, Technician, Status, ReferredBy, CreatedAt, CollectorName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, finalPatientId, patientName, patientAge || null, testDate, reportDate || null, JSON.stringify(tests), notes || null, technician || null, status || 'Pending', referredBy || 'Self', createdAt, collectorName || null]
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
    const { testDate, reportDate, tests, notes, technician, status, labPatientId, collectorName } = req.body;

    await pool.execute(
      'UPDATE LabResults SET TestDate = ?, ReportDate = ?, Tests = ?, Notes = ?, Technician = ?, Status = ?, LabPatientID = ?, CollectorName = ? WHERE ID = ?',
      [testDate, reportDate || null, JSON.stringify(tests), notes || null, technician || null, status, labPatientId || null, collectorName || null, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lab-results/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const deletedAt = new Date().toISOString();
    const deletedBy = req.query.deletedBy || 'System';

    // 1. Fetch the lab result first
    const [results] = await connection.query('SELECT * FROM LabResults WHERE ID = ?', [req.params.id]);
    if (results.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Lab Result not found' });
    }
    const labResult = results[0];

    // 2. Soft-delete the lab result
    await connection.execute(
      'UPDATE LabResults SET IsDeleted = 1, DeletedAt = ?, DeletedBy = ? WHERE ID = ?',
      [deletedAt, deletedBy, req.params.id]
    );

    // 3. Find the associated LabVisit (latest visit for this lab patient)
    const [visits] = await connection.query(
      'SELECT * FROM LabVisits WHERE LabPatientID = ? ORDER BY CreatedAt DESC LIMIT 1',
      [labResult.LabPatientID]
    );

    if (visits.length > 0) {
      const visit = visits[0];
      const paidAmount = Number(visit.PaidAmount || 0);

      // If patient paid any amount, we perform a refund
      if (paidAmount > 0) {
        // Create refund ledger entry
        const paymentId = `LPMT-REF-${Date.now().toString(36).toUpperCase()}`;
        const refundNotes = `Refunded due to discarded lab order (ID: ${req.params.id}) by ${deletedBy}`;
        
        await connection.query(
          'INSERT INTO LabFeesLedger (ID, LabPatientID, VisitID, AmountPaid, PaymentMethod, Notes, PaymentDate) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [paymentId, labResult.LabPatientID, visit.ID, -paidAmount, 'Refund', refundNotes, new Date().toISOString()]
        );

        // Update the visit amounts and status (keep PaidAmount, TotalAmount, and DiscountAmount)
        await connection.query(
          'UPDATE LabVisits SET PaymentStatus = "Refunded" WHERE ID = ?',
          [visit.ID]
        );
      } else {
        // If unpaid, just set status to Cancelled and keep amounts
        await connection.query(
          'UPDATE LabVisits SET PaidAmount = 0, PaymentStatus = "Cancelled" WHERE ID = ?',
          [visit.ID]
        );
      }
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Error soft-deleting lab result & refunding:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ============ LAB TESTS CATALOG API (Master List) ============

app.get('/api/lab-tests-catalog', cacheMiddleware, async (req, res) => {
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

    const createdBy = req.user ? `${req.user.name || req.user.username || 'Staff'} (${req.user.role || 'User'})` : 'System';
    const createdAt = new Date().toISOString();

    await pool.execute(
      `INSERT INTO LabTestsCatalog (
        ID, Name, Category, Unit, NormalRange, Price,
        ReferenceRangeMale, ReferenceRangeFemale, ReferenceRangeChild,
        CriticalValueRange, SampleType, Method, TurnaroundTime,
        Status, IsProfile, ProfileTests, Machine, CreatedAt, CreatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, name, category, unit, normalRange, price || 0,
        referenceRangeMale || null, referenceRangeFemale || null, referenceRangeChild || null,
        criticalValueRange || null, sampleType || null, method || null, turnaroundTime || null,
        status || 'Active', isProfile ? 1 : 0, profileTests ? JSON.stringify(profileTests) : null,
        machine || null, createdAt, createdBy
      ]
    );
    flushCatalogCache();
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

    const updatedBy = req.user ? `${req.user.name || req.user.username || 'Staff'} (${req.user.role || 'User'})` : 'System';
    const updatedAt = new Date().toISOString();

    await pool.execute(
      `UPDATE LabTestsCatalog SET 
        Name = ?, Category = ?, Unit = ?, NormalRange = ?, Price = ?,
        ReferenceRangeMale = ?, ReferenceRangeFemale = ?, ReferenceRangeChild = ?,
        CriticalValueRange = ?, SampleType = ?, Method = ?, TurnaroundTime = ?,
        Status = ?, IsProfile = ?, ProfileTests = ?, Machine = ?,
        UpdatedAt = ?, UpdatedBy = ?
       WHERE ID = ?`,
      [
        name, category, unit, normalRange, price || 0,
        referenceRangeMale || null, referenceRangeFemale || null, referenceRangeChild || null,
        criticalValueRange || null, sampleType || null, method || null, turnaroundTime || null,
        status || 'Active', isProfile ? 1 : 0, profileTests ? JSON.stringify(profileTests) : null,
        machine || null, updatedAt, updatedBy,
        req.params.id
      ]
    );
    flushCatalogCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lab-tests-catalog/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM LabTestsCatalog WHERE ID = ?', [req.params.id]);
    flushCatalogCache();
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
    const columns = 'ID, PatientID, Services, GrandTotal, Status, CreatedAt, UpdatedAt';
    const [rows] = await pool.query(
      `SELECT ${columns} FROM PatientServices ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
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

    // 3. Update Stock if Pharmacy services are used
    if (services && services.pharmacy && services.pharmacy.enabled && Array.isArray(services.pharmacy.medicines)) {
      for (const med of services.pharmacy.medicines) {
        if (med.stockId && med.quantity > 0) {
          console.log(`[STOCK] Reducing stock for ID: ${med.stockId} by quantity: ${med.quantity}`);
          // Using GREATEST(0, ...) ensures stock doesn't go negative
          await pool.execute(
            'UPDATE Stock SET Quantity = GREATEST(0, Quantity - ?) WHERE ID = ?',
            [med.quantity, med.stockId]
          );
        }
      }
    }

    flushPatientCache();
    flushStockCache();
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
      const { id, labPatientId, visitDate, status = 'Pending', selectedTests, totalAmount = 0, createdBy } = req.body;
      await pool.query(
        'INSERT INTO LabVisits (ID, LabPatientID, VisitDate, Status, SelectedTests, TotalAmount, CreatedAt, CreatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, labPatientId, visitDate, status, JSON.stringify(selectedTests || []), totalAmount, new Date().toISOString(), createdBy || null]
      );
      res.status(201).json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/lab-visits', async (req, res) => {
    try {
      const { labPatientId, search, recent24h, fromDate, toDate, status } = req.query;

      let whereConditions = [];
      let queryParams = [];

      if (labPatientId) {
        whereConditions.push('v.LabPatientID = ?');
        queryParams.push(labPatientId);
      }

      if (status) {
        if (status === 'Fully Paid') {
          whereConditions.push('v.PaymentStatus = ?');
          queryParams.push('Paid');
        } else if (status === 'Total Discount') {
          whereConditions.push('v.DiscountAmount > 0');
        }
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
          `SELECT v.*, (SELECT COALESCE(ABS(SUM(AmountPaid)), 0) FROM LabFeesLedger WHERE VisitID = v.ID AND AmountPaid < 0) as RefundedAmount, p.Name as PatientName, p.GuardianName, p.Age, p.Gender, p.Phone FROM LabVisits v JOIN LabPatients p ON v.LabPatientID = p.ID ${whereClause} ORDER BY v.CreatedAt DESC`,
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
      const columns = 'v.ID, v.LabPatientID, v.VisitDate, v.Status, v.TotalAmount, v.DiscountAmount, v.PaidAmount, v.PaymentStatus, v.CreatedAt, v.SelectedTests, v.CreatedBy, (SELECT COALESCE(ABS(SUM(AmountPaid)), 0) FROM LabFeesLedger WHERE VisitID = v.ID AND AmountPaid < 0) as RefundedAmount';
      const dataQuery = `
      SELECT ${columns}, p.Name as PatientName, p.GuardianName, p.Age, p.Gender, p.Phone 
      FROM LabVisits v 
      JOIN LabPatients p ON v.LabPatientID = p.ID
      ${whereClause}
      ORDER BY v.CreatedAt DESC LIMIT ? OFFSET ?
    `;
      const [rows] = await pool.query(dataQuery, [...queryParams, limit, offset]);

      // 3. Calculate summary stats (totalCollection, totalDiscount, totalTests) using the SAME whereClause
      const statsQuery = `
      SELECT 
        SUM(CASE WHEN v.PaymentStatus = 'Refunded' OR v.PaymentStatus = 'Cancelled' THEN 0 ELSE v.PaidAmount END) as totalCollection, 
        SUM(CASE WHEN v.PaymentStatus = 'Refunded' OR v.PaymentStatus = 'Cancelled' THEN 0 ELSE v.DiscountAmount END) as totalDiscount,
        SUM(CASE 
          WHEN v.SelectedTests IS NULL OR v.SelectedTests = '' THEN 0 
          WHEN JSON_VALID(v.SelectedTests) THEN JSON_LENGTH(v.SelectedTests)
          ELSE 0 
        END) as totalTests,
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
          totalTests: statsResult[0].totalTests || 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/lab-visits/:id', async (req, res) => {
    try {
      const { status, selectedTests, totalAmount, discountAmount, paidAmount, paymentStatus } = req.body;
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
    { key: 'page_super_admin', label: 'Super Admin Dashboard', group: 'Pages' },
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

      let rolesWithPerms = roles.map(role => ({
        id: role.ID,
        name: role.Name,
        description: role.Description,
        isSystem: role.IsSystem === 1,
        createdAt: role.CreatedAt,
        permissions: rolePerms.filter(rp => rp.RoleName === role.Name).map(rp => rp.Permission),
      }));

      // STEALTH: Filter out SuperAdmin role if requester is not a SuperAdmin
      if (!req.user || req.user.role !== 'SuperAdmin') {
        rolesWithPerms = rolesWithPerms.filter(r => r.name !== 'SuperAdmin');
      }

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
      
      let users = rows;
      // STEALTH: Filter out SuperAdmin users if requester is not a SuperAdmin
      if (!req.user || req.user.role !== 'SuperAdmin') {
        users = users.filter(u => u.Role !== 'SuperAdmin');
      }
      
      res.json(users.map(convertRowDates));
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
      
      // STEALTH: Prevent non-SuperAdmins from creating SuperAdmin accounts
      if (role === 'SuperAdmin' && (!req.user || req.user.role !== 'SuperAdmin')) {
        return res.status(403).json({ error: 'You do not have permission to create a Super Admin account.' });
      }

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

      // STEALTH: Prevent non-SuperAdmins from assigning SuperAdmin role
      if (role === 'SuperAdmin' && (!req.user || req.user.role !== 'SuperAdmin')) {
        return res.status(403).json({ error: 'You do not have permission to assign the Super Admin role.' });
      }

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
        'SELECT ID, Username, Name, Email, Phone, Role, Permissions, IsActive FROM Users WHERE Username = ? AND Password = ?',
        [username, password]
      );

      if (rows.length > 0) {
        const user = rows[0];

        // 🛡️ DEACTIVATED USER CHECK
        if (!user.IsActive) {
          return res.status(403).json({ error: 'USER IS deactivated please contact system admin' });
        }

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
          { id: user.ID, username: user.Username, name: user.Name, role: user.Role },
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
      // Selective fetching for list view
      const columns = 'ID, Date, Category, Description, Amount, CreatedBy, CreatedAt';
      let query = `SELECT ${columns} FROM DailyExpenses ${whereClause} ORDER BY Date DESC, CreatedAt DESC`;
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
          totalPages: limit === -1 ? 1 : Math.max(1, Math.ceil(total / limit)),
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

      flushExpenseCache();
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
      flushExpenseCache();
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
  app.get('/api/employees', cacheMiddleware, async (req, res) => {
    try {
      const columns = 'ID, UserID, Name, Designation, Phone, JoiningDate, BasicSalary, StandardDailyHours, ShiftStartTime, ShiftEndTime, Status, CreatedAt';
      const [rows] = await pool.query(`SELECT ${columns} FROM Employees ORDER BY CreatedAt DESC`);
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

      const columns = 'ID, EmployeeID, Date, Status, CheckIn, CheckOut, Notes';
      const [rows] = await pool.query(`SELECT ${columns} FROM Attendance ${whereClause} ORDER BY Date DESC`, params);
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
      const columns = 'ID, EmployeeID, StartDate, EndDate, Reason, Status, CreatedAt';
      const [rows] = await pool.query(`SELECT ${columns} FROM LeaveRequests ${whereClause} ORDER BY CreatedAt DESC`, params);
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
      const columns = 'ID, EmployeeID, Date, Amount, Description, Status, ApprovedBy, ApprovalTime';
      const [rows] = await pool.query(`SELECT ${columns} FROM AdvancePayments ${whereClause} ORDER BY Date DESC`, params);
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
      const columns = 'ID, EmployeeID, Month, Year, BasicSalary, Bonus, Deductions, OvertimeHours, OvertimeAmount, GrossSalary, NetSalary, PaymentStatus, PaymentDate, CreatedAt';
      const [rows] = await pool.query(`SELECT ${columns} FROM Payroll ${whereClause} ORDER BY CreatedAt DESC`, params);
      res.json(rows.map(convertRowDates));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Salary Config endpoints
  app.get('/api/hr/salary-config', cacheMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.execute("SELECT ID, Category, Data FROM AppSettings WHERE ID = 'SALARY_CONFIG'");
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

  app.get('/debug-paths', (req, res) => {
    res.json({
      serverDirectory: __dirname,
      checkedPaths: possiblePaths,
      finalSelectedPath: publicHtmlDistPath,
      finalIndexPath: publicHtmlIndexPath,
      fileExists: fs.existsSync(publicHtmlIndexPath),
      frontendEnv: process.env.FRONTEND_PATH || 'Not Set'
    });
  });

  // ============ SERVE REACT FRONTEND ============
  // This hybrid logic ensures the frontend works regardless of whether backend is 
  // in the same folder as the build, or in a sibling nodejs/public_html structure.
  const possiblePaths = [
    process.env.FRONTEND_PATH || '',
    "/home/u345939801/public_html",
    "/home/u345939801/domains/staging.salamaatclinic.com/public_html",
    "/home/u345939801/domains/staging.salamaatclinic.com/public_html/dist",
    path.resolve(__dirname, "..", "public_html"),
    "/home/u345939801/public_html/dist",
    path.resolve(__dirname, "..", "public_html", "dist"),
    path.resolve(__dirname, "public_html"),
    path.resolve(__dirname, "dist"),
    path.resolve(__dirname, ".")
  ].filter(Boolean);

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
      const { date, status, search, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let whereClause = 'WHERE DeletedAt IS NULL';
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

      // 1. Get Total Count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM Appointments ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // 2. Get Paginated Data
      const columns = 'ID, PatientID, PatientName, Phone, ApptDate, ApptTime, Service, Status, Notes, TokenNumber, CreatedBy, CreatedAt';
      const [rows] = await pool.query(
        `SELECT ${columns} FROM Appointments ${whereClause} ORDER BY TokenNumber DESC, ApptTime DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      );

      res.json({
        data: rows.map(convertRowDates),
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const resequenceTokens = async (date) => {
    try {
      const [rows] = await pool.query(
        "SELECT ID FROM Appointments WHERE ApptDate = ? AND DeletedAt IS NULL ORDER BY ApptTime ASC, CreatedAt ASC",
        [date]
      );
      for (let i = 0; i < rows.length; i++) {
        await pool.execute(
          "UPDATE Appointments SET TokenNumber = ? WHERE ID = ?",
          [i + 1, rows[i].ID]
        );
      }
    } catch (error) {
      console.error('Error resequencing tokens:', error);
    }
  };

  // POST /api/appointments — book a new appointment (auto-assigns daily token)
  app.post('/api/appointments', async (req, res) => {
    try {
      const { id, patientId, name, phone, date, time, service, notes, createdBy } = req.body;

      if (!name || !phone || !date || !time) {
        return res.status(400).json({ error: 'Name, phone, date and time are required.' });
      }

      const finalTime = time;

      const apptId = id || `APPT-${Date.now().toString(36).toUpperCase()}`;

      // Insert with temporary token 0, then resequence
      const createdAt = new Date().toISOString();
      await pool.execute(
        `INSERT INTO Appointments (ID, PatientID, PatientName, Phone, ApptDate, ApptTime, Service, Status, Notes, TokenNumber, CreatedBy, CreatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, 0, ?, ?)`,
        [apptId, (patientId && patientId !== '') ? patientId : null, name, phone, date, finalTime, service || 'Consultation', notes || null, createdBy || null, createdAt]
      );

      // Re-sequence tokens chronologically by time for this day
      await resequenceTokens(date);

      // Fetch the newly assigned token number for response
      const [finalAppt] = await pool.query("SELECT TokenNumber FROM Appointments WHERE ID = ?", [apptId]);
      const tokenNumber = finalAppt[0]?.TokenNumber || 0;

      // ⚡ Flush Appointment Cache
      flushAppointmentCache();

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
      
      // Always update UpdatedAt
      updates.push('UpdatedAt = ?');
      params.push(new Date().toISOString());

      if (updates.length === 0) {
        return res.json({ success: true });
      }

      params.push(id);
      await pool.query(`UPDATE Appointments SET ${updates.join(', ')} WHERE ID = ?`, params);

      // If date or time changed, re-sequence the tokens
      if (ApptDate || ApptTime) {
        // Find the date of this appointment to re-sequence (use provided ApptDate or fetch current if needed)
        // For simplicity, if ApptDate was provided, use it. Otherwise we'd need to fetch.
        // Usually ApptTime changes within the same day.
        const [currentAppt] = await pool.query("SELECT ApptDate FROM Appointments WHERE ID = ?", [id]);
        if (currentAppt.length > 0) {
          await resequenceTokens(currentAppt[0].ApptDate);
        }
      }

      // ⚡ Flush Appointment Cache
      flushAppointmentCache();

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating appointment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/appointments/:id — Soft Delete
  app.delete('/api/appointments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deletedBy = req.user?.username || 'Unknown';
      const deleteTime = new Date().toISOString();
      
      // Get the date first so we can re-sequence after deletion
      const [appt] = await pool.query("SELECT ApptDate FROM Appointments WHERE ID = ? AND DeletedAt IS NULL", [id]);
      const apptDate = appt.length > 0 ? appt[0].ApptDate : null;

      if (!apptDate) {
        return res.status(404).json({ error: 'Appointment not found or already deleted.' });
      }

      // Soft delete by updating DeletedAt and DeletedBy
      await pool.execute(
        'UPDATE Appointments SET DeletedAt = ?, DeletedBy = ?, TokenNumber = 0 WHERE ID = ?', 
        [deleteTime, deletedBy, id]
      );
      
      // Re-sequence tokens for the day to fill the gap
      await resequenceTokens(apptDate);

      // ⚡ Flush Appointment Cache
      flushAppointmentCache();

      res.json({ success: true, message: 'Appointment soft-deleted successfully.' });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ WHATSAPP API ============
  app.post('/api/whatsappsms', async (req, res) => {
    try {
      const { to, message, filename, document } = req.body;

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
      let response;
      if (document) {
        // Send document (PDF/etc) via UltraMsg messages/document endpoint
        response = await axios.post(`https://api.ultramsg.com/${waConfig.instanceId}/messages/document`, {
          token: waConfig.token,
          to: `+${toPhone}`,
          filename: filename || 'report.pdf',
          document: document, // base64 string or public URL
          caption: message || ''
        }, { timeout: 20000 });
      } else {
        // Send standard chat message
        response = await axios.post(`https://api.ultramsg.com/${waConfig.instanceId}/messages/chat`, {
          token: waConfig.token,
          to: `+${toPhone}`,
          body: message
        }, { timeout: 10000 });
      }

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('WhatsApp sending error:', error?.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error?.response?.data?.message || error.message 
      });
    }
  });

  // ============ SMS API ============
  app.post('/api/smsapi', async (req, res) => {
    try {
      const { to, message } = req.body;
      const cleanMessage = (message || '')
        .replace(/welcome/gi, 'Greetings')
        .replace(/confirmed/gi, 'completed')
        .replace(/confirm/gi, 'complete');

      // Get GLOBAL settings to extract SMS credentials
      const [settings] = await pool.query("SELECT Data FROM AppSettings WHERE ID = 'GLOBAL'");
      if (settings.length === 0) return res.status(400).json({ error: 'Global settings not found.' });

      let configStr = settings[0].Data;
      if (typeof configStr === 'string') configStr = JSON.parse(configStr);

      const smsConfig = configStr.smsConfig;
      if (!smsConfig || !smsConfig.enabled) {
        return res.status(400).json({ error: 'SMS integration is currently disabled in Settings.' });
      }

      // Format phone number to string (remove symbols, ensure leading 92)
      let toPhone = (to || '').replace(/\D/g, '');
      if (toPhone.startsWith('0')) {
        toPhone = '92' + toPhone.substring(1);
      }

      // Execute request to Branded SMS Pakistan
      const axios = require('axios');
      const qs = require('qs');
      
      let targetUrl = smsConfig.providerUrlTemplate || 'https://app.brandedsmspakistan.com/api/send';
      
      // Normalize root domain to the correct API endpoint
      if (targetUrl.trim() === 'https://app.brandedsmspakistan.com/' || targetUrl.trim() === 'https://app.brandedsmspakistan.com') {
        targetUrl = 'https://app.brandedsmspakistan.com/api/send';
      }

      let response;
      if (targetUrl.includes('brandedsmspakistan.com')) {
        // Branded SMS Pakistan API expects a GET request for sending messages
        const emailParam = (smsConfig.email || '').trim();
        const keyParam = (smsConfig.key || '').trim();
        const maskParam = (smsConfig.mask || 'INFO SHARE').trim();

        console.log(`[SMS] Sending GET request to Branded SMS Pakistan. Email: "${emailParam}", Mask: "${maskParam}", To: "${toPhone}"`);

        response = await axios.get(targetUrl, {
          params: {
            email: emailParam,
            key: keyParam,
            mask: maskParam,
            to: toPhone,
            message: cleanMessage
          },
          timeout: 15000
        });
      } else {
        // Other SMS gateways or endpoints that support POST
        const emailParam = (smsConfig.email || '').trim();
        const keyParam = (smsConfig.key || '').trim();
        const maskParam = (smsConfig.mask || 'INFO SHARE').trim();

        console.log(`[SMS] Sending POST request to ${targetUrl}. Email: "${emailParam}", Mask: "${maskParam}", To: "${toPhone}"`);

        const payload = qs.stringify({
          email: emailParam,
          key: keyParam,
          mask: maskParam,
          to: toPhone,
          message: cleanMessage
        });
        
        response = await axios.post(targetUrl, payload, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 15000
        });
      }

      // Map gateway response codes to user-friendly messages
      let responseData = response.data;
      if (responseData && responseData.sms) {
        if (responseData.sms.code === '101' || responseData.sms.code === 101) {
          responseData.sms.response = 'Phone Number Is Invalid Cannot Send the Msg';
        }
      }

      res.json({ success: true, data: responseData });
    } catch (error) {
      console.error('SMS sending error:', error?.response?.data || error.message);
      res.status(500).json({ error: 'Failed to send SMS message.' });
    }
  });

  // ============ COMMUNICATION LOGS API ============
  app.post('/api/communication-logs', async (req, res) => {
    try {
      const { ReferenceID, Type, Recipient, Message, Status, ErrorCode, SentBy } = req.body;
      const referenceId = ReferenceID || req.body.referenceId;
      const type = Type || req.body.type;
      const recipient = Recipient || req.body.recipient;
      const message = Message || req.body.message;
      const status = Status || req.body.status;
      const errorCode = ErrorCode !== undefined ? ErrorCode : req.body.errorCode;
      const sentBy = SentBy || req.body.sentBy;

      if (!referenceId || !type || !recipient || !message || !status) {
        return res.status(400).json({ error: 'Missing required communication log fields.' });
      }
      const sentAt = new Date().toISOString();
      await pool.execute(
        `INSERT INTO CommunicationLogs (ReferenceID, Type, Recipient, Message, Status, ErrorCode, SentBy, SentAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [referenceId, type, recipient, message, status, errorCode || null, sentBy || 'System', sentAt]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to create communication log:', error);
      res.status(500).json({ error: 'Failed to create communication log.' });
    }
  });

  app.get('/api/communication-logs/:referenceId', async (req, res) => {
    try {
      const { referenceId } = req.params;
      const [rows] = await pool.query(
        'SELECT * FROM CommunicationLogs WHERE ReferenceID = ? ORDER BY SentAt DESC',
        [referenceId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Failed to fetch communication logs:', error);
      res.status(500).json({ error: 'Failed to fetch communication logs.' });
    }
  });

  // ============ PDF REPORT UPLOAD ============
  app.post('/api/reports/upload/:visitId', express.raw({ type: 'application/pdf', limit: '10mb' }), async (req, res) => {
    try {
      const { visitId } = req.params;
      
      const reportsDir = path.join(__dirname, 'public', 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const filePath = path.join(reportsDir, `${visitId}.pdf`);
      
      // Write raw binary data from req.body
      await fs.promises.writeFile(filePath, req.body);
      
      const host = req.get('host');
      const protocol = req.protocol;
      
      // Return the public URL
      const fileUrl = `${protocol}://${host}/public/reports/${visitId}.pdf`;
      res.json({ success: true, url: fileUrl });
    } catch (error) {
      console.error('Failed to save report PDF:', error);
      res.status(500).json({ error: 'Failed to save report PDF.' });
    }
  });

  // Serve static PDF files from public reports folder
  app.use('/public/reports', express.static(path.join(__dirname, 'public', 'reports')));

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

  // --- PUBLIC API ROUTES ---
  app.get('/api/public/track-report/:visitId', async (req, res) => {
    try {
      const { visitId } = req.params;
      
      // 1. Try to find the Patient ID from either LabVisits or LabResults
      let targetPatientId = visitId;
      let targetVisitId = visitId;
      
      const [lrCheck] = await pool.execute('SELECT LabPatientID FROM LabResults WHERE ID = ? LIMIT 1', [visitId]);
      if (lrCheck.length > 0) {
        targetPatientId = lrCheck[0].LabPatientID;
      }

      // 2. Fetch LabVisits and LabPatients data safely
      let [visitRows] = await pool.execute(`
        SELECT v.*, p.Name as PatientName, p.Phone, p.Age, p.AgeMonths, p.AgeDays, p.Gender 
        FROM LabVisits v 
        LEFT JOIN LabPatients p ON v.LabPatientID = p.ID
        WHERE v.ID = ? LIMIT 1
      `, [targetVisitId]);
      
      if (visitRows.length === 0 && targetPatientId) {
        [visitRows] = await pool.execute(`
          SELECT v.*, p.Name as PatientName, p.Phone, p.Age, p.AgeMonths, p.AgeDays, p.Gender 
          FROM LabVisits v 
          LEFT JOIN LabPatients p ON v.LabPatientID = p.ID
          WHERE v.LabPatientID = ? ORDER BY v.CreatedAt DESC LIMIT 1
        `, [targetPatientId]);
      }
      
      const visitData = visitRows[0] || {};
      const actualPatientId = visitData.LabPatientID || targetPatientId;
      
      // 3. Fetch LabResults data safely (avoiding wrong random results on OR conditions)
      let [labRows] = await pool.execute('SELECT * FROM LabResults WHERE ID = ? LIMIT 1', [visitId]);
      
      if (labRows.length === 0) {
        // Fallback to getting the latest result for this patient if ID was actually a Patient ID
        [labRows] = await pool.execute('SELECT * FROM LabResults WHERE LabPatientID = ? ORDER BY CreatedAt DESC LIMIT 1', [actualPatientId]);
      }
      
      const labData = labRows[0] || {};
      
      if (!visitData.ID && !labData.ID) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      // 4. Calculate Payment & Status
      const totalAmt = Number(visitData.TotalAmount || 0);
      const discount = Number(visitData.DiscountAmount || 0);
      const paid = Number(visitData.PaidAmount || 0);
      
      const balance = totalAmt - discount - paid;
      const isPaid = visitData.PaymentStatus === 'Paid' || balance <= 0;
      
      const status = labData.ResultStatus || labData.Status || visitData.Status || 'Pending';
      const isFinalized = status === 'Finalized' || status === 'Completed' || status === 'Ready';
      
      // If we don't have a patient name from visits, we might have it in LabResults
      let patientName = visitData.PatientName || labData.PatientName;
      if (!patientName) {
         // Fallback query if PatientName was missing but we have LabPatientID
         const [pRows] = await pool.execute('SELECT Name, Age, AgeMonths, AgeDays, Gender, Phone FROM LabPatients WHERE ID = ? LIMIT 1', [actualPatientId]);
         if (pRows.length > 0) {
           patientName = pRows[0].Name;
           visitData.Age = pRows[0].Age;
           visitData.AgeMonths = pRows[0].AgeMonths;
           visitData.AgeDays = pRows[0].AgeDays;
           visitData.Gender = pRows[0].Gender;
           visitData.Phone = pRows[0].Phone;
         } else {
           patientName = 'Unknown Patient';
         }
      }

      const publicRes = {
        patientName: patientName,
        labPatientId: actualPatientId,
        date: labData.TestDate || labData.ReportDate || visitData.VisitDate || visitData.CreatedAt,
        status: status,
        paymentStatus: visitData.PaymentStatus || 'Unpaid',
        isLocked: !isPaid || !isFinalized,
        totalAmount: totalAmt,
        paidAmount: paid,
        balance: Math.max(0, balance),
        age: visitData.Age || labData.PatientAge || 0,
        ageMonths: visitData.AgeMonths || 0,
        ageDays: visitData.AgeDays || 0,
        gender: visitData.Gender || 'Other',
        phone: visitData.Phone || 'N/A',
        technician: labData.Technician || 'System',
        referredBy: labData.ReferredBy || 'Self',
        isExpired: false,
      };
      
      // Fetch global settings for reportExpiryHours
      let globalData = {};
      try {
        const [gRows] = await pool.execute('SELECT Data FROM AppSettings WHERE ID = "GLOBAL" LIMIT 1');
        if (gRows.length > 0) {
          globalData = typeof gRows[0].Data === 'string' ? JSON.parse(gRows[0].Data) : (gRows[0].Data || {});
        }
      } catch (e) {
        console.error("Error loading global settings in track-report:", e);
      }

      // Calculate Expiry
      const expiryHours = Number(globalData.reportExpiryHours) || 3;
      publicRes.expiryHours = expiryHours;
      
      const normalizedStatus = String(status || '').trim().toLowerCase();
      const isStatusFinal = ['finalized', 'completed', 'ready', 'delivered'].includes(normalizedStatus);

      if (isStatusFinal) {
        const dateRaw = labData.ReportDate || labData.TestDate || visitData.VisitDate || visitData.CreatedAt;
        let reportTime = NaN;
        if (dateRaw) {
          const parsed = new Date(dateRaw);
          reportTime = parsed.getTime();
          if (isNaN(reportTime) && typeof dateRaw === 'string') {
            const fallbackParsed = new Date(dateRaw.replace(' ', 'T'));
            reportTime = fallbackParsed.getTime();
          }
        }

        const currentTime = Date.now();
        if (!isNaN(reportTime)) {
          const hoursElapsed = (currentTime - reportTime) / (1000 * 60 * 60);
          if (hoursElapsed > expiryHours) {
            publicRes.isExpired = true;
            publicRes.isLocked = true; // Lock it to prevent downloading tests
          }
        }
      }
      
      if (!publicRes.isLocked && !publicRes.isExpired) {
        try {
          publicRes.tests = typeof labData.Tests === 'string' ? JSON.parse(labData.Tests) : labData.Tests;
        } catch (e) {
          publicRes.tests = [];
        }
      }
      
      res.json(publicRes);
    } catch (error) {
      console.error('Public track API error:', error);
      res.status(500).json({ error: 'Server error' });
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
  httpServer.setMaxListeners(50); // Prevent Node warning during Socket.io reconnect storms
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6, // Limit message size (1MB) to prevent OOM
    pingTimeout: 30000,
    pingInterval: 10000
  });

  app.set('io', io);

  // Presence Tracking: UserID -> { socketId, isOnChatPage, lastChatActivity, hasWarnedInactivity }
  const userSocketMap = new Map();
  const IDLE_TIMEOUT_MS = 600000; // 10 minutes - Force disconnect after this

  function broadcastOnlineUsers() {
    const now = Date.now();
    const onlineUserIds = [];
    
    for (const [userId, info] of userSocketMap.entries()) {
      const diff = now - info.lastChatActivity;
      
      // Force disconnect truly idle users to save shared hosting resources
      if (diff > IDLE_TIMEOUT_MS) {
        const socket = io.sockets.sockets.get(info.socketId);
        if (socket) {
          console.log(`🔌 [AUTO-DISCONNECT] User ${userId} due to 10m inactivity`);
          socket.emit('force-disconnect', { reason: 'Inactivity timeout' });
          socket.disconnect(true);
        }
        continue;
      }

      const wasRecentlyActive = diff < 120000; // 2 minutes for "Online" status
      if (wasRecentlyActive) {
        onlineUserIds.push(userId);
        info.hasWarnedInactivity = false;
      } else {
        if (!info.hasWarnedInactivity) {
          const lastActiveDate = new Date(info.lastChatActivity).toISOString();
          if (pool) {
            pool.execute('UPDATE Users SET LastLogin = ? WHERE ID = ?', [lastActiveDate, userId]).catch(() => {});
          }
          info.hasWarnedInactivity = true;
        }
      }
    }
    
    io.emit('online-users', onlineUserIds);
  }

  // Check every 60 seconds
  setInterval(broadcastOnlineUsers, 60000);

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

    // Update LastLogin in database - with safety check
    if (pool) {
      pool.execute('UPDATE Users SET LastLogin = ? WHERE ID = ?', [new Date().toISOString(), userId]).catch(err => {
        console.error('❌ Failed to update LastLogin:', err);
      });
    } else {
      console.warn('⚠️ Database pool not initialized yet, skipping LastLogin update');
    }

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
        // 0. Check for Admin-only Chat Restriction
        const [settingsRows] = await pool.query("SELECT Data FROM AppSettings WHERE ID = 'GLOBAL'");
        if (settingsRows.length > 0) {
          const globalData = typeof settingsRows[0].Data === 'string' ? JSON.parse(settingsRows[0].Data) : settingsRows[0].Data;
          if (globalData.isChatRestricted && socket.user.role !== 'Admin') {
            return socket.emit('error', { 
              message: 'Chat is currently restricted by Admin. Only administrators can send messages.' 
            });
          }
        }

        // 0.1 Check for Conversation-specific Block
        const [convRows] = await pool.query("SELECT IsBlocked FROM ChatConversations WHERE ID = ?", [Number(conversationId)]);
        if (convRows.length > 0 && convRows[0].IsBlocked) {
          // Admin can still send messages even if conversation is blocked
          if (socket.user.role !== 'Admin') {
            return socket.emit('error', { 
              message: 'This conversation is blocked by Admin. You cannot send messages.' 
            });
          }
        }

        // Ensure sender is in the room
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

        // 2. Update Conversation metadata for faster sidebar loading
        await pool.execute(
          'UPDATE ChatConversations SET LastMessage = ?, LastMessageAt = ?, UpdatedAt = ? WHERE ID = ?',
          [content.substring(0, 500), now, now, Number(conversationId)]
        );

        // 3. Emit to everyone in the room
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
      // Final update to database on disconnect - with safety check
      const now = new Date().toISOString();
      if (pool) {
        pool.execute('UPDATE Users SET LastLogin = ? WHERE ID = ?', [now, userId]).catch(err => {
          console.error('❌ Failed to update LastLogin on disconnect:', err);
        });
      }

      userSocketMap.delete(userId);
      console.log(`💬 Chat: User ${socket.user.username} disconnected`);
      broadcastOnlineUsers();
    });
  });

    // --- START SERVER ---
    try {
      const isNumericPort = !isNaN(PORT) && !isNaN(parseFloat(PORT));
      const listenCallback = () => {
        console.log('-------------------------------------------');
        console.log('✅ SERVER ONLINE');
        console.log(`🏥 Hospital Management Backend: ${isNumericPort ? `http://0.0.0.0:${PORT}` : PORT}`);
        console.log(`💬 Real-time Chat: Enabled (Socket.io)`);
        console.log('-------------------------------------------');
      };

      const serverInstance = isNumericPort
        ? httpServer.listen(Number(PORT), '0.0.0.0', listenCallback)
        : httpServer.listen(PORT, listenCallback);

      serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use.`);
          process.exit(1);
        } else {
          console.error('❌ Server error:', err);
        }
      });

      // Single Graceful Shutdown Handler (with debounce for Windows)
      let isShuttingDown = false;
      process.removeAllListeners('SIGINT');
      process.on('SIGINT', () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        console.log('\n🛑 Shutdown signal received. Closing server...');
        serverInstance.close(() => {
          console.log('👋 Server stopped.');
          process.exit(0);
        });
        
        // Force exit after 3 seconds if graceful shutdown hangs
        setTimeout(() => process.exit(0), 3000);
      });
    } catch (error) {
      console.error('🔥 CRITICAL ERROR during startup:', error);
      process.exit(1);
    }
