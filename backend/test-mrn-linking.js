const axios = require('axios');

async function testMrnLinking() {
    const API_URL = 'http://localhost:3001/api/patients';
    const mrn = `MRN-TEST-${Date.now()}`;

    try {
        console.log('🧪 TESTING MRN LINKING\n');

        // 1. Create Patient A (First Visit)
        console.log('1️⃣ Creating Patient A (First Visit)...');
        const resA = await axios.post(API_URL, {
            id: `PAT-A-${Date.now()}`,
            mrn: mrn, // Explicitly setting MRN
            name: 'John MRN Test',
            age: 30,
            gender: 'Male',
            phone: '555-0101',
            address: '123 Test St',
            visitDate: '2023-01-01',
            symptoms: 'Initial Visit',
            createdBy: 'Test Script',
            createdByRole: 'Admin'
        });
        const idA = resA.data.id;
        console.log(`✅ Created Patient A: ${idA} (MRN: ${mrn})`);

        // 2. Create Patient B (Second Visit - Linked)
        console.log('\n2️⃣ Creating Patient B (Revisit)...');
        const resB = await axios.post(API_URL, {
            id: `PAT-B-${Date.now()}`,
            mrn: mrn, // SAME MRN
            name: 'John MRN Test',
            age: 30,
            gender: 'Male',
            phone: '555-0101',
            address: '123 Test St',
            visitDate: '2023-02-01', // Different date
            symptoms: 'Follow-up',
            createdBy: 'Test Script',
            createdByRole: 'Admin'
        });
        const idB = resB.data.id;
        console.log(`✅ Created Patient B: ${idB} (MRN: ${mrn})`);

        // 3. Search by MRN (Simulating History Lookup)
        console.log('\n3️⃣ Searching by MRN to find linked records...');
        const searchRes = await axios.get(`${API_URL}?search=${mrn}`);
        const foundPatients = searchRes.data.data;

        console.log(`Found ${foundPatients.length} records matching MRN '${mrn}'`);

        const foundA = foundPatients.find(p => p.ID === idA);
        const foundB = foundPatients.find(p => p.ID === idB);

        if (foundA && foundB) {
            console.log('✅ SUCCESS: Both visits found via MRN search!');
        } else {
            console.error('❌ FAILURE: Could not find both records.');
            if (!foundA) console.log('Missing A');
            if (!foundB) console.log('Missing B');
        }

        // Cleanup
        // await axios.delete(`${API_URL}/${idA}`);
        // await axios.delete(`${API_URL}/${idB}`);

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

testMrnLinking();
