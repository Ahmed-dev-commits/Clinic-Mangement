const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_db',
    dateStrings: true // Return dates as strings to preserve formatting
};

const OUTPUT_FILE = path.join(__dirname, '../hospital_db.sql');

async function exportDatabase() {
    console.log(`🔌 Connecting to database '${DB_CONFIG.database}'...`);
    const connection = await mysql.createConnection(DB_CONFIG);
    let sqlContent = `-- Database Export for ${DB_CONFIG.database}\n`;
    sqlContent += `-- Generated at ${new Date().toISOString()}\n\n`;
    sqlContent += `SET FOREIGN_KEY_CHECKS=0;\nSET TIME_ZONE = '+00:00';\n\n`;

    try {
        const [tables] = await connection.query('SHOW FULL TABLES');
        console.log(`📋 Found ${tables.length} tables.`);

        for (const row of tables) {
            const tableName = Object.values(row)[0];
            console.log(`   Exporting table: ${tableName}...`);

            // 1. Structure
            sqlContent += `-- Table structure for table \`${tableName}\`\n`;
            sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            sqlContent += createResult[0]['Create Table'] + ";\n\n";

            // 2. Data
            const [data] = await connection.query(`SELECT * FROM \`${tableName}\``);
            if (data.length > 0) {
                sqlContent += `-- Dumping data for table \`${tableName}\`\n`;

                const columns = Object.keys(data[0]);
                const insertBase = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES `;

                // Chunk inserts to avoid massive queries
                const CHUNK_SIZE = 100;
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);
                    const values = chunk.map(row => {
                        return '(' + Object.values(row).map(val => {
                            if (val === null) return 'NULL';
                            if (typeof val === 'number') return val;
                            if (typeof val === 'boolean') return val ? 1 : 0;
                            // Escape strings
                            return "'" + String(val).replace(/'/g, "''").replace(/\\/g, "\\\\").replace(/\n/g, "\\n") + "'";
                        }).join(', ') + ')';
                    });
                    sqlContent += insertBase + values.join(',\n') + ";\n";
                }
                sqlContent += "\n";
            }
        }

        sqlContent += `SET FOREIGN_KEY_CHECKS=1;\n`;

        fs.writeFileSync(OUTPUT_FILE, sqlContent);
        console.log(`✅ Success! Database exported to:\n   ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('❌ Export failed:', error);
    } finally {
        await connection.end();
    }
}

exportDatabase();
