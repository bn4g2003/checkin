import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

// Firebase Configuration
const firebaseConfig = {
    apiKey: 'AIzaSyBIh7DjPUYn8myMy5w6xsE7JugQJkF3AJE',
    authDomain: 'chamcongkama.firebaseapp.com',
    databaseURL: 'https://chamcongkama-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'chamcongkama',
    storageBucket: 'chamcongkama.firebasestorage.app',
    messagingSenderId: '559157471261',
    appId: '1:559157471261:web:c35e4d776bab5a16cdbef4',
    measurementId: 'G-CDKMV99F6X'
};

// Initialize Firebase (outside handler for cold start optimization)
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const employeesRef = ref(database, 'employees');
        const snapshot = await get(employeesRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert object to array for easier consumption
            const employeesList = Object.entries(data).map(([id, employee]) => ({
                id,
                ...employee
            }));
            res.status(200).json(employeesList);
        } else {
            res.status(200).json([]);
        }
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
