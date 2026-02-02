const axios = require('axios');

async function testProfileApi() {
    const API_URL = 'http://localhost:3001/api/profile';
    // Use the ID from previous test or a known ID
    // If undefined, we can search for a patient first

    try {
        console.log('🔍 Finding a patient to test profile...');
        const listRes = await axios.get('http://localhost:3001/api/patients?limit=1');
        if (listRes.data.data.length === 0) {
            console.log('⚠️ No patients found to test.');
            return;
        }

        const patient = listRes.data.data[0];
        const identifier = patient.MRN || patient.ID;

        console.log(`🧪 Testing Profile API for: ${patient.Name} (${identifier})`);

        const profileRes = await axios.get(`${API_URL}/${identifier}`);
        const data = profileRes.data;

        console.log('✅ Profile Response Received');
        console.log(`- Name: ${data.profile.Name}`);
        console.log(`- Total Visits: ${data.visits.length}`);
        console.log(`- Prescriptions: ${data.history.prescriptions.length}`);
        console.log(`- Lab Results: ${data.history.labResults.length}`);

        if (data.visits.length > 0) {
            console.log('✅ Visits array populated');
        } else {
            console.warn('⚠️ Visits array empty (might be single visit or error)');
        }

    } catch (error) {
        console.error('❌ Error testing profile:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    }
}

testProfileApi();
