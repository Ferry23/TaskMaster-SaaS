import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Check if credentials are provided via environment variables or file
// For this setup, we will expect a serviceAccountKey.json file in the root of server
// OR environment variables. Given the user context, loading from a file is standard for backend.

let output;

try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require('../../firebase-adminsdk.json');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    console.log(`Firebase Admin Initialized. Project ID: ${serviceAccount.project_id}`);
    console.log('Ensure this matches your Firebase Console Project ID.');
} catch (error) {
    console.warn("Attempting to initialize Firebase without firebase-adminsdk.json (Expect env vars or default credentials).");
    // Fallback for cloud environments or if user hasn't added the file yet
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
}

const db = admin.firestore();

export { admin, db };
