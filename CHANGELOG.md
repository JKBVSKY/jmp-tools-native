# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-08

### Added
- Redesigned truck item with collapsible UI and real-time time tracking
- TimeConverter component with decimal/standard time conversion
- XP rewards system with animated notification
- Robust XP reward system with online and offline caching
- Profiles, level system, and achievements system
- ...and more!

### Fixed
- Corrected master_loader level progress and speed_hunter per-session tracking
- Resolved dependency issues and removed invalid edgeToEdgeEnabled property
- Fixed dependency issues and stabilized app on Expo SDK 51
- ...and more!

### Technical
- Initial project setup with Expo SDK 51
- Core architecture and navigation structure established

---

## [0.2.0] - 2025-12-10

### Added
- Added "Pallets in progress" toggle to New Transport form, allowing creation of transports without known pallet count.

### Changed
- Reduced padding of containers to increase visible workspace in the app.
- Improved the design of the Results component.
- Improved the design of the TimeConverter component.

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

## Unreleased

### Added
- (New features in development will be listed here)

### Fixed
- (Bug fixes in development will be listed here)

### Changed
- (Changes to existing functionality will be listed here)