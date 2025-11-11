let cachedDb = null;

const realFirebaseConfig = {
  apiKey: 'AIzaSyBIh7DjPUYn8myMy5w6xsE7JugQJkF3AJE',
  authDomain: 'chamcongkama.firebaseapp.com',
  databaseURL: 'https://chamcongkama-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'chamcongkama',
  storageBucket: 'chamcongkama.firebasestorage.app',
  messagingSenderId: '559157471261',
  appId: '1:559157471261:web:c35e4d776bab5a16cdbef4',
  measurementId: 'G-CDKMV99F6X'
};

export async function getDb() {
  // Reuse cached instance to avoid duplicate initializeApp in React Strict Mode/dev
  if (cachedDb) return cachedDb;
  
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
  const dbMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
  const { getDatabase } = dbMod;
  const app = initializeApp(realFirebaseConfig);
  const database = getDatabase(app);
  const freshDb = { database, ...dbMod };
  
  // Update cache with fresh instance
  cachedDb = freshDb;
  return freshDb;
}
