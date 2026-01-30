const mysql = require('mysql2/promise');

async function testClinicalMedicines() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🧪 TESTING CLINICAL MEDICINES SEPARATION\n');

        // 1. Create a Master Clinical Medicine (PrescriptionID = NULL)
        console.log('1️⃣  Creating Master Clinical Medicine...');
        await pool.execute(
            'INSERT INTO PrescriptionMedicines (PrescriptionID, MedicineName, Dosage, Frequency, Duration) VALUES (NULL, ?, ?, ?, ?)',
            ['Clinical Test Med A', '500mg', 'Twice daily', '5 days']
        );
        console.log('✅ Created "Clinical Test Med A" (Master List)');

        // 2. Create a Stock Item
        console.log('\n2️⃣  Creating Stock Item...');
        const stockId = `STK-TEST-${Date.now()}`;
        await pool.execute(
            'INSERT INTO stock (ID, Name, Category, Quantity, Price) VALUES (?, ?, ?, ?, ?)',
            [stockId, 'Stock Test Item B', 'Tablet', 100, 10.00]
        );
        console.log(`✅ Created "Stock Test Item B" (Inventory) ID: ${stockId}`);

        // 3. Verify Separation
        console.log('\n3️⃣  Verifying Separation...');

        // Check if Clinical Med is in Stock? (Should NOT be unless explicitly added)
        const [stockCheck] = await pool.execute('SELECT * FROM stock WHERE Name = ?', ['Clinical Test Med A']);
        if (stockCheck.length === 0) {
            console.log('✅ "Clinical Test Med A" is NOT in Stock table (Correct)');
        } else {
            console.log('❌ "Clinical Test Med A" WAS found in Stock table (Incorrect)');
        }

        // Check if Stock Item is in Clinical List?
        const [clinicalCheck] = await pool.execute(
            'SELECT * FROM PrescriptionMedicines WHERE MedicineName = ? AND PrescriptionID IS NULL',
            ['Stock Test Item B']
        );
        if (clinicalCheck.length === 0) {
            console.log('✅ "Stock Test Item B" is NOT in Clinical Master List (Correct)');
        } else {
            console.log('❌ "Stock Test Item B" WAS found in Clinical Master List (Incorrect)');
        }

        // 4. Delete Stock Item -> Should NOT affect Clinical Med
        console.log('\n4️⃣  Deleting Stock Item...');
        await pool.execute('DELETE FROM stock WHERE ID = ?', [stockId]);
        console.log('✅ Deleted Stock Item');

        // Verify Clinical Med still exists
        const [clinicalVerify] = await pool.execute(
            'SELECT * FROM PrescriptionMedicines WHERE MedicineName = ? AND PrescriptionID IS NULL',
            ['Clinical Test Med A']
        );
        if (clinicalVerify.length > 0) {
            console.log('✅ "Clinical Test Med A" STILL EXISTS in Master List (Success!)');
        } else {
            console.log('❌ "Clinical Test Med A" was DELETED! (Fail)');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await pool.execute('DELETE FROM PrescriptionMedicines WHERE MedicineName = ? AND PrescriptionID IS NULL', ['Clinical Test Med A']);
        console.log('✅ Cleanup complete');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await pool.end();
}

testClinicalMedicines();
