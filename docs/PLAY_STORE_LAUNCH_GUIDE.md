# StudyMate AI — Google Play Store Launch & Production Release Guide

This document outlines the step-by-step procedure to build, test, and release **StudyMate AI** (`com.studymate.ai`) to physical Android devices and the Google Play Store.

---

## 1. Architecture & Deployment Status

| Component | Status | Production Target / URL |
| :--- | :--- | :--- |
| **Backend API** | 🟢 Live | `https://studymate-backend-api.onrender.com` |
| **Database** | 🟢 Live | PostgreSQL 16 (Render Managed) |
| **Admin Web Console** | 🟢 Live | `https://study-mate-ai-android-apk.vercel.app` |
| **Privacy Policy URL** | 🟢 Live | `https://study-mate-ai-android-apk.vercel.app/privacy.html` |
| **Android Client** | 🟢 Configured | Expo SDK 58 / React Native 0.88 / Target SDK 34+ |

---

## 2. Generating Android Builds via EAS Cloud

Building on EAS Cloud offloads the heavy compilation (Android SDK, NDK, Gradle) to Expo's managed cloud infrastructure, requiring zero local Android SDK installations on Windows.

### Prerequisites:
1. Sign up for a free account at [expo.dev](https://expo.dev/signup) (if not already done).
2. Authenticate locally in your terminal:
   ```bash
   cd apps/mobile
   npx eas login
   ```

### 2.1 Standalone APK (Direct Install on Physical Phones)
For instant distribution and side-loading on testing devices:
```bash
npm --prefix apps/mobile run build:apk
# or
cd apps/mobile && npx eas build -p android --profile preview
```
* **What happens**:
  * EAS asks to link/create the project on your Expo dashboard (press `y`).
  * EAS asks to generate an Android Keystore (select "Generate new keystore" — Expo manages signing credentials securely).
  * EAS builds the `.apk` in 5–8 minutes.
  * You will receive a **Download Link** and a **QR Code** in the terminal.
  * Open the link or scan the QR code with any Android phone to install!

### 2.2 Production Android App Bundle (.aab for Google Play)
Google Play requires `.aab` format for all store submissions:
```bash
npm --prefix apps/mobile run build:aab
# or
cd apps/mobile && npx eas build -p android --profile production
```
* Download the resulting `.aab` file from your Expo dashboard when the build completes.

---

## 3. Google Play Console Setup (Phase 5)

### Step 1: Google Play Console Account
1. Open [Google Play Console](https://play.google.com/console).
2. Create or open your Developer Account ($25 one-time registration fee).

### Step 2: Create Application
1. Click **Create app**.
2. **App name**: `StudyMate AI`
3. **Default language**: `English (United States)` (or your preferred region)
4. **App or game**: `App`
5. **Free or paid**: `Free`
6. Accept Declarations and click **Create app**.

### Step 3: Complete App Content Declarations
* **Privacy Policy URL**:
  `https://study-mate-ai-android-apk.vercel.app/privacy.html`
* **App Access**: All functionality is available without special credentials (or provide a test student account: `demo.student@studymate.ai` / `DemoStudent@123`).
* **Ads**: Declare **No, my app does not contain ads**.
* **Content Rating**: Complete the IARC questionnaire (Educational/Productivity utility -> `Everyone / 3+`).
* **Target Audience**: 13+, 16+, 18+ (University/College/High School Students).
* **Data Safety Form**:
  * Data collected: Name, Email (for Account Management).
  * Data encrypted in transit: Yes (HTTPS/TLS).
  * Data deletion mechanism: Yes (Users can export and delete accounts directly from the app).

### Step 4: Store Listing Metadata & Graphics

| Asset | Requirement | Recommendation / Content |
| :--- | :--- | :--- |
| **App Title** | Max 30 chars | `StudyMate AI - Student Study` |
| **Short Description** | Max 80 chars | `AI-powered study planner, smart flashcards, Pomodoro focus timer & notes.` |
| **Full Description** | Max 4000 chars | Comprehensive description detailing AI Tutor, Pomodoro Timer, Flashcard Spaced Repetition, Timetable, and Analytics. |
| **App Icon** | $512 \times 512\text{ px}$ (PNG, 32-bit) | Located in `apps/mobile/assets/images/icon.png` |
| **Feature Graphic** | $1024 \times 500\text{ px}$ (JPEG/PNG) | Banner featuring StudyMate AI branding and student productivity tagline |
| **Screenshots** | Min 2, Max 8 (Phone 16:9 or 9:16) | Screenshots of Home Dashboard, Pomodoro Timer, AI Chat Tutor, and Heatmap Analytics |

### Step 5: Upload AAB & Release Track
1. Navigate to **Testing > Closed testing** (or **Production**).
2. Click **Create new release**.
3. Upload the `.aab` file downloaded from EAS Build.
4. Set Release name: `1.0.0 (1)`.
5. Enter Release notes:
   ```
   Welcome to StudyMate AI v1.0.0!
   - Full student productivity suite with Pomodoro timer & Timetable.
   - AI Study Tutor for instant concept explanations and Cornell note generation.
   - Spaced repetition flashcards with quiz assessments.
   - Comprehensive study analytics and consistency heatmaps.
   ```
6. Click **Review release** and **Start rollout**!
