const mysql = require('mysql2/promise');

async function checkTable() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        const [rows] = await pool.execute('SHOW TABLES LIKE "PrescriptionMedicines"');
        if (rows.length > 0) {
            console.log('✅ PrescriptionMedicines table exists');
            const [columns] = await pool.execute('DESCRIBE PrescriptionMedicines');
            console.log('\nTable structure:');
            columns.forEach(col => {
                console.log(`  - ${col.Field}: ${col.Type}${col.Key ? ` (${col.Key})` : ''}`);
            });
        } else {
            console.log('❌ PrescriptionMedicines table not found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }

    await pool.end();
}

checkTable();
