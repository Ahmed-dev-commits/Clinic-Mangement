const mysql = require('mysql2/promise');

async function finalTest() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🧪 FINAL TEST: Stock Delete Bug\n');

        // Step 1: Add a medicine to stock
        console.log('1️⃣  Adding medicine to STOCK...');
        const stockId = `STK-FINAL-${Date.now()}`;
        await pool.execute(
            'INSERT INTO stock (ID, Name, Category, Quantity, Price) VALUES (?, ?, ?, ?, ?)',
            [stockId, 'Final Test Medicine', 'Tablet', 100, 50.00]
        );
        console.log(`✅ Added to stock: ${stockId}`);

        // Step 2: Create a prescription with this medicine
        console.log('\n2️⃣  Creating prescription with this medicine...');
        const rxId = `RX-FINAL-${Date.now()}`;
        await pool.execute(
            'INSERT INTO Prescriptions (ID, PatientID, PatientName, PatientAge, Diagnosis, Medicines, LabTests, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [rxId, 'P-TEST', 'Test Patient', 30, 'Test', '[]', '[]', 'Finalized']
        );

        await pool.execute(
            'INSERT INTO PrescriptionMedicines (PrescriptionID, MedicineName, Dosage, Frequency, Duration, Quantity) VALUES (?, ?, ?, ?, ?, ?)',
            [rxId, 'Final Test Medicine', '500mg', 'Twice daily', '5 days', 10]
        );
        console.log(`✅ Created prescription: ${rxId}`);

        // Step 3: Count before delete
        const [before] = await pool.execute(
            'SELECT COUNT(*) as count FROM PrescriptionMedicines WHERE PrescriptionID = ?',
            [rxId]
        );
        console.log(`\n📊 Prescription medicines BEFORE deleting stock: ${before[0].count}`);

        // Step 4: DELETE FROM STOCK
        console.log('\n4️⃣  🗑️  DELETING medicine from STOCK...');
        await pool.execute('DELETE FROM stock WHERE ID = ?', [stockId]);
        console.log('✅ Deleted from stock');

        // Step 5: Count after delete
        const [after] = await pool.execute(
            'SELECT COUNT(*) as count FROM PrescriptionMedicines WHERE PrescriptionID = ?',
            [rxId]
        );
        console.log(`\n📊 Prescription medicines AFTER deleting stock: ${after[0].count}`);

        // Step 6: Result
        console.log('\n' + '='.repeat(60));
        if (before[0].count === after[0].count && after[0].count > 0) {
            console.log('✅ ✅ ✅ SUCCESS! BUG IS FIXED! ✅ ✅ ✅');
            console.log('Prescription medicines were NOT affected by stock deletion!');
        } else {
            console.log('❌ ❌ ❌ FAILED! BUG STILL EXISTS! ❌ ❌ ❌');
            console.log('Prescription medicines were deleted when stock was deleted!');
        }
        console.log('='.repeat(60));

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await pool.execute('DELETE FROM PrescriptionMedicines WHERE PrescriptionID = ?', [rxId]);
        await pool.execute('DELETE FROM Prescriptions WHERE ID = ?', [rxId]);
        console.log('✅ Cleanup complete');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }

    await pool.end();
}

finalTest();
