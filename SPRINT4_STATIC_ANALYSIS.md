
# 🧪 Sprint 4: Static Analysis Report

## ✅ Tool Used
- **ESLint** for JavaScript static analysis

## 🐛 Top 5 Critical Issues Fixed

---

### 🛠️ Fix 1: `io` is not defined (`messaging.js`)

**File:** `public/messaging.js`  
**ESLint Rule:** [`no-undef`](https://eslint.org/docs/latest/rules/no-undef)  
**Line:** 140  
**Severity:** 🔴 Critical

**Problem:**  
The global `io` variable used to initialize the Socket.IO connection was not declared. This could crash the app or silently break real-time features.

**Fix:**  
Declared `io` as a global using an ESLint directive:
```js
/* global io */
```

**Why it matters:**  
Prevents runtime errors and ensures proper WebSocket usage.

**Commit Message:**  
`fix: declare io as a global for socket initialization (ESLint no-undef)`

---

### 🛠️ Fix 2: Jest Globals Not Recognized (`messaging.test.js`)

**File:** `public/messaging.test.js`  
**ESLint Rule:** [`no-undef`](https://eslint.org/docs/latest/rules/no-undef)  
**Lines Affected:** 8, 10, 23, etc.  
**Severity:** 🔴 Critical

**Problem:**  
Common testing globals like `describe`, `test`, and `expect` were flagged as undefined.

**Fix:**  
Declared them globally via comment:
```js
/* global describe, test, beforeEach, afterEach, expect, jest */
```

**Why it matters:**  
Allows ESLint to recognize Jest functions and avoid false positives.

**Commit Message:**  
`fix: declared Jest globals in messaging.test.js to resolve no-undef errors`

---

### 🛠️ Fix 3: `dmUser` is not defined (`nav_bar.js`)

**File:** `public/nav_bar.js`  
**ESLint Rule:** [`no-undef`](https://eslint.org/docs/latest/rules/no-undef)  
**Lines Affected:** 807, 814  
**Severity:** 🔴 Critical

**Problem:**  
`dmUser` was used without being declared.

**Fix:**  
Declared `dmUser` from the URL query string:
```js
const urlParams = new URLSearchParams(window.location.search);
const dmUser = urlParams.get('dm');
```

**Why it matters:**  
Prevents runtime errors and properly supports DM auto-join logic.

**Commit Message:**  
`fix: declare dmUser from URL to prevent undefined variable error in nav_bar.js (ESLint no-undef)`

---

### 🛠️ Fix 4: Unused Function Warning for `logout` and `handleLogin` (`authenticate.js`)

**File:** `public/authenticate.js`  
**ESLint Rule:** [`no-unused-vars`](https://eslint.org/docs/latest/rules/no-unused-vars)  
**Lines Affected:** 22, 31  
**Severity:** ⚠️ Moderate

**Problem:**  
These functions were defined but not used within the file.

**Fix:**  
Made them available globally so they can be used from HTML:
```js
window.logout = logout;
window.handleLogin = handleLogin;
```

**Why it matters:**  
Avoids ESLint warnings and ensures the functions are accessible across the app.

**Commit Message:**  
`fix: exposed logout and handleLogin on window to resolve no-unused-vars warning`

---

### 🛠️ Fix 5: Unused Function `generateDMChannelId` (`messaging.js`)

**File:** `public/messaging.js`  
**ESLint Rule:** [`no-unused-vars`](https://eslint.org/docs/latest/rules/no-unused-vars)  
**Line Affected:** 97  
**Severity:** ⚠️ Moderate

**Problem:**  
The function was defined but never used.

**Fix:**  
Removed the unused function:
```js
// Removed to satisfy ESLint no-unused-vars
const generateDMChannelId = (user1, user2) => {
  return [user1, user2].sort().join("-");
};
```

**Why it matters:**  
Keeps the codebase clean and maintains a passing ESLint report.

**Commit Message:**  
`fix: remove unused generateDMChannelId from messaging.js to resolve ESLint no-unused-vars`

---

## 📄 Post-Fix ESLint Scan

- A final scan was run: `eslint-report-after.txt`
- All top 5 issues resolved
- No remaining critical `no-undef` or `no-unused-vars` errors in targeted files

---

## 📦 Total Impact

- ✅ 5 high-priority issues resolved
- ✅ Each fix committed with descriptive messages
- ✅ All changes linked directly to ESLint output
- ✅ Team followed static analysis best practices for Sprint 4
