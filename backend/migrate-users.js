const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateUsers() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        waitForConnections: true,
        connectionLimit: 10,
    });

    try {
        console.log('🔄 Starting Users table migration...');

        // Add Email column if not exists
        try {
            await pool.execute('ALTER TABLE Users ADD COLUMN Email VARCHAR(255)');
            console.log('✅ Added Email column');
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') throw err;
            console.log('⏭️  Email column already exists');
        }

        // Add Phone column
        try {
            await pool.execute('ALTER TABLE Users ADD COLUMN Phone VARCHAR(50)');
            console.log('✅ Added Phone column');
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') throw err;
            console.log('⏭️  Phone column already exists');
        }

        // Add Permissions column
        try {
            await pool.execute('ALTER TABLE Users ADD COLUMN Permissions TEXT');
            console.log('✅ Added Permissions column');
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') throw err;
            console.log('⏭️  Permissions column already exists');
        }

        // Add CreatedBy column
        try {
            await pool.execute('ALTER TABLE Users ADD COLUMN CreatedBy VARCHAR(50)');
            console.log('✅ Added CreatedBy column');
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') throw err;
            console.log('⏭️  CreatedBy column already exists');
        }

        // Add UpdatedAt column
        try {
            await pool.execute('ALTER TABLE Users ADD COLUMN UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
            console.log('✅ Added UpdatedAt column');
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') throw err;
            console.log('⏭️  UpdatedAt column already exists');
        }

        // Add LastLogin column
        try {
            await pool.execute('ALTER TABLE Users ADD COLUMN LastLogin DATETIME');
            console.log('✅ Added LastLogin column');
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') throw err;
            console.log('⏭️  LastLogin column already exists');
        }

        // Insert admin user if not exists
        const [admins] = await pool.execute('SELECT * FROM Users WHERE Username = ?', ['admin']);
        if (admins.length === 0) {
            await pool.execute(
                'INSERT INTO Users (ID, Username, Password, Name, Role, Permissions, IsActive, CreatedBy, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                ['USR-000', 'admin', 'admin123', 'System Admin', 'Admin', JSON.stringify(['view_patients', 'edit_patients', 'delete_patients', 'view_payments', 'create_payments', 'view_lab_results', 'edit_lab_results', 'view_prescriptions', 'create_prescriptions', 'view_reports', 'manage_users', 'manage_stock']), 1, 'SYSTEM', new Date().toISOString()]
            );
            console.log('✅ Created admin user');
        } else {
            console.log('⏭️  Admin user already exists');
        }

        console.log('✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrateUsers();
