const mysql = require('mysql2/promise');

async function testPatientFiltering() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🧪 TESTING PATIENT DATE FILTERING\n');

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // 1. Create Patient Created TODAY
        const idToday = `PAT-TODAY-${Date.now()}`;
        await pool.execute(
            'INSERT INTO Patients (ID, Name, CreatedAt) VALUES (?, ?, NOW())',
            [idToday, 'Today Patient']
        );
        console.log(`✅ Created "Today Patient" (ID: ${idToday})`);

        // 2. Create Patient Created YESTERDAY (Use manual string for date)
        const idYesterday = `PAT-YEST-${Date.now()}`;
        await pool.execute(
            `INSERT INTO Patients (ID, Name, CreatedAt) VALUES (?, ?, '${yesterday} 12:00:00')`,
            [idYesterday, 'Yesterday Patient']
        );
        console.log(`✅ Created "Yesterday Patient" (ID: ${idYesterday}) - Date: ${yesterday}`);

        // 3. Verify Filter Logic via API simulation (Query logic)
        console.log('\n3️⃣  Verifying Filter Logic...');

        // Test with filter
        const [rowsFiltered] = await pool.execute(
            'SELECT * FROM Patients WHERE DATE(CreatedAt) = CURDATE()'
        );

        const foundToday = rowsFiltered.find(p => p.ID === idToday);
        const foundYesterday = rowsFiltered.find(p => p.ID === idYesterday);

        if (foundToday) {
            console.log('✅ Filtered Query FOUND "Today Patient" (Correct)');
        } else {
            console.log('❌ Filtered Query MISSED "Today Patient" (Fail)');
        }

        if (!foundYesterday) {
            console.log('✅ Filtered Query EXCLUDED "Yesterday Patient" (Correct)');
        } else {
            console.log('❌ Filtered Query INCLUDED "Yesterday Patient" (Fail)');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await pool.execute('DELETE FROM Patients WHERE ID IN (?, ?)', [idToday, idYesterday]);
        console.log('✅ Cleanup complete');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await pool.end();
}

testPatientFiltering();
