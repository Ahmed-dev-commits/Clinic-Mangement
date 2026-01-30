const mysql = require('mysql2/promise');

async function testDeleteBug() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🧪 Testing Delete Bug Fix\n');

        // Step 1: Create a test medicine in stock
        console.log('1️⃣  Creating test medicine in stock...');
        const testMedicineId = `MED-TEST-${Date.now()}`;
        await pool.execute(
            'INSERT INTO stock (ID, Name, Category, Quantity, Price) VALUES (?, ?, ?, ?, ?)',
            [testMedicineId, 'Test Medicine for Delete', 'Test Category', 100, 50.00]
        );
        console.log(`✅ Created medicine in stock: ${testMedicineId}`);

        // Step 2: Create a test prescription
        console.log('\n2️⃣  Creating test prescription...');
        const testPrescriptionId = `RX-TEST-${Date.now()}`;
        await pool.execute(
            'INSERT INTO Prescriptions (ID, PatientID, PatientName, PatientAge, Diagnosis, Medicines, LabTests, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [testPrescriptionId, 'P-TEST', 'Test Patient', 30, 'Test Diagnosis', '[]', '[]', 'Finalized']
        );
        console.log(`✅ Created prescription: ${testPrescriptionId}`);

        // Step 3: Add medicine to prescription
        console.log('\n3️⃣  Adding medicine to prescription...');
        await pool.execute(
            'INSERT INTO PrescriptionMedicines (PrescriptionID, MedicineName, Dosage, Frequency, Duration, Quantity) VALUES (?, ?, ?, ?, ?, ?)',
            [testPrescriptionId, 'Test Medicine for Delete', '500mg', 'Twice daily', '5 days', 10]
        );
        console.log('✅ Medicine added to prescription');

        // Step 4: Count prescription medicines before delete
        const [beforeCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM PrescriptionMedicines WHERE PrescriptionID = ?',
            [testPrescriptionId]
        );
        console.log(`\n📊 Prescription medicines BEFORE deleting stock: ${beforeCount[0].count}`);

        // Step 5: Delete the medicine from stock
        console.log('\n4️⃣  Deleting medicine from STOCK table...');
        await pool.execute('DELETE FROM stock WHERE ID = ?', [testMedicineId]);
        console.log('✅ Medicine deleted from stock');

        // Step 6: Check if prescription medicine still exists
        const [afterCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM PrescriptionMedicines WHERE PrescriptionID = ?',
            [testPrescriptionId]
        );
        console.log(`\n📊 Prescription medicines AFTER deleting stock: ${afterCount[0].count}`);

        // Step 7: Verify the result
        console.log('\n5️⃣  Verifying result...');
        if (beforeCount[0].count === afterCount[0].count && afterCount[0].count > 0) {
            console.log('\n✅ ✅ ✅ SUCCESS! ✅ ✅ ✅');
            console.log('   Prescription medicine was NOT deleted!');
            console.log('   The bug is FIXED!');
            console.log('   Deleting stock does NOT affect prescriptions.');
        } else {
            console.log('\n❌ ❌ ❌ FAILED! ❌ ❌ ❌');
            console.log('   Prescription medicine was deleted!');
            console.log('   The bug still exists.');
        }

        // Cleanup
        console.log('\n6️⃣  Cleaning up test data...');
        await pool.execute('DELETE FROM PrescriptionMedicines WHERE PrescriptionID = ?', [testPrescriptionId]);
        await pool.execute('DELETE FROM Prescriptions WHERE ID = ?', [testPrescriptionId]);
        console.log('✅ Test data cleaned up');

        console.log('\n✅ Test complete!');

    } catch (error) {
        console.error('\n❌ Error during test:', error.message);
    }

    await pool.end();
}

testDeleteBug();
