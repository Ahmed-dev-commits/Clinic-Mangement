const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_db',
    port: process.env.DB_PORT || 3306
};

async function addMrnColumn() {
    const pool = mysql.createPool(dbConfig);
    try {
        console.log('🔄 Checking for MRN column in Patients table...');

        // Check if column exists
        const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Patients' AND COLUMN_NAME = 'MRN'
    `, [dbConfig.database]);

        if (columns.length === 0) {
            console.log('➕ Adding MRN column...');
            await pool.execute('ALTER TABLE Patients ADD COLUMN MRN VARCHAR(50) AFTER ID');
            console.log('✅ MRN column added successfully');

            // Update existing records with unique MRN (using their ID as fallback MRN for now)
            console.log('🔄 Backfilling MRN for existing patients...');
            await pool.execute('UPDATE Patients SET MRN = ID WHERE MRN IS NULL');
            console.log('✅ Backfill complete');
        } else {
            console.log('ℹ️ MRN column already exists');
        }

    } catch (error) {
        console.error('❌ Error adding MRN column:', error);
    } finally {
        await pool.end();
    }
}

addMrnColumn();
