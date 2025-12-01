import express from 'express';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, query, orderByChild, equalTo } from 'firebase/database';

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());

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

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// API Endpoint to get all employees
app.get('/api/employees', async (req, res) => {
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
            res.json(employeesList);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API Endpoint for Login
app.post('/api/login', express.json(), async (req, res) => {
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
                    // Return success with employee data (excluding password)
                    const { password: _, ...safeEmployeeData } = employeeData;
                    res.status(200).json({
                        success: true,
                        message: 'Login successful',
                        employee: {
                            id: foundId,
                            ...safeEmployeeData
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
});

app.listen(port, () => {
    console.log(`Public Employee API listening at http://localhost:${port}`);
});
