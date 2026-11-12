<div align="center">

  <img src="apps/mobile/assets/images/logo-glow.png" alt="StudyMate AI Logo" width="120" height="120" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(124, 58, 237, 0.4);" />

  # 🎓 StudyMate AI
  ### The Premium AI-Powered Student Learning & Productivity Application for Android

  [![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
  [![Expo SDK](https://img.shields.io/badge/Expo_SDK-58.0-000020?logo=expo&logoColor=white)](https://expo.dev/)
  [![Android](https://img.shields.io/badge/Platform-Android_8.0+-3DDC84?logo=android&logoColor=white)](https://www.android.com/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
  [![Google Gemini AI](https://img.shields.io/badge/AI_Engine-Google_Gemini-8E75C4?logo=google&logoColor=white)](https://ai.google.dev/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

  <br />

  <p align="center">
    <a href="https://study-mate-ai-android-apk.vercel.app/download">
      <img src="https://img.shields.io/badge/📲_Download_Android_APK-Build_3_(Direct)-6366F1?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" height="46" />
    </a>
    &nbsp;&nbsp;
    <a href="https://study-mate-ai-android-apk.vercel.app/privacy.html">
      <img src="https://img.shields.io/badge/🔒_Privacy_Policy-Verified-10B981?style=for-the-badge&logo=shield&logoColor=white" alt="Privacy Policy" height="46" />
    </a>
  </p>

</div>

---

## 🌟 Overview

**StudyMate AI** is a premium, all-in-one student productivity and learning companion designed specifically for modern university and college students on Android.

Built completely from scratch with a focus on speed, beautiful dark aesthetics, and student privacy, StudyMate AI combines Google's advanced **Gemini AI** with proven study science techniques:
- **Interactive Cornell Note Taking**: Convert dense lecture notes into structured cues and summaries.
- **Pomodoro Focus Studio**: Integrated interval timer with ambient binaural soundscapes (rain, cafe, white noise).
- **Spaced Repetition Flashcards**: Leitner algorithm to help you remember topics long-term for exams.
- **Timetable & Attendance Safeguard**: Track your weekly class schedule with automatic 75% minimum attendance alerts and pre-lecture notification alarms.

---

## 📱 Mobile App Showcase

<div align="center">
  <table>
    <tr>
      <td width="33%" align="center">
        <b>📱 Smart Student Dashboard</b><br/><br/>
        <img src="docs/screenshots/mobile_dashboard.png" alt="Mobile Dashboard" width="280" style="border-radius: 20px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" /><br/><br/>
        <sub>Semester progress, daily study goal tracker, university subjects, and quick study widgets</sub>
      </td>
      <td width="33%" align="center">
        <b>🤖 Gemini AI Study Companion</b><br/><br/>
        <img src="docs/screenshots/mobile_ai_study.png" alt="AI Study Companion" width="280" style="border-radius: 20px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" /><br/><br/>
        <sub>Ask complex questions, synthesize tough syllabus concepts, and generate Cornell notes instantly</sub>
      </td>
      <td width="33%" align="center">
        <b>⏱️ Pomodoro Focus Studio</b><br/><br/>
        <img src="docs/screenshots/mobile_pomodoro.png" alt="Pomodoro Timer" width="280" style="border-radius: 20px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" /><br/><br/>
        <sub>25/5 interval timer, binaural ambient focus audio, streaks, and GitHub-style study heatmaps</sub>
      </td>
    </tr>
  </table>
</div>

---

## 🚀 Key Student Features

### 1. 🤖 Gemini-Powered AI Study Buddy
- **Deep Concept Explanations**: Breakdown difficult STEM formulas, humanities essays, or computer science concepts in plain, easy-to-understand language.
- **Automated Cornell Notes**: Formats lecture content into Cues, Notes, and Exam Summaries.
- **Instant Quiz Generator**: Tests your understanding with multiple-choice questions and detailed explanations.

### 2. ⏱️ Focus Pomodoro & Ambient Soundscapes
- **Customizable Intervals**: 25-minute study sprints with 5-minute restorative breaks.
- **Background Soundscapes**: Built-in binaural audio tracks (ambient rain, study cafe, deep focus frequency) to cancel surrounding noise during study sessions.
- **Study Consistency Heatmap**: Visualizes your daily focus time and keeps your study streak alive.

### 3. 🧠 Spaced Repetition Flashcards
- **Leitner Active Recall**: Prioritizes difficult cards and spaces out familiar topics to optimize long-term memory retention before finals.
- **Subject Categorization**: Keep cards organized by semester subjects, exams, or chapters.

### 4. 📅 Timetable, Attendance Tracker & Alarms
- **Smart Attendance Thresholds**: Tracks attendance percentage per subject and sends alerts if you drop below minimum required percentages.
- **Exact Lecture Alarms**: Automated reminders sent to your Android phone before classes start.

---

## 🔒 Security & Student Privacy

Student privacy and data safety are built into the core design:
- **Zero Client API Keys**: No AI keys or sensitive secrets are embedded in the mobile application. All requests pass through secure backend gateways.
- **Hardware Keystore Token Storage**: Authentication tokens are stored exclusively using Android's hardware-backed **Keystore (Expo SecureStore)**.
- **Argon2id Password Security**: Passwords are encrypted with industry-standard Argon2id hashing.
- **Isolated Data Access**: Strict application-level tenant isolation ensures students can only view their own notes, schedules, and flashcards.
- **No Data Selling**: Your study notes and personal academic information are never sold or shared with third parties.

---

## 📲 How to Install & Run

### Direct APK Download (Android 8.0+)
1. Download the latest verified APK directly from the public download page:  
   👉 **[Download StudyMate AI for Android](https://study-mate-ai-android-apk.vercel.app/download)**
2. Open the downloaded `.apk` file on your Android device.
3. If prompted by your browser, tap **Settings** and enable **"Allow from this source"**.
4. Tap **Install** and launch StudyMate AI!

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile Client** | React Native `0.88`, Expo SDK `58`, Expo Router `v4`, TypeScript 5+, TanStack Query `v5`, Zustand, React Native Reanimated `4.7` |
| **Backend API** | FastAPI, Python 3.12+, Pydantic v2, SQLAlchemy 2.0 Async (`asyncpg`), Alembic |
| **Cloud Database** | PostgreSQL 16+ |
| **AI Architecture** | Google Gemini Engine (`gemini-3.1-flash-lite`, `gemini-3.8-flash`) |
| **Build & Deploy** | Expo Application Services (EAS Build), Render Cloud Engine |

---

## 📄 Privacy Policy & Terms

Read our comprehensive, Google Play Store compliant Privacy Policy:  
👉 **[StudyMate AI Privacy Policy](https://study-mate-ai-android-apk.vercel.app/privacy.html)**

---

## 👨‍💻 Developer & Credits

Crafted with ❤️ by **Anmol Singh** for university students worldwide.  
*Study Smart... Grow Smart.*

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
