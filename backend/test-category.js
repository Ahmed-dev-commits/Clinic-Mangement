const mysql = require('mysql2/promise');

async function testCategory() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🧪 TESTING CLINICAL MEDICINES CATEGORY\n');

        // 1. Create a Master Clinical Medicine with Category
        console.log('1️⃣  Creating Master Clinical Medicine with Category...');
        const testName = `Category Test Med ${Date.now()}`;
        await pool.execute(
            'INSERT INTO PrescriptionMedicines (PrescriptionID, MedicineName, Category, Dosage, Frequency, Duration) VALUES (NULL, ?, ?, ?, ?, ?)',
            [testName, 'Syrup', '10ml', 'Twice daily', '7 days'] // Using 'Syrup' category
        );
        console.log(`✅ Created "${testName}" with Category: Syrup`);

        // 2. Verify Data
        console.log('\n2️⃣  Verifying Data...');
        const [rows] = await pool.execute('SELECT * FROM PrescriptionMedicines WHERE MedicineName = ? AND PrescriptionID IS NULL', [testName]);

        if (rows.length > 0) {
            const med = rows[0];
            console.log(`   Found Medicine: ${med.MedicineName}`);
            console.log(`   Category: ${med.Category}`);

            if (med.Category === 'Syrup') {
                console.log('✅ Category matches "Syrup" (Success)');
            } else {
                console.log(`❌ Category mismatch! Expected "Syrup", got "${med.Category}" (Fail)`);
            }
        } else {
            console.log('❌ Medicine not found (Fail)');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await pool.execute('DELETE FROM PrescriptionMedicines WHERE MedicineName = ? AND PrescriptionID IS NULL', [testName]);
        console.log('✅ Cleanup complete');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await pool.end();
}

testCategory();
