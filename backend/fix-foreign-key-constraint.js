const mysql = require('mysql2/promise');

async function checkAndFixConstraints() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🔍 Checking foreign key constraints...\n');

        // Check constraints on PrescriptionMedicines table
        console.log('1️⃣  Checking PrescriptionMedicines constraints:');
        const [constraints] = await pool.execute(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'hospital_db'
        AND TABLE_NAME = 'PrescriptionMedicines'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

        if (constraints.length > 0) {
            console.log('\nFound constraints:');
            constraints.forEach(c => {
                console.log(`  - ${c.CONSTRAINT_NAME}: ${c.COLUMN_NAME} -> ${c.REFERENCED_TABLE_NAME}.${c.REFERENCED_COLUMN_NAME}`);
            });

            // Check if there's a constraint to MedicineStock
            const stockConstraint = constraints.find(c => c.REFERENCED_TABLE_NAME === 'MedicineStock');
            if (stockConstraint) {
                console.log('\n⚠️  Found constraint to MedicineStock! This needs to be removed.');
                console.log(`   Constraint name: ${stockConstraint.CONSTRAINT_NAME}`);

                // Drop the constraint
                console.log('\n2️⃣  Dropping foreign key to MedicineStock...');
                await pool.execute(`ALTER TABLE PrescriptionMedicines DROP FOREIGN KEY ${stockConstraint.CONSTRAINT_NAME}`);
                console.log('✅ Foreign key constraint removed');

                // Also drop the MedicineID column if it still exists
                console.log('\n3️⃣  Checking if MedicineID column exists...');
                const [columns] = await pool.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'hospital_db' 
            AND TABLE_NAME = 'PrescriptionMedicines' 
            AND COLUMN_NAME = 'MedicineID'
        `);

                if (columns.length > 0) {
                    console.log('   MedicineID column found, dropping it...');
                    await pool.execute('ALTER TABLE PrescriptionMedicines DROP COLUMN MedicineID');
                    console.log('✅ MedicineID column removed');
                } else {
                    console.log('✅ MedicineID column already removed');
                }
            } else {
                console.log('\n✅ No constraint to MedicineStock found (good!)');
            }
        } else {
            console.log('✅ No foreign key constraints found on PrescriptionMedicines');
        }

        // Verify final structure
        console.log('\n4️⃣  Final table structure:');
        const [finalColumns] = await pool.execute('DESCRIBE PrescriptionMedicines');
        finalColumns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type}${col.Key ? ` (${col.Key})` : ''}`);
        });

        console.log('\n✅ Fix complete!');
        console.log('\n📋 Summary:');
        console.log('   - PrescriptionMedicines is now independent from MedicineStock');
        console.log('   - Deleting medicines from stock will NOT affect prescriptions');
        console.log('   - Prescriptions are clinical records and remain intact');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    }

    await pool.end();
}

checkAndFixConstraints();
