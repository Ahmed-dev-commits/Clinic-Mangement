const mysql = require('mysql2/promise');
require('dotenv').config();

async function updatePermissions() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        waitForConnections: true,
        connectionLimit: 10,
    });

    const PERMISSIONS = {
        receptionist: [
            'view_patients',
            'edit_patients',
            'view_payments',
            'create_payments',
            'manage_stock',
        ],
        doctor: [
            'view_patients',
            'edit_patients',
            'view_prescriptions',
            'create_prescriptions',
            'view_lab_results',
            'view_medicines',
        ],
        labtech: [
            'view_patients',
            'view_lab_results',
            'edit_lab_results',
        ]
    };

    try {
        console.log('🔄 Updating default user permissions...');

        // Update Receptionist
        await pool.execute(
            'UPDATE Users SET Permissions = ? WHERE Username = ?',
            [JSON.stringify(PERMISSIONS.receptionist), 'receptionist']
        );
        console.log('✅ Updated Receptionist permissions');

        // Update Doctor
        await pool.execute(
            'UPDATE Users SET Permissions = ? WHERE Username = ?',
            [JSON.stringify(PERMISSIONS.doctor), 'doctor']
        );
        console.log('✅ Updated Doctor permissions');

        // Update Lab Tech
        await pool.execute(
            'UPDATE Users SET Permissions = ? WHERE Username = ?',
            [JSON.stringify(PERMISSIONS.labtech), 'labtech']
        );
        console.log('✅ Updated Lab Tech permissions');

        console.log('🎉 Permissions update completed successfully!');

    } catch (error) {
        console.error('❌ Update failed:', error);
    } finally {
        await pool.end();
    }
}

updatePermissions();
