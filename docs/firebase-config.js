// Firebase client config. This is NOT secret — it's fine for this to be public in a
// static bundle (see https://firebase.google.com/docs/projects/api-keys). Access control
// is enforced by firestore.rules + anonymous auth, not by hiding this object.
//
// Replace these placeholder values with your project's config from:
// Firebase Console -> Project settings -> General -> Your apps -> SDK setup and configuration
export const firebaseConfig = {
  apiKey: "AIzaSyC9e78lJnryaafntJTryytLcnRbiTDxYVY",
  authDomain: "mealplan-a82b0.firebaseapp.com",
  projectId: "mealplan-a82b0",
  storageBucket: "mealplan-a82b0.firebasestorage.app",
  messagingSenderId: "219158063735",
  appId: "1:219158063735:web:1454c60f17e71b49bef472",
};
