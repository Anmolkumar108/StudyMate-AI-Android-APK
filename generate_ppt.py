import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    # 16:9 Widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6] # completely blank layout

    # Colors
    BG_COLOR = RGBColor(11, 15, 25)       # #0b0f19
    CARD_BG = RGBColor(19, 27, 46)        # #131b2e
    CARD_BORDER = RGBColor(30, 41, 59)    # #1e293b
    PRIMARY_PURPLE = RGBColor(139, 92, 246) # #8b5cf6
    PRIMARY_INDIGO = RGBColor(99, 102, 241) # #6366f1
    TEXT_WHITE = RGBColor(248, 250, 252)  # #f8fafc
    TEXT_MUTED = RGBColor(148, 163, 184)  # #94a3b8
    ACCENT_GREEN = RGBColor(16, 185, 129) # #10b981
    ACCENT_SKY = RGBColor(56, 189, 248)   # #38bdf8
    ACCENT_AMBER = RGBColor(245, 158, 11) # #f59e0b

    def add_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_header(slide, title, category="STUDYMATE AI — OFFICIAL PRESENTATION"):
        # Category / pill
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.35))
        tf_c = cat_box.text_frame
        tf_c.word_wrap = True
        p_c = tf_c.paragraphs[0]
        p_c.text = category.upper()
        p_c.font.size = Pt(11)
        p_c.font.bold = True
        p_c.font.color.rgb = PRIMARY_PURPLE

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.7), Inches(0.7))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(24)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_WHITE

    def add_card(slide, left, top, width, height, title="", items=None, subtitle=""):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER
        card.line.width = Pt(1)

        tb = slide.shapes.add_textbox(Inches(left + 0.25), Inches(top + 0.2), Inches(width - 0.5), Inches(height - 0.4))
        tf = tb.text_frame
        tf.word_wrap = True

        if title:
            p0 = tf.paragraphs[0]
            p0.text = title
            p0.font.size = Pt(16)
            p0.font.bold = True
            p0.font.color.rgb = TEXT_WHITE
            p0.space_after = Pt(4)

        if subtitle:
            p_sub = tf.add_paragraph()
            p_sub.text = subtitle
            p_sub.font.size = Pt(11)
            p_sub.font.color.rgb = PRIMARY_PURPLE
            p_sub.space_after = Pt(10)

        if items:
            for item in items:
                p = tf.add_paragraph()
                p.text = f"• {item}"
                p.font.size = Pt(11.5)
                p.font.color.rgb = TEXT_MUTED
                p.space_after = Pt(6)

        return card

    # ==========================================
    # SLIDE 1: Title & Hero
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    add_background(s1)

    # Accent badge
    badge = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.2), Inches(3.2), Inches(0.4))
    badge.fill.solid()
    badge.fill.fore_color.rgb = RGBColor(30, 27, 75)
    badge.line.color.rgb = PRIMARY_PURPLE
    b_tf = badge.text_frame
    b_p = b_tf.paragraphs[0]
    b_p.text = "OFFICIAL PROJECT PRESENTATION"
    b_p.alignment = PP_ALIGN.CENTER
    b_p.font.size = Pt(11)
    b_p.font.bold = True
    b_p.font.color.rgb = PRIMARY_PURPLE

    # Main Title
    title_box = s1.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(7.5), Inches(2.2))
    tf1 = title_box.text_frame
    tf1.word_wrap = True
    p1 = tf1.paragraphs[0]
    p1.text = "StudyMate AI"
    p1.font.size = Pt(48)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_WHITE
    p1.space_after = Pt(8)

    p2 = tf1.add_paragraph()
    p2.text = "The Premium AI-Powered Academic Companion & Student Productivity Suite for Android"
    p2.font.size = Pt(18)
    p2.font.color.rgb = PRIMARY_PURPLE
    p2.space_after = Pt(14)

    p3 = tf1.add_paragraph()
    p3.text = "Seamlessly uniting Google Gemini LLM with Cornell Note taking, Pomodoro binaural soundscapes, Spaced Repetition Flashcards, and Timetable/Attendance safeguards."
    p3.font.size = Pt(13)
    p3.font.color.rgb = TEXT_MUTED

    # Meta card on left bottom
    add_card(s1, 0.8, 4.4, 7.2, 2.2, "Project Overview & Identity", [
        "Creator & Lead Developer: Anmol Singh",
        "Target Platform: Android (React Native 0.88 + Expo SDK 58)",
        "Backend Architecture: FastAPI + PostgreSQL 16 + Google Gemini AI",
        "Release Status: Build 3 Standalone APK Ready | Google Play Store Ready"
    ], "Built with ❤️ for University Students Worldwide")

    # Image on right
    img_login = "docs/screenshots/01_auth_login.jpg"
    if os.path.exists(img_login):
        s1.shapes.add_picture(img_login, Inches(9.2), Inches(1.1), width=Inches(3.3))

    # ==========================================
    # SLIDE 2: The Core Problem in Higher Education
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    add_background(s2)
    add_header(s2, "The Real-World Academic Crisis Faced by College Students", "PROBLEM STATEMENT")

    add_card(s2, 0.8, 1.8, 3.6, 5.0, "1. Severe Information Overload", [
        "Students attend 5-7 college courses simultaneously with hundreds of pages of PDFs and lecture slides.",
        "Traditional study methods lead to low retention; students cram before finals and forget concepts quickly.",
        "Generic search engines give bloated, non-curated, or confusing explanations."
    ], "Cognitive Overwhelm")

    add_card(s2, 4.8, 1.8, 3.6, 5.0, "2. Fragmented App Fatigue", [
        "Students are forced to switch constantly between 5 different disconnected applications:",
        "Separate timer app for Pomodoro",
        "Generic note-taking app",
        "Separate calendar / timetable",
        "ChatGPT / external AI tabs",
        "Constant app-switching breaks deep focus and causes study procrastination."
    ], "Disjointed Workflow")

    add_card(s2, 8.8, 1.8, 3.7, 5.0, "3. Attendance & Schedule Pitfalls", [
        "Strict university regulations mandate 75% minimum attendance to sit for final semester examinations.",
        "Missing classes due to forgotten timings or room changes causes severe academic penalties.",
        "No single app connects syllabus exams, upcoming lectures, and attendance calculations together."
    ], "Institutional Constraints")

    # ==========================================
    # SLIDE 3: The Solution — StudyMate AI
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    add_background(s3)
    add_header(s3, "StudyMate AI: The All-in-One Intelligent Study Ecosystem", "THE SOLUTION")

    add_card(s3, 0.8, 1.8, 5.8, 5.0, "Unified Academic Architecture", [
        "Single Integrated Mobile Client: Consolidates AI tutoring, focus timers, note taking, flashcards, and timetable tracking in one place.",
        "Google Gemini Multimodal AI: Context-aware explanations, step-by-step math breakdowns, and Cornell note summarization.",
        "Cognitive Science Foundations: Integrates the Leitner spaced repetition method and the 25/5 Pomodoro rhythm.",
        "Attendance Safeguard Engine: Tracks real-time subject attendance percentages with proactive alerts before dropping below 75%.",
        "Battery-Optimized Dark UI: Built with high-contrast cyberpunk/dark aesthetics to reduce OLED battery consumption during long night study sessions."
    ], "Smart, Fast, Focused")

    # Show home top screenshot
    img_home1 = "docs/screenshots/02_home_top.jpg"
    img_home2 = "docs/screenshots/03_home_schedule_heatmap.jpg"
    if os.path.exists(img_home1) and os.path.exists(img_home2):
        s3.shapes.add_picture(img_home1, Inches(7.0), Inches(1.8), width=Inches(2.7))
        s3.shapes.add_picture(img_home2, Inches(10.1), Inches(1.8), width=Inches(2.7))

    # ==========================================
    # SLIDE 4: Feature Showcase — Home & Dashboard
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    add_background(s4)
    add_header(s4, "Smart Student Dashboard & Daily Academic Flow", "FEATURE DEEP-DIVE: HOME")

    add_card(s4, 0.8, 1.8, 5.5, 5.0, "Dashboard Capabilities", [
        "Personalized Greeting & Status: Real-time dynamic greeting with student name, semester streak, and daily quote.",
        "Universal AI Search: Instantly query across notes, tasks, PDFs, timetable schedules, and flashcard decks.",
        "Countdown to Next Lecture: Real-time countdown (e.g. 'in 6d 17h Python in Room A-112 with Dr. sk jha').",
        "Upcoming Exam Milestone: Tracks days left until semester exams with target percentage goals (e.g. 90%).",
        "Daily AI Study Schedule: Tracks minutes studied vs daily target with visual progress bar (e.g. 60m of 60m Done).",
        "Study Consistency Heatmap: GitHub-style contribution grid displaying focus consistency over days and weeks."
    ], "Instant Clarity on Daily Goals")

    img_home3 = "docs/screenshots/04_home_subjects_attendance.jpg"
    if os.path.exists(img_home1) and os.path.exists(img_home3):
        s4.shapes.add_picture(img_home2, Inches(6.8), Inches(1.8), width=Inches(2.8))
        s4.shapes.add_picture(img_home3, Inches(10.0), Inches(1.8), width=Inches(2.8))

    # ==========================================
    # SLIDE 5: Feature Showcase — Study Hub Workspace
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    add_background(s5)
    add_header(s5, "Study Hub: 12 Academic Super-Tools in One Command Center", "FEATURE DEEP-DIVE: STUDY HUB")

    add_card(s5, 0.8, 1.8, 7.8, 5.0, "Integrated Learning Accelerators", [
        "Today's Study Momentum Tracker: Real-time visual cycle timer (configured 60m focus + 5m break) showing elapsed vs remaining study blocks.",
        "Quick-Start 25m Focus Session: 1-click launch for rapid revision blocks with ambient background noise isolation.",
        "Smart AI Study Planner: Timeboxes daily study workload across upcoming exams, pending assignment checklists, and timetable gaps.",
        "Cornell Note Synthesizer: Converts lecture recordings or PDF chapters into structured Cues, Notes, and Exam Summaries.",
        "Interactive Quizzes: Auto-generates multiple-choice and conceptual quizzes from notes with detailed reasoning for each answer.",
        "Formula & Flashcard Decks: Spaced repetition algorithm automatically reschedules difficult cards for frequent review."
    ], "High-Retention Learning Studio")

    img_hub = "docs/screenshots/05_study_hub.jpg"
    if os.path.exists(img_hub):
        s5.shapes.add_picture(img_hub, Inches(9.2), Inches(1.8), width=Inches(3.3))

    # ==========================================
    # SLIDE 6: Feature Showcase — Tasks & Deadlines
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    add_background(s6)
    add_header(s6, "Tasks & Deadlines: Proactive Assignment & Exam Execution", "FEATURE DEEP-DIVE: TASKS")

    add_card(s6, 0.8, 1.8, 7.8, 5.0, "Command Center Task Engine", [
        "Granular Multi-Step Checklists: Break down large assignments into actionable micro-steps (e.g. 'Review course materials', 'Practice coding exercises', 'Complete assigned project').",
        "Urgency & Priority Visual Matrix: Color-coded tags (Urgent, Weekly, Low, Medium) so students tackle critical deliverables first.",
        "Subject-Specific Tagging: Filter tasks by semester course (Database Management Systems, Python, Math, etc.).",
        "Snooze & Reminder Alarms: 10-minute snooze capability and exact Android notifications before due dates.",
        "Integrated Calendar & Analytics: View pending vs completed task velocity to monitor study momentum."
    ], "Zero Missed Deadlines")

    img_tasks = "docs/screenshots/06_tasks_deadlines.jpg"
    if os.path.exists(img_tasks):
        s6.shapes.add_picture(img_tasks, Inches(9.2), Inches(1.8), width=Inches(3.3))

    # ==========================================
    # SLIDE 7: Feature Showcase — Timetable & Attendance
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    add_background(s7)
    add_header(s7, "Timetable Matrix, Pre-Class Alarms & Attendance Safeguard", "FEATURE DEEP-DIVE: ATTENDANCE")

    add_card(s7, 0.8, 1.8, 5.8, 5.0, "Institutional Compliance & Scheduling", [
        "Dynamic Weekly Class Schedule: Maps out daily lectures with subject code, room location (e.g. A-112), and professor details (Dr. sk jha).",
        "Ongoing Lecture Detection: Live status badge indicating ongoing vs upcoming classes.",
        "Pre-Class Notification Alarms: Exact Android system notifications sent 10 minutes prior to lectures.",
        "100% Attendance Safeguard: Tracks attended vs total classes per course. Proactively warns students when attendance drops close to 75% minimum threshold.",
        "Academic Progress Metrics: Displays active courses enrolled, active tasks pending, and daily goal completion in high-visibility stats."
    ], "Never Miss a Lecture or Fall Below 75%")

    if os.path.exists(img_home3):
        s7.shapes.add_picture(img_home3, Inches(7.2), Inches(1.8), width=Inches(2.7))
    if os.path.exists(img_home1):
        s7.shapes.add_picture(img_home1, Inches(10.2), Inches(1.8), width=Inches(2.7))

    # ==========================================
    # SLIDE 8: Technical Architecture & Tech Stack
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    add_background(s8)
    add_header(s8, "Modular Monolith Backend & Native Android Architecture", "SYSTEM ARCHITECTURE")

    add_card(s8, 0.8, 1.8, 3.6, 5.0, "Mobile Client (Android)", [
        "Framework: React Native 0.88 + Expo SDK 58",
        "Navigation: Expo Router (file-based routing)",
        "Language: TypeScript (100% strict mode)",
        "Server State: TanStack Query v5",
        "Client State: Zustand",
        "Secure Storage: Expo SecureStore (Android Keystore)",
        "Animations: React Native Reanimated 4.7"
    ], "High Performance & Smooth 60 FPS")

    add_card(s8, 4.8, 1.8, 3.6, 5.0, "Backend API (FastAPI)", [
        "Runtime: Python 3.12+ (Modular Monolith)",
        "Framework: FastAPI with Pydantic v2",
        "ORM: SQLAlchemy 2.0 Async (asyncpg driver)",
        "Migrations: Alembic (Revisions 001 -> 017)",
        "Security: Argon2id password encryption",
        "Email Relay: Google Apps Script Webhook on HTTPS Port 443 (Zero SMTP block)"
    ], "Rock-Solid & Scalable")

    add_card(s8, 8.8, 1.8, 3.7, 5.0, "Cloud & Database", [
        "Database: Cloud PostgreSQL 16 (Render)",
        "AI Gateway: Google Gemini API (gemini-3.1-flash-lite / 3.8-flash)",
        "Admin Console: React 19 + Vite 6 (Hosted on Vercel)",
        "Mobile Deployment: Expo Application Services (EAS Build - Build 3 Standalone APK)",
        "Infrastructure: Render Web Service + Vercel SPA"
    ], "High Availability & Modern Cloud")

    # ==========================================
    # SLIDE 9: Security, Privacy & Token Architecture
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    add_background(s9)
    add_header(s9, "Defense-in-Depth Security & Student Privacy Guarantee", "SECURITY ARCHITECTURE")

    add_card(s9, 0.8, 1.8, 5.6, 5.0, "Data Protection Standards", [
        "Zero Client API Keys: The Android mobile app contains NO Gemini API keys, NO database credentials, and NO secret signing tokens. All AI traffic is mediated through backend /api/v1/ai/* routes.",
        "Argon2id Password Hashing: State-of-the-art password security resistant to GPU cracking.",
        "Hardware Android Keystore: JWT access tokens (15m expiry) and refresh tokens (30d) are stored exclusively in hardware-backed Expo SecureStore, never in plaintext AsyncStorage.",
        "Application-Level Tenant Isolation: Every query enforces user ownership (WHERE user_id = :current_user_id), preventing IDOR cross-tenant data leaks.",
        "Secure Password Recovery: 6-digit verification code delivered via HTTPS webhook relay directly to Gmail; no auto-filling or response leaking.",
        "Privacy Policy Compliant: Fully verified for Google Play Store safety standards (No selling of student data)."
    ], "Enterprise Security on Student Hardware")

    if os.path.exists(img_login):
        s9.shapes.add_picture(img_login, Inches(7.0), Inches(1.8), width=Inches(2.8))
    if os.path.exists(img_tasks):
        s9.shapes.add_picture(img_tasks, Inches(10.1), Inches(1.8), width=Inches(2.8))

    # ==========================================
    # SLIDE 10: Business Model & Monetization Strategy
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    add_background(s10)
    add_header(s10, "Student Adoption Strategy & Future Monetization Model", "BUSINESS & MONETIZATION")

    add_card(s10, 0.8, 1.8, 3.6, 5.0, "Phase 1: 100% Free Adoption", [
        "App is currently running in 100% Free Mode for all university students.",
        "Zero paywalls or friction during student beta testing and campus rollout.",
        "Objective: Rapid organic student onboarding, word-of-mouth growth, and student retention.",
        "Monetization Gate is switchable in 1-click via the Admin Panel."
    ], "High Growth & Viral Onboarding")

    add_card(s10, 4.8, 1.8, 3.6, 5.0, "Tier 1: Student Standard (₹0)", [
        "Monthly Price: ₹0 / month (Free forever)",
        "Included Features:",
        "100 Notes creation limit",
        "5 University Subjects",
        "50 Daily AI Queries (Gemini Flash-Lite)",
        "Basic Pomodoro Focus Timer",
        "Timetable & Attendance tracking"
    ], "Essential Academic Baseline")

    add_card(s10, 8.8, 1.8, 3.7, 5.0, "Tier 2: StudyMate Pro (₹199)", [
        "Monthly Price: ₹199 / month (Configured in DB)",
        "Included Features:",
        "Unlimited Notes & Document Uploads",
        "Unlimited University Subjects",
        "500 Daily AI Queries",
        "Priority High-Intelligence AI (Gemini 3.8 Flash)",
        "Exam Predictor & Advanced Quizzes",
        "Promotional Campus Coupons (CAMPUS50, EXAMPREP100)"
    ], "Power Learning & Exam Prep")

    # ==========================================
    # SLIDE 11: Product Roadmap & Future Milestones
    # ==========================================
    s11 = prs.slides.add_slide(blank_layout)
    add_background(s11)
    add_header(s11, "Strategic Roadmap: From Beta Launch to Campus Ecosystem", "PRODUCT ROADMAP")

    add_card(s11, 0.8, 1.8, 3.6, 5.0, "Completed Milestones", [
        "Phase 1: Core Academic Engine (Subjects, Notes, Tasks, Flashcards, Timetable, Exams).",
        "Phase 2: Super Admin Web Console (AI Governance, Remote Config, Telemetry, Subscriptions).",
        "Phase 3: Production Standalone APK (Build 3 with 45s cold-start timeout & secure Gmail OTP relay)."
    ], "Production Ready")

    add_card(s11, 4.8, 1.8, 3.6, 5.0, "Upcoming Milestones (Q1 2027)", [
        "Google Play Store Release: Production Android App Bundle (.aab) submission.",
        "Offline Sync & SQLite Caching: Review flashcards and Cornell notes during campus commute without active internet.",
        "Biometric Authentication: Fingerprint & Face Unlock via Expo LocalAuthentication."
    ], "Market Launch")

    add_card(s11, 8.8, 1.8, 3.7, 5.0, "Long-Term Vision (Q2-Q3 2027)", [
        "Campus Study Rooms: Real-time peer focus rooms with shared Pomodoro timers.",
        "University LMS Integration: 2-way sync with Canvas, Moodle, and Google Classroom.",
        "Voice AI Study Buddy: Real-time audio study dialogue using Gemini Live Multimodal API."
    ], "The Future of Learning")

    # ==========================================
    # SLIDE 12: Summary, Live Links & Demo
    # ==========================================
    s12 = prs.slides.add_slide(blank_layout)
    add_background(s12)
    add_header(s12, "Summary, Download Links & Contact Information", "LIVE DEMO & LINKS")

    add_card(s12, 0.8, 1.8, 5.8, 5.0, "Key Presentation Takeaways", [
        "Production-Grade Architecture: Built from scratch with zero legacy debt, following modern layered design patterns.",
        "Live Android APK: Verified on real Android hardware with ultra-fast responsiveness.",
        "Google Gemini Integration: Real, working LLM responses tailored for college syllabi.",
        "Institutional Alignment: Real timetable and attendance tracking solving direct student pain points.",
        "Direct Download Link: https://study-mate-ai-android-apk.vercel.app/download",
        "GitHub Repository: https://github.com/Anmolkumar108/StudyMate-AI-Android-APK",
        "Public Privacy Policy: https://study-mate-ai-android-apk.vercel.app/privacy.html"
    ], "Study Smart... Grow Smart.")

    add_card(s12, 7.0, 1.8, 5.5, 5.0, "Presenter & Developer Profile", [
        "Lead Developer & Founder: Anmol Singh",
        "Role: Full-Stack Mobile & AI Systems Architect",
        "Core Stack: React Native, Expo, Python, FastAPI, PostgreSQL, Gemini AI",
        "Email Support: Contact via Admin Desk / Akanmolbhumihar09@gmail.com",
        "Project Repository: Anmolkumar108 / StudyMate-AI-Android-APK",
        "",
        "Thank you for attending the presentation!",
        "Questions & Live Demonstration Welcomed."
    ], "Crafted with Passion for Higher Education")

    output_path = "StudyMate_AI_Official_Presentation.pptx"
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    create_presentation()
