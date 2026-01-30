const mysql = require('mysql2/promise');

async function addCategoryColumn() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🔄 Adding Category column to PrescriptionMedicines...');

        // Add Category column
        await pool.execute('ALTER TABLE PrescriptionMedicines ADD COLUMN Category VARCHAR(100) AFTER MedicineName');
        console.log('✅ Added Category column');

        // Verify
        const [columns] = await pool.execute('DESCRIBE PrescriptionMedicines');
        console.log('\nTable structure:');
        columns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type}`);
        });

    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  Category column already exists.');
        } else {
            console.error('❌ Error:', error.message);
        }
    }

    await pool.end();
}

addCategoryColumn();
