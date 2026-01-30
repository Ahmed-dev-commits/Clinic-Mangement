/**
 * Hospital Management System - MySQL Backend Server
 * This server uses MySQL for reliable data storage
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Disable caching for all API routes
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// MySQL connection pool
let pool;

async function createPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

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

    // PrescriptionMedicines table - For doctor prescriptions (clinical records)
    // This is separate from MedicineStock (pharmacy inventory)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS PrescriptionMedicines (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        PrescriptionID VARCHAR(50) NOT NULL,
        MedicineName VARCHAR(255) NOT NULL,
        Dosage VARCHAR(50),
        Frequency VARCHAR(100),
        Duration VARCHAR(50),
        Quantity INT DEFAULT 1,
        FOREIGN KEY (PrescriptionID) REFERENCES Prescriptions(ID) ON DELETE CASCADE
      )
    `);

    // LabResults table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS LabResults (
        ID VARCHAR(50) PRIMARY KEY,
        PatientID VARCHAR(50),
        PatientName VARCHAR(255),
        PatientAge INT,
        TestDate VARCHAR(50),
        ReportDate VARCHAR(50),
        Tests TEXT,
        Notes TEXT,
        Technician VARCHAR(255),
        Status VARCHAR(50) DEFAULT 'Sample Collected',
        NotifiedAt VARCHAR(50),
        CollectedAt VARCHAR(50),
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // PatientServices table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS PatientServices (
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
      CREATE TABLE IF NOT EXISTS Users (
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

    // Daily Expenses table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS DailyExpenses (
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

    // Stock table (Medicine Inventory - separate from prescriptions)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS stock (
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

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
}

// ============ PATIENTS API ============

app.get('/api/patients', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = 'WHERE Name LIKE ? OR ID LIKE ? OR Phone LIKE ?';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam];
    }

    // 1. Get Total Count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM Patients ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 2. Get Paginated Data
    // Note: Using integers for LIMIT/OFFSET usually works with mysql2 execute, 
    // but sometimes requires direct interpolation if ? fails. 
    // We'll try parameterized first, but formatted as strings just in case.
    const [rows] = await pool.execute(
      `SELECT * FROM Patients ${whereClause} ORDER BY CreatedAt DESC LIMIT ${limit} OFFSET ${offset}`,
      params
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

app.get('/api/patients/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM Patients WHERE ID = ?', [req.params.id]);
    res.json(rows[0] ? convertRowDates(rows[0]) : null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { id, name, age, gender, phone, address, visitDate, symptoms, createdBy, createdByRole } = req.body;
    const createdAt = new Date().toISOString();

    await pool.execute(
      'INSERT INTO Patients (ID, Name, Age, Gender, Phone, Address, VisitDate, Symptoms, CreatedBy, CreatedByRole, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, age, gender, phone, address, visitDate, symptoms, createdBy, createdByRole, createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error adding patient:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/patients/:id', async (req, res) => {
  try {
    const { name, age, gender, phone, address, visitDate, symptoms } = req.body;

    await pool.execute(
      'UPDATE Patients SET Name = ?, Age = ?, Gender = ?, Phone = ?, Address = ?, VisitDate = ?, Symptoms = ? WHERE ID = ?',
      [name, age, gender, phone, address, visitDate, symptoms, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/patients/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM Patients WHERE ID = ?', [req.params.id]);
    res.json({ success: true });
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
    const [rows] = await pool.execute('SELECT * FROM Payments ORDER BY CreatedAt DESC');
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const { id, patientId, patientName, consultationFee, labFee, medicineFee, totalAmount, paymentMode, medicines } = req.body;
    const createdAt = new Date().toISOString();

    await pool.execute(
      'INSERT INTO Payments (ID, PatientID, PatientName, ConsultationFee, LabFee, MedicineFee, TotalAmount, PaymentMode, Medicines, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patientId, patientName, consultationFee, labFee, medicineFee, totalAmount, paymentMode, JSON.stringify(medicines), createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRESCRIPTIONS API ============

app.get('/api/prescriptions', async (req, res) => {
  try {
    const [prescriptions] = await pool.execute('SELECT * FROM Prescriptions ORDER BY CreatedAt DESC');

    // Fetch medicines for each prescription from junction table
    const prescriptionsWithMedicines = await Promise.all(
      prescriptions.map(async (prescription) => {
        const [medicines] = await pool.execute(
          'SELECT MedicineName, Dosage, Frequency, Duration, Quantity FROM PrescriptionMedicines WHERE PrescriptionID = ?',
          [prescription.ID]
        );

        // Convert medicines to the format expected by frontend
        const formattedMedicines = medicines.map(med => ({
          name: med.MedicineName,
          dosage: med.Dosage,
          frequency: med.Frequency,
          duration: med.Duration,
          quantity: med.Quantity
        }));

        return {
          ...convertRowDates(prescription),
          medicines: formattedMedicines,
          labTests: prescription.LabTests ? JSON.parse(prescription.LabTests) : []
        };
      })
    );

    res.json(prescriptionsWithMedicines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prescriptions', async (req, res) => {
  try {
    const { id, patientId, patientName, patientAge, diagnosis, medicines, labTests, doctorNotes, precautions, generatedText, followUpDate, status } = req.body;
    const createdAt = new Date().toISOString();

    console.log('Creating prescription:', { id, patientId, status: status || 'Finalized' });

    // Insert prescription (without medicines in JSON)
    await pool.execute(
      'INSERT INTO Prescriptions (ID, PatientID, PatientName, PatientAge, Diagnosis, Medicines, LabTests, DoctorNotes, Precautions, GeneratedText, FollowUpDate, Status, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patientId, patientName, patientAge, diagnosis, JSON.stringify([]), JSON.stringify(labTests), doctorNotes, precautions, generatedText, followUpDate, status || 'Finalized', createdAt]
    );

    // Insert medicines into junction table
    if (medicines && medicines.length > 0) {
      for (const medicine of medicines) {
        await pool.execute(
          'INSERT INTO PrescriptionMedicines (PrescriptionID, MedicineName, Dosage, Frequency, Duration, Quantity) VALUES (?, ?, ?, ?, ?, ?)',
          [id, medicine.name, medicine.dosage, medicine.frequency, medicine.duration, medicine.quantity || 1]
        );
      }
    }

    console.log('✅ Prescription created successfully:', id);
    res.json({ success: true, id });
  } catch (error) {
    console.error('❌ Error creating prescription:', error.message);
    console.error('Error details:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/prescriptions/:id', async (req, res) => {
  try {
    const { patientId, patientName, patientAge, diagnosis, medicines, labTests, doctorNotes, precautions, generatedText, followUpDate, status } = req.body;

    console.log('Updating prescription:', req.params.id, 'status:', status);

    // Update prescription
    await pool.execute(
      'UPDATE Prescriptions SET PatientID=?, PatientName=?, PatientAge=?, Diagnosis=?, LabTests=?, DoctorNotes=?, Precautions=?, GeneratedText=?, FollowUpDate=?, Status=? WHERE ID=?',
      [patientId, patientName, patientAge, diagnosis, JSON.stringify(labTests), doctorNotes, precautions, generatedText, followUpDate, status, req.params.id]
    );

    // Delete existing medicines for this prescription
    await pool.execute('DELETE FROM PrescriptionMedicines WHERE PrescriptionID = ?', [req.params.id]);

    // Insert updated medicines
    if (medicines && medicines.length > 0) {
      for (const medicine of medicines) {
        await pool.execute(
          'INSERT INTO PrescriptionMedicines (PrescriptionID, MedicineName, Dosage, Frequency, Duration, Quantity) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.id, medicine.name, medicine.dosage, medicine.frequency, medicine.duration, medicine.quantity || 1]
        );
      }
    }

    console.log('✅ Prescription updated successfully:', req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating prescription:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ STOCK API (Medicine Inventory) ============

app.get('/api/stock', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM stock ORDER BY Name ASC');
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

// ============ LAB RESULTS API ============

app.get('/api/lab-results', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM LabResults ORDER BY CreatedAt DESC');
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lab-results', async (req, res) => {
  try {
    const { id, patientId, patientName, patientAge, testDate, reportDate, tests, notes, technician, status } = req.body;
    const createdAt = new Date().toISOString();

    await pool.execute(
      'INSERT INTO LabResults (ID, PatientID, PatientName, PatientAge, TestDate, ReportDate, Tests, Notes, Technician, Status, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patientId, patientName, patientAge, testDate, reportDate, JSON.stringify(tests), notes, technician, status, createdAt]
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

    await pool.execute(query, params);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PATIENT SERVICES API ============

app.get('/api/patient-services', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM PatientServices ORDER BY CreatedAt DESC');
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient-services/:patientId', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM PatientServices WHERE PatientID = ? ORDER BY CreatedAt DESC', [req.params.patientId]);
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient-services', async (req, res) => {
  try {
    const { id, patientId, services, grandTotal, status } = req.body;
    const now = new Date().toISOString();

    await pool.execute(
      'INSERT INTO PatientServices (ID, PatientID, Services, GrandTotal, Status, CreatedAt, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, patientId, JSON.stringify(services), grandTotal, status || 'Draft', now, now]
    );

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

// ============ DAILY EXPENSES API ============

app.get('/api/daily-expenses', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM DailyExpenses ORDER BY CreatedAt DESC');
    res.json(rows.map(convertRowDates));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/daily-expenses', async (req, res) => {
  try {
    const { id, date, description, category, amount, paymentMethod, createdBy } = req.body;
    const createdAt = new Date().toISOString();

    await pool.execute(
      'INSERT INTO DailyExpenses (ID, Date, Description, Category, Amount, PaymentMethod, CreatedBy, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, date, description, category, amount, paymentMethod, createdBy, createdAt]
    );

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/daily-expenses/:id', async (req, res) => {
  try {
    const { date, description, category, amount, paymentMethod } = req.body;

    await pool.execute(
      'UPDATE DailyExpenses SET Date = ?, Description = ?, Category = ?, Amount = ?, PaymentMethod = ? WHERE ID = ?',
      [date, description, category, amount, paymentMethod, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/daily-expenses/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM DailyExpenses WHERE ID = ?', [req.params.id]);
    res.json({ success: true });
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
      // Update last login timestamp
      await pool.execute(
        'UPDATE Users SET LastLogin = ? WHERE ID = ?',
        [new Date().toISOString(), rows[0].ID]
      );

      res.json({ success: true, user: convertRowDates(rows[0]) });
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
    const [rows] = await pool.execute(
      'SELECT * FROM DailyExpenses ORDER BY Date DESC, CreatedAt DESC'
    );
    res.json(rows.map(convertRowDates));
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🏥 Hospital Management Backend running on http://localhost:${PORT}`);
    console.log(`📁 Database: MySQL - ${process.env.DB_NAME}`);
    console.log(`🔗 Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
