# StudyMate AI — UI/UX Design System & Mobile Guidelines

## 1. Visual Design Philosophy: "Calm, Focused & Academic"

StudyMate AI avoids cluttered, juvenile gamification and generic dashboard templates. It delivers a **premium, refined, and distraction-free academic workspace** designed for sustained intellectual focus. 

Key visual principles:
* **Generous Whitespace & Clear Hierarchy**: Reduces cognitive fatigue during prolonged study sessions.
* **Purposeful Color Accents**: Color is reserved for semantic information (subject differentiation, urgency, mastery status) rather than decoration.
* **OLED-Optimized Dark Mode**: Deep, true dark backgrounds to conserve battery life and prevent eye strain during late-night study.
* **Tactile Haptic Feedback**: Subtle haptic clicks on Android devices when completing tasks or flipping flashcards to provide tangible accomplishment.

---

## 2. Design Tokens & Color Palettes

### 2.1 Color Tokens (Light vs. Dark Theme)

| Token Name | Light Theme Value | Dark Theme (AMOLED) Value | Usage & Semantic Purpose |
| :--- | :--- | :--- | :--- |
| `background.primary` | `#F8FAFC` (Slate 50) | `#0B0F19` (Deep Obsidian) | Root screen background |
| `background.secondary` | `#FFFFFF` (Pure White) | `#131B2E` (Navy Slate) | Card surfaces, modals, bottom sheets |
| `background.tertiary` | `#F1F5F9` (Slate 100) | `#1E293B` (Slate 800) | Input fields, active tab indicators, chips |
| `border.subtle` | `#E2E8F0` (Slate 200) | `#26334D` (Subtle Navy) | Card borders, horizontal dividers |
| `border.focus` | `#6366F1` (Indigo 500) | `#818CF8` (Indigo 400) | Active input focus outlines |
| `text.primary` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Main headings, primary card text |
| `text.secondary` | `#475569` (Slate 600) | `#94A3B8` (Slate 400) | Subtitles, helper text, timestamps |
| `text.tertiary` | `#94A3B8` (Slate 400) | `#64748B` (Slate 500) | Placeholder text, disabled labels |
| `brand.primary` | `#4F46E5` (Indigo 600) | `#6366F1` (Indigo 500) | Primary CTA buttons, active state indicators |
| `brand.accent` | `#0D9488` (Teal 600) | `#14B8A6` (Teal 500) | AI badges, streak flame, positive highlights |
| `status.success` | `#16A34A` (Green 600) | `#22C55E` (Green 500) | Completed tasks, high quiz scores, goal achieved |
| `status.warning` | `#D97706` (Amber 600) | `#F59E0B` (Amber 500) | Due soon, Pomodoro break state, medium review |
| `status.danger` | `#DC2626` (Red 600) | `#EF4444` (Red 500) | Overdue tasks, missed questions, account deletion |

### 2.2 Curated Academic Subject Palette
When students create subjects, they select from 8 carefully balanced, accessible color tags:
* **Indigo**: `#6366F1` (Mathematics / Logic)
* **Teal**: `#14B8A6` (Computer Science / Engineering)
* **Emerald**: `#10B981` (Natural Sciences / Biology)
* **Amber**: `#F59E0B` (History / Humanities)
* **Rose**: `#F43F5E` (Literature / Languages)
* **Violet**: `#8B5CF6` (Physics / Chemistry)
* **Sky**: `#0EA5E9` (Economics / Business)
* **Slate**: `#64748B` (Electives / General)

---

## 3. Typography Scale & Hierarchy

StudyMate AI uses the standard Android system typeface family (`Roboto` / `Inter`) with strict typographic scaling:

| Style Name | Font Size | Line Height | Weight | Letter Spacing | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Display Large` | 32 sp | 40 sp | Bold (700) | -0.5 px | Streak counter, Pomodoro timer display |
| `Headline Large` | 24 sp | 32 sp | SemiBold (600) | -0.25 px | Screen titles (Dashboard, Library) |
| `Headline Medium` | 20 sp | 28 sp | SemiBold (600) | 0 px | Section titles, card modal headers |
| `Title Medium` | 16 sp | 24 sp | Medium (500) | +0.15 px | Task titles, note titles, list items |
| `Body Large` | 16 sp | 24 sp | Regular (400) | +0.5 px | Reading text, note body, AI responses |
| `Body Medium` | 14 sp | 20 sp | Regular (400) | +0.25 px | Secondary card descriptions, subtasks |
| `Label Medium` | 12 sp | 16 sp | Medium (500) | +0.5 px | Badges, tags, bottom navigation labels |
| `Label Small` | 11 sp | 14 sp | Regular (400) | +0.5 px | Timestamps, character counters |

---

## 4. Spacing System & Touch Target Accessibility

* **Base Grid**: Strict 4pt / 8pt spatial grid:
  * `space.xxs`: 2 dp
  * `space.xs`: 4 dp
  * `space.sm`: 8 dp
  * `space.md`: 16 dp (Standard screen margin and card padding)
  * `space.lg`: 24 dp (Section separation)
  * `space.xl`: 32 dp
  * `space.xxl`: 48 dp
* **Touch Targets**: All tappable elements (buttons, icons, checkboxes, list items) must maintain a minimum bounding box of **$48 \times 48\text{ dp}$** to ensure comfortable, error-free tapping according to Android accessibility guidelines.
* **Corner Radius**:
  * Cards & Containers: `16 dp`
  * Buttons & Inputs: `12 dp`
  * Tags & Badges: `8 dp`
  * Round avatars / icons: `999 dp`

---

## 5. Standard Component Guidelines

### 5.1 Buttons
* **Primary Button**: Filled background (`brand.primary`), high contrast text, subtle tap scaling animation (`scale: 0.97`). Height: `52 dp`.
* **Secondary Button**: Outlined with `border.subtle`, surface background. Height: `48 dp`.
* **Ghost / Icon Button**: Transparent background, minimum $48 \times 48\text{ dp}$ hit box.
* **Destructive Button**: Clear crimson accent (`status.danger`) with double-confirmation modal on critical actions (e.g. Delete Account).

### 5.2 Input Fields & Form Controls
* Clean outlined style with subtle label floating or clear top labels.
* Active focus state highlights border with `border.focus`.
* Clear inline validation messages displayed directly beneath the field in `status.danger`.
* Dedicated virtual keyboard configurations:
  * Email fields: `keyboardType="email-address"`, `autoCapitalize="none"`.
  * Password fields: `secureTextEntry={true}`, with eye icon toggle.
  * Search fields: `returnKeyType="search"`.

### 5.3 Bottom Sheets & Modals
* Built using native gesture panning.
* Draggable handle at the top; supports partial snap points (`50%`, `90%`).
* System navigation bar dynamically adapts scrim backdrop.

---

## 6. Motion & Animation Standards

Animations must be subtle, purposeful, and executed on the native UI thread (using `react-native-reanimated`):
* **Duration Principles**:
  * Micro-interactions (taps, toggles, checkboxes): `150ms`
  * Content transitions (modal slides, card expansions): `250ms - 300ms`
  * Complex transitions (3D flashcard flip): `400ms`
* **Easing Curves**:
  * Enter transitions: `Easing.out(Easing.cubic)`
  * Exit transitions: `Easing.in(Easing.cubic)`
* **Reduced Motion Compliance**: Respect Android system accessibility setting `animator_duration_scale`; disable decorative motion when reduced motion is enabled.

---

## 7. State Handling (The Four Pillars)

Every screen and component must explicitly cater to four distinct states:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Loading State: Shimmer skeleton placeholders mirroring final layout │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Empty State: Contextual vector illustration + title + 1 primary CTA │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Error State: Clear non-technical message + "Retry" button           │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Offline State: Subtle banner: "Offline mode. Showing cached data."  │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Loading State**: Never display full-screen blank spinners. Use shimmering skeletons that mimic the exact shape of content cards.
2. **Empty State**: When a student has zero notes or assignments, display a contextual icon, encouraging copy (e.g. "No assignments due — you're completely caught up!"), and a prominent action button ("+ Add Assignment").
3. **Error State**: Gracefully catch network or server errors. Provide a human-readable diagnosis and a prominent "Try Again" action button.
4. **Offline State**: Maintain interactive readability of previously fetched notes, timetable, and flashcards. Display an unobtrusive top pill indicator: *"Offline Mode — Changes will sync when connected"*.

---

## 8. Android-Specific Platform Patterns

* **Edge-to-Edge Layout**: Fully translucent Android status bar and navigation bar using Expo `SystemUI.setBackgroundColorAsync('transparent')`.
* **Hardware Back Button**:
  * When a modal or bottom sheet is open, pressing the physical Android back button closes the sheet first, rather than navigating away from the screen.
  * On the root Dashboard tab, pressing back prompts a standard Android double-tap confirmation ("Press back again to exit").
* **Android Notification Channels**:
  * `studymate_classes`: High importance, heads-up banner, custom chime.
  * `studymate_deadlines`: Urgent importance, vibration enabled.
  * `studymate_daily`: Default importance, gentle chime.
  * `studymate_pomodoro`: Ongoing foreground notification displaying real-time countdown.
