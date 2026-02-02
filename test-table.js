const mysql = require('mysql2/promise');

async function test() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS PrescriptionMedicines (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        PrescriptionID VARCHAR(50) NOT NULL,
        MedicineID VARCHAR(50),
        MedicineName VARCHAR(255) NOT NULL,
        Dosage VARCHAR(50),
        Frequency VARCHAR(100),
        Duration VARCHAR(50),
        Quantity INT DEFAULT 1,
        FOREIGN KEY (PrescriptionID) REFERENCES Prescriptions(ID) ON DELETE CASCADE,
        FOREIGN KEY (MedicineID) REFERENCES MedicineStock(ID) ON DELETE SET NULL
      )
    `);
        console.log('✅ Table created successfully');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await pool.end();
}

test();
