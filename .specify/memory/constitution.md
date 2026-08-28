<!--
Sync Impact Report:
- Version: 0.0.0 → 1.0.0
- Ratification: Initial ratification for Wallpaper Changer Suite
- Added sections:
  - Core Principles (I. Self-Contained Modularity, II. CLI & Automation-First Interface, III. High-Fidelity Image Processing & Widescreen Standards, IV. Resilient Scraping & Fault Tolerance, V. Privacy & Local Session Isolation)
  - Quality & Testing Standards
  - Development Workflow & Windows Integration
  - Governance
- Removed sections: None
- Deferred items: None
-->

# Wallpaper Changer Suite Constitution

## Core Principles

### I. Self-Contained Modularity
Every wallpaper source module (`anonyig/`, `facebook/`, `santabanta/`, `4kwallpapers/`, `wallhere/`) MUST be completely self-contained with its own scrapers, database manager, and image processing logic. Cross-module dependencies are prohibited to ensure that issues in one source provider do not impact other changers.

### II. CLI & Automation-First Interface
Every module MUST expose clear CLI commands and flags (e.g. `--status`, `--login`, target queries) supporting both interactive execution and non-interactive scripted invocations. All automated runners (`.bat`, `.vbs`, PowerShell) MUST handle errors gracefully without hanging background or headless sessions.

### III. High-Fidelity Image Processing & Widescreen Standards
Wallpapers processed through Sharp or native image pipelines MUST preserve aspect ratios, utilize aesthetic widescreen blur side-fills when adapting non-16:9 images, and maintain high visual fidelity. Raw source images must never be stretched or distorted.

### IV. Resilient Scraping & Fault Tolerance
Web and API scrapers MUST implement defensive scraping practices: network timeouts, fallback selector chains, rate-limit awareness, and structured logging. Transient network or scraping failures MUST log actionable warnings without crashing scheduler processes.

### V. Privacy & Local Session Isolation
Authentication tokens, browser session cookies (`cookies.json`), downloaded raw image directories, and runtime database caches MUST strictly remain local and excluded via `.gitignore`. No private credentials or session state shall be committed to version control.

## Quality & Testing Standards

All modules MUST maintain unit tests leveraging Node.js native test runner (`node:test`). Tests MUST validate:
- Database CRUD and cycle tracking mechanisms.
- Image transformation pipelines (sharp canvas calculations and blur filling).
- Scraper parser routines against static fixtures.
- Test suites MUST execute clean with zero unhandled promise rejections.

## Development Workflow & Windows Integration

- Changes affecting right-click context menu scripts (`install_context_menu.ps1`) or scheduled task scripts (`run_silent.vbs`) MUST be tested for execution under standard and elevated Windows privileges.
- New wallpaper providers MUST follow the established project directory conventions and implement standard lifecycle interfaces (`wallpaper.js`, `scraper.js`, `db.js`, `image_processor.js`, and test fixtures).

## Governance

This Constitution serves as the source of truth for architectural constraints and quality standards across all Wallpaper Changer Suite modules.
- **Amendments**: Any change or addition of principles requires a semantic version bump and documentation in the Sync Impact Report.
- **Compliance**: All proposed features, spec definitions (`/speckit.specify`), and plans (`/speckit.plan`) MUST align with these core principles.

**Version**: 1.0.0 | **Ratified**: 2026-08-29 | **Last Amended**: 2026-08-29
