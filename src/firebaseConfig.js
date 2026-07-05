// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBmjx6o-kSGZZXhIwgb46jB7Jc-wWbg4mE",
  authDomain: "kakarisan-4bd9c.firebaseapp.com",
  databaseURL: "https://kakarisan-4bd9c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kakarisan-4bd9c",
  storageBucket: "kakarisan-4bd9c.firebasestorage.app",
  messagingSenderId: "651870033033",
  appId: "1:651870033033:web:aef999f369ab26b306a258",
  measurementId: "G-4WFKVZYMSY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
