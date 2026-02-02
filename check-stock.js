const mysql = require('mysql2/promise');

async function checkStockTable() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'hospital_db',
        port: 3306
    });

    try {
        const [cols] = await pool.execute('DESCRIBE stock');
        console.log('Stock table structure:');
        cols.forEach(c => console.log(`  ${c.Field}: ${c.Type}`));
    } catch (error) {
        console.error('Error:', error.message);
    }

    await pool.end();
}

checkStockTable();
