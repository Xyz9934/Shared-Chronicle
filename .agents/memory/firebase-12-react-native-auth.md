---
name: Firebase 12 React Native auth
description: Firebase 12's React Native persistence entry behavior in this Expo workspace.
---

Firebase 12 does not expose `firebase/auth/react-native` through the installed public package exports, and TypeScript does not see the React Native persistence export from the browser entry. The working Expo approach is to use the underlying `@firebase/auth` React Native build entry and keep the direct dependency aligned with the installed Firebase version.

**Why:** The public import either failed typechecking or was not resolvable in the Expo/Metro package graph, while the React Native build itself contains the persistence implementation.

**How to apply:** If Firebase is upgraded, recheck the package exports and Metro bundle warning before changing this import; preserve AsyncStorage-backed `initializeAuth` persistence on native clients.