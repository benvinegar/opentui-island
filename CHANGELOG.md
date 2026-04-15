# Changelog

All notable user-visible changes to this project are documented in this file.

## [Unreleased]

### Added

### Changed

### Fixed

## [0.4.0] - 2026-04-15

### Added

- Added a shared `createIslandController(...)` API for mount, props, ready state, bridge events, commands, and frame sync across host runtimes.
- Added shorter canonical adapter APIs such as `createPiTuiSurface(...)`, `createPiTuiModal(...)`, `InkSurface`, and `createSidecarHost(...)`.

### Changed

- Reworked the public naming so the package no longer repeats `OpenTui` in the primary API surface, while keeping the older names as compatibility aliases.
- Simplified the README quick start to show direct Ink and `pi-tui` integration first, with the controller story moved into the API guide for advanced usage.

### Fixed

- Added packaging verification to CI so publish-surface regressions are caught before release.

## [0.3.0] - 2026-04-10

### Added

- Added a generic island event bridge for host-to-island commands and island-to-host result events.
- Added bridge-driven examples for `pi-tui`, including hosted result flows that return saved text to the Node host.
- Added ready-state and failure-handling coverage around the Bun sidecar host.

### Changed

- Versioned the host-side sidecar protocol to make host and sidecar compatibility explicit.
- Improved the README path from install to first working render.

### Fixed

- Made bridge event delivery deterministic, including safer listener and waiter behavior around teardown.
- Hardened Ink mouse support and sidecar failure handling.

## [0.2.0] - 2026-04-08

### Added

- Added an Ink adapter alongside the existing `pi-tui` host adapter support.
- Added a Bun sidecar host model so Node-based host apps can embed OpenTUI islands.
- Added Node integration coverage proving the packaged adapters work under real Node hosts.

### Changed

- Renamed the package to `opentui-island`.
- Aligned the Ink surface naming with the `pi-tui` adapter surface.
- Tightened README docs around the public package APIs and publish-ready usage.

### Fixed

- Prepared the package for npm publishing with a safer publish surface and metadata cleanup.

## [0.1.0] - 2026-04-08

Note: `0.1.0` was published to npm before the changelog was backfilled.

### Added

- Added the initial offscreen OpenTUI host runtime and frame-diff utilities.
- Added the first `pi-tui` surface adapter and interactive host demo.
- Added repository linting, formatting, and pre-commit checks for the initial OSS maintenance surface.

### Changed

- Established the initial public README and package structure for embedding OpenTUI islands in terminal hosts.

### Fixed
