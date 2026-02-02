const mysql = require('mysql2/promise');

async function checkAllConstraints() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        console.log('🔍 Checking ALL foreign key constraints in database...\n');

        // Get all foreign keys in the database
        const [constraints] = await pool.execute(`
      SELECT 
        KCU.TABLE_NAME,
        KCU.CONSTRAINT_NAME,
        KCU.COLUMN_NAME,
        KCU.REFERENCED_TABLE_NAME,
        KCU.REFERENCED_COLUMN_NAME,
        RC.DELETE_RULE,
        RC.UPDATE_RULE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS RC
        ON KCU.CONSTRAINT_NAME = RC.CONSTRAINT_NAME
        AND KCU.CONSTRAINT_SCHEMA = RC.CONSTRAINT_SCHEMA
      WHERE KCU.TABLE_SCHEMA = 'hospital_db'
        AND KCU.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY KCU.TABLE_NAME, KCU.CONSTRAINT_NAME
    `);

        if (constraints.length > 0) {
            console.log('Found foreign key constraints:\n');

            let currentTable = '';
            constraints.forEach(c => {
                if (c.TABLE_NAME !== currentTable) {
                    currentTable = c.TABLE_NAME;
                    console.log(`\n📋 Table: ${c.TABLE_NAME}`);
                }
                console.log(`   ${c.CONSTRAINT_NAME}:`);
                console.log(`      ${c.COLUMN_NAME} -> ${c.REFERENCED_TABLE_NAME}.${c.REFERENCED_COLUMN_NAME}`);
                console.log(`      ON DELETE: ${c.DELETE_RULE}, ON UPDATE: ${c.UPDATE_RULE}`);
            });

            // Check specifically for constraints involving Stock table
            const stockConstraints = constraints.filter(c =>
                c.TABLE_NAME === 'stock' || c.REFERENCED_TABLE_NAME === 'stock'
            );

            if (stockConstraints.length > 0) {
                console.log('\n\n⚠️  FOUND CONSTRAINTS INVOLVING STOCK TABLE:');
                stockConstraints.forEach(c => {
                    console.log(`\n   Table: ${c.TABLE_NAME}`);
                    console.log(`   Constraint: ${c.CONSTRAINT_NAME}`);
                    console.log(`   ${c.COLUMN_NAME} -> ${c.REFERENCED_TABLE_NAME}.${c.REFERENCED_COLUMN_NAME}`);
                    console.log(`   DELETE RULE: ${c.DELETE_RULE}`);
                });
            } else {
                console.log('\n\n✅ No foreign key constraints involving Stock table');
            }

        } else {
            console.log('No foreign key constraints found in database');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    }

    await pool.end();
}

checkAllConstraints();
