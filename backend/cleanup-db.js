require('dotenv').config();
const mysql = require('mysql2/promise');

async function cleanup() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'hospital_db',
            port: process.env.DB_PORT || 3306
        });

        console.log('Connected to database.');

        // Using DELETE instead of TRUNCATE to avoid foreign key issues if any (though unlikely here)
        await connection.execute('DELETE FROM PatientServices');
        console.log('Deleted all PatientServices records.');

        await connection.execute('DELETE FROM Payments');
        console.log('Deleted all Payments records.');

        console.log('Cleanup complete.');
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

cleanup();
