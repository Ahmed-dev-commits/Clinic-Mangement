const mysql = require('mysql2/promise');

async function modifySchema() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🔄 Modifying PrescriptionMedicines schema...');

        // Modify PrescriptionID to allow NULL
        await pool.execute('ALTER TABLE PrescriptionMedicines MODIFY PrescriptionID VARCHAR(50) NULL');
        console.log('✅ PrescriptionID column now allows NULL');

        // Verify
        const [columns] = await pool.execute('DESCRIBE PrescriptionMedicines');
        console.log('\nTable structure:');
        columns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} Null:${col.Null}${col.Key ? ` (${col.Key})` : ''}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await pool.end();
}

modifySchema();
