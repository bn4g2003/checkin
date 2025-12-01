import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, query, orderByChild, equalTo } from 'firebase/database';

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

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
        res.status(400).json({ error: 'Missing employeeId or password' });
        return;
    }

    try {
        let employeeData = null;
        let foundId = null;

        // Check if input is email
        const isEmail = employeeId.includes('@');

        if (isEmail) {
            const employeesRef = ref(database, 'employees');
            const emailQuery = query(employeesRef, orderByChild('email'), equalTo(employeeId));
            const snapshot = await get(emailQuery);

            if (snapshot.exists()) {
                const data = snapshot.val();
                foundId = Object.keys(data)[0]; // Get the first match
                employeeData = data[foundId];
            }
        } else {
            // Assume it's Employee ID
            const targetId = employeeId.toUpperCase();
            const employeesRef = ref(database, `employees/${targetId}`);
            const snapshot = await get(employeesRef);

            if (snapshot.exists()) {
                employeeData = snapshot.val();
                foundId = targetId;
            }
        }

        if (employeeData) {
            // Verify password
            const storedPassword = employeeData.password || '123456'; // Default if missing
            if (storedPassword === password) {
                if (employeeData.active !== false) {
                    // Return success with employee data (including password as requested)
                    res.status(200).json({
                        success: true,
                        message: 'Login successful',
                        employee: {
                            id: foundId,
                            ...employeeData
                        }
                    });
                } else {
                    res.status(403).json({ error: 'Account is inactive' });
                }
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
