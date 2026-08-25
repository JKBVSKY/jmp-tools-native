# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.0] - Picking Subsection Engine and Workflow Upgrade - 2026-08-25

### Added
- New picking architecture based on shared session engine + thin domain logic.
- Added a new state-aware calculator header title that robustly reflects the current calculator state in real time, giving users clear context during the entire session flow.
- Added notifications system.
- Added statuses and attribution to reported items.
- Added tab filtering for pallet finder.
- Added simple mode for score simulating component.
- Added a schedule component, introducing the OCR scanner feature that scans and turns the values from the scan into the table.
- Added interactive warehouse map with pan, pinch-to-zoom, double-tap zoom, inertial scrolling, and zone focus animation.
- Added Mapping screen to create, edit, and filter pallet location records, with “Show on map” navigation to the warehouse map.
- Added timetable component.
- Added settings screen component.
- Moved active session statistics to the navigation section for better space management.

### Changed
- Optimized the app! See below for details.
- Moved the XP progress bar into the new calculator header so progression feedback stays consistently visible and aligned with the current session state.
- Polished and reorganized hooks across the calculator flow by separating responsibilities, extracting shared logic, and improving module structure for better maintainability and scalability.
- SDK updated to 54.

### Optimized
- **Firestore Architecture:** Migrated the global leaderboards system from high-cost client-side aggregation (`collectionGroup` queries) to a highly efficient "Single-Document per Month" model (`leaderboards/YYYY-MM`). Reduced Firestore read queries by 99.9%.
- **Ranking Engine:** Moved leaderboard sorting and updates to server-side atomic operations using Firestore `runTransaction` inside `Results.jsx` and `PickingResults.jsx` for both truck loading and picking subsections (P01-P28).
- **User Progression:** Refactored XP, total XP, and achievements tracking. Eliminated historical session log parsing on app launch; player stats are now incremented directly in the user profile document using `FieldValue.increment`.

## [Notification Module & Settings Synchronization Overhaul]

### Enhancements (UX/UI):
* **Switch Debouncing:** Introduced a temporary loading/disabled state (`isSavingNotification`) that locks the notification toggle during active database writes. This ensures perfectly smooth switch animations and prevents network congestion from rapid multi-clicking.
* **Hidden Developer Test Mode:** Added a hidden developer testing feature bound to the month title (marked with a 🧪 emoji). It allows immediate confirmation of exact scheduled push notification trigger times without having to wait for a real shift.

### Fixed
* **Settings Desynchronization:** Removed conflicting local `AsyncStorage` logic from the timetable component, establishing `Firestore` as the absolute single source of truth. The notification toggle and time preference now properly persist when re-entering the screen.
* **Native Crash Elimination:** Implemented strict type formatting and fallbacks (`parseInt`) before passing the calculated fire time to `Expo Notifications`. This completely prevents application-to-desktop native crashes caused by invalid date objects or `NaN` values.
* **Navigation Race Conditions:** Secured asynchronous `useEffect` database calls with component unmount cleanup flags (`active`/`cancelled`). Rapidly navigating back and forth between screens no longer triggers background crashes.
- **Profile Auto-Login:** Fixed a critical bug where user profiles (XP, levels, and stats) would reset to Level 1 on application startup. Ensure profile data is fetched completely during the auto-login state.
- **Data Persistence:** Fixed data overwriting by replacing destructive `setDoc` calls with safe `updateDoc` updates during push token synchronization, protecting user achievements and metrics from being wiped out.
- **Nested Fields:** Fixed malformed Firestore document keys by properly normalizing nested update paths instead of injecting raw dotted-string fields into the user document.
- **App Stability:** Resolved critical navigation crashes (Race Conditions) caused by switching screens (e.g., to `more.jsx`, `Profile.jsx`, or `leaderboards.jsx`) before the Firestore user profile fetch was fully completed.
- **Global Loading Guard:** Implemented a global application layout guard in `app/_layout.jsx` that blocks the navigation tree and displays a centered `<ActivityIndicator />` until the user profile `isLoading` flag turns false.
- **State Cleanup:** Upgraded `context/UserProfileContext.jsx` with an `isMounted` flag and `requestId` tracking to cancel background Firestore async calls on unmounted components.
- **Fail-Safe UI Rendering:** Secured all user-dependent data nodes across key dashboard widgets, score history, and leaderboards using optional chaining (`user?.id`, `profile?.level`).

### Other fixes
- Fixed a React list key warning in the active truck list by assigning the key to the top-level rendered truck item, preventing unstable list re-renders when adding the first transport during a session.
- Fixed keyboard avoidance in the new/edit transport modals so the modal stays visible above the on-screen .keyboard and its content scrolls correctly while typing.
- Fixed app crashing during truck loading session.
- Fixed a bug causing invalid level data being saved to firestore.
- Fixed several minor bugs.

## [0.10.0] - 2026-07-07

### Added
- Added a new active session modal with detailed information for a clearer overview of the current work session.
- Added a reporting flow that allows users to create and submit reports directly from the app.
- Added report management tools so users can review and organize their reports more easily.

## [0.9.0] - 2026-06-30

### Added
- Added support for connected shops in truck create/edit flows, allowing users to assign two shops to a single transport when needed.
- Added expandable advanced fields in the add/edit truck modals, making the forms cleaner by hiding less frequently used inputs until needed.
- Added improved input focus behavior for the pallets field when the “in progress” switch is turned off.
- Refactored the calculator flow into shared logic and layout, creating the foundation for a future picking section calculator.

### Changed
- Polished the UI across multiple components with updated paddings, card styles, button sizes, and small animation improvements.
- Added `navBackground` styling to top headers and bottom action containers so they integrate better with the navigation areas.
- Completely reworked `More.jsx` from a modal with a dropdown menu into a full component that presents menu actions as cards.
- Redesigned the add/edit truck modals for a cleaner and more flexible interaction flow.
- Reworked the achievements system core logic to improve calculation reliability and make achievement handling more consistent.
- Updated `Profile.jsx` to fetch aggregated data directly from the database instead of relying on incremental local accumulation from session results.
- Refactored truck-loading calculator flow so the architecture is now reusable for upcoming warehouse sections, especially picking.

### Fixed
- Fixed an issue where `startTime` could become negative.
- Fixed a bug in the forced finish time adjustment modal that blocked users from selecting valid times.
- Fixed achievement calculation and unlock logic so all achievements are now awarded correctly.
- Fixed a stale XP remaining issue that could persist after a session ended with forced finish time logic.

## [0.8.0] - 2026-06-14

### Added
- Added Firebase anonymous authentication for guest sessions, replacing the local guest-id flow.
- Added current-month ranking on the dashboard for signed-in users.

### Changed
- Refactored the app layout for better web support, including a desktop sidebar and wider content shells.
- Redesigned the main dashboard for web with an avatar shortcut to the profile screen and improved responsive spacing.
- Updated profile and score history screens to behave better on large screens and web layouts.
- Improved auth screens and modals so they stay centered and readable on web.
- Updated the web Firebase deployment script to publish both Hosting and Firestore rules.

## [0.7.0] - 2026-04-05

### Added
- Added a new user name edit function so users can update their profile name directly in the app.
- Updated profile-related screens to reflect the changed name instantly after saving.

## [0.6.1] - 2026-04-05

### Fixed
- Corrected logic for startTime and forcedFinishTime.
- Resolved an issue with saving dates in scoreHistory.
- Fixed a navigation bug on the login screen preventing users from returning to the previous page.
- Applied minor translation corrections.
- Restored proper functionality of input elements on the web platform.

### Changed
- Redesigned Init.jsx component for cleaner structure and improved maintainability.
- Revamped the dashboard for a more intuitive experience.
- Updated the guest interface with a new design.
- Tweaked scoreHistory UI for better clarity and layout.
- Overhauled the entire app layout for full responsiveness—content now scales correctly on small devices.

---

## [0.6.0] - 2026-03-23

### Added
- Improved UX in the statistics component by showing a loading spinner overlay until all the data is fetched from the database.
- Bottom navigation (replaced side nav) for better UX and faster tab switching.
- Dashboard monthly stats view: current month performance, level and key metrics.
- Leaderboard feature showing users, rank positions, and pallets/hour score.

### Fixed
- Achievements behavior tracked as known issue for 0.6.1/0.6.2.
- `Init.jsx` needs logic improvements (target 0.6.1).
- XP caching issue still exists, planned fix in 0.6.1.

### Changed
- The old side navigation bar got removed and replaced with the new bottom bar navigation.
- UI padding updates in multiple components for cleaner spacing and layout consistency.

---

## [0.5.0] - 2026-03-07

### Added
- Enhanced score history: monthly view with previous/next month controls and a horizontally scrollable chart.
- Improved UX on session save by showing a loading spinner overlay and temporarily disabling the save button.
- Added safety flow when finishing a truck: if pallets are marked as “in progress”, user must enter final pallets count before the truck can be completed.
- Automatically focus pallets input in NewTransportModal, EditTruckModal, and the pallets confirmation modal so the keyboard opens and user can type immediately.

### Changed
- Score history is now stored per user in Cloud Firestore instead of local storage, syncing sessions across devices and keeping history tied to the logged-in account.
- Updated launcher icon with more refined design.
- Adjusted layout in NewTransportModal and EditTruckModal by swapping the positions of two form elements for a more intuitive input order.
- Score history summary now reflects only sessions from the selected month, enabling month‑to‑month performance comparison.
- Enhanced the design of the time converter component.

---

## [0.4.1] - 2026-02-16

### Fixed
- `forcedFinishTime` no longer resets to `null` on app restart
- Android launcher icon cropping issue resolved
- XP accrual after forced finish (caching phantom time) eliminated

### Changed
- Updated launcher icon with refined design

---

## [0.4.0] - 2026-02-11

### Added
- 6 new achievements to unlock.

### Changed
- App fully translated to Polish (English will be added in a later release).
- New transport and edit transport modals slightly redesigned.

### Removed
- Dropdown menu from new transport and edit transport (removed due to bugs).

---

## [0.3.0] - 2026-01-07

### Added
- **Automatic Session Timeout**: Users can now set a forced finish time before starting work, preventing forgotten manual finishes
- **Time-based Session Capping**: Elapsed time automatically stops at the user-defined deadline, preventing inflated session durations
- **Automatic Truck Finalization**: Active trucks are automatically moved to history when forced finish deadline is reached
- **XP Deadline Enforcement**: XP rewards are capped at the forced finish time, preventing overflow from background time
- **Visual Auto-finish Indicator**: Clear on-screen display showing when the session will automatically finish
- **Offline XP Protection**: Properly handles offline XP awards with deadline enforcement when app returns from background
- **Session State Lock**: Session becomes read-only after forced finish, preventing accidental resume

### Fixed
- **Session Integrity Issue**: Fixed bug where users could forget to manually finish sessions, resulting in unreliable scoring and massive XP overflow (previously could log 72+ hours unintentionally)
- **XP Accumulation Bug**: Fixed XP being awarded for extended offline periods after user left the app
- **Deadline Accuracy**: Ensured elapsed time respects forced finish deadline even when app is in background

### Technical
- Implemented `checkAndEnforceForcedFinish()` callback for robust deadline enforcement
- Added app foreground detection with `useAppState` hook for reliable state checks
- Improved background session state management with `AsyncStorage`

---

## [0.2.0] - 2025-12-10

### Added
- Added "Pallets in progress" toggle to New Transport form, allowing creation of transports without known pallet count.

### Changed
- Reduced padding of containers to increase visible workspace in the app.
- Improved the design of the Results component.
- Improved the design of the TimeConverter component.

---

## [0.1.0] - 2025-12-08

### Added
- Redesigned truck item with collapsible UI and real-time time tracking
- TimeConverter component with decimal/standard time conversion
- XP rewards system with animated notification
- Robust XP reward system with online and offline caching
- Profiles, level system, and achievements system

### Fixed
- Corrected master_loader level progress and speed_hunter per-session tracking
- Resolved dependency issues and removed invalid edgeToEdgeEnabled property
- Fixed dependency issues and stabilized app on Expo SDK 51

### Technical
- Initial project setup with Expo SDK 51
- Core architecture and navigation structure established