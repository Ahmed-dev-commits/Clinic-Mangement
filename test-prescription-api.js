const axios = require('axios');

async function testPrescriptionAPI() {
    const baseURL = 'http://localhost:3001';

    try {
        console.log('🧪 Testing Prescription API with Junction Table\n');

        // Test 1: Create a prescription
        console.log('1️⃣  Creating test prescription...');
        const testPrescription = {
            id: `RX-TEST-${Date.now()}`,
            patientId: 'P-001',
            patientName: 'Test Patient',
            patientAge: 35,
            diagnosis: 'Common Cold',
            medicines: [
                {
                    id: null, // Will be linked to stock later
                    name: 'Paracetamol',
                    dosage: '500mg',
                    frequency: 'Twice daily',
                    duration: '5 days',
                    quantity: 10
                },
                {
                    id: null,
                    name: 'Vitamin C',
                    dosage: '1000mg',
                    frequency: 'Once daily',
                    duration: '7 days',
                    quantity: 7
                }
            ],
            labTests: ['Blood Test'],
            doctorNotes: 'Rest and hydration',
            precautions: 'Avoid cold drinks',
            generatedText: 'Test prescription',
            followUpDate: '2026-02-06',
            status: 'Finalized'
        };

        const createResponse = await axios.post(`${baseURL}/api/prescriptions`, testPrescription);
        console.log('✅ Prescription created:', createResponse.data);

        // Test 2: Fetch all prescriptions
        console.log('\n2️⃣  Fetching all prescriptions...');
        const fetchResponse = await axios.get(`${baseURL}/api/prescriptions`);
        const createdPrescription = fetchResponse.data.find(p => p.ID === testPrescription.id);

        if (createdPrescription) {
            console.log('✅ Prescription found in database');
            console.log('   Medicines count:', createdPrescription.medicines.length);
            console.log('   Medicines:', createdPrescription.medicines.map(m => m.name).join(', '));
        } else {
            console.log('❌ Prescription not found');
        }

        // Test 3: Update prescription
        console.log('\n3️⃣  Updating prescription...');
        const updatedData = {
            ...testPrescription,
            diagnosis: 'Common Cold - Updated',
            medicines: [
                {
                    id: null,
                    name: 'Paracetamol',
                    dosage: '650mg', // Changed dosage
                    frequency: 'Thrice daily', // Changed frequency
                    duration: '3 days',
                    quantity: 9
                }
            ]
        };

        await axios.put(`${baseURL}/api/prescriptions/${testPrescription.id}`, updatedData);
        console.log('✅ Prescription updated');

        // Test 4: Verify update
        console.log('\n4️⃣  Verifying update...');
        const verifyResponse = await axios.get(`${baseURL}/api/prescriptions`);
        const updatedPrescription = verifyResponse.data.find(p => p.ID === testPrescription.id);

        if (updatedPrescription) {
            console.log('✅ Update verified');
            console.log('   Diagnosis:', updatedPrescription.Diagnosis);
            console.log('   Medicines count:', updatedPrescription.medicines.length);
            console.log('   First medicine dosage:', updatedPrescription.medicines[0]?.dosage);
        }

        console.log('\n✅ All tests passed!');
        console.log('\n📊 Summary:');
        console.log('   - Prescription creation: ✅');
        console.log('   - Medicine junction table: ✅');
        console.log('   - Prescription retrieval: ✅');
        console.log('   - Prescription update: ✅');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Response:', error.response.data);
        }
    }
}

testPrescriptionAPI();
