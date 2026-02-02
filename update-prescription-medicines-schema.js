const mysql = require('mysql2/promise');

async function updateTable() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🔄 Updating PrescriptionMedicines table schema...\n');

        // Drop the existing table
        console.log('1️⃣  Dropping old table...');
        await pool.execute('DROP TABLE IF EXISTS PrescriptionMedicines');
        console.log('✅ Old table dropped');

        // Create new table without MedicineID
        console.log('\n2️⃣  Creating new table structure...');
        await pool.execute(`
      CREATE TABLE PrescriptionMedicines (
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
        console.log('✅ New table created');

        // Verify structure
        console.log('\n3️⃣  Verifying table structure...');
        const [columns] = await pool.execute('DESCRIBE PrescriptionMedicines');
        console.log('\nTable structure:');
        columns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type}${col.Key ? ` (${col.Key})` : ''}`);
        });

        console.log('\n✅ Schema update complete!');
        console.log('\n📋 Summary:');
        console.log('   - Removed: MedicineID field');
        console.log('   - Removed: Foreign key to MedicineStock');
        console.log('   - Reason: Prescriptions are clinical records, separate from pharmacy inventory');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await pool.end();
}

updateTable();
