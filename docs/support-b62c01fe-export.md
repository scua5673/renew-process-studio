# Support b62c01fe: custom pitch multi-page video export

Report: `b62c01fe-565c-42f2-9b41-10249ea53b9f`.

Imported pitch photos could leave default-pitch margins in a multi-page video, and cold local image reads could complete after a page was encoded. A synthetic 4:3 photo reproduced the margins in all 72 frames; a 500 ms delay around genuine local reads reproduced missing photos in the first two pages. A naturally loaded 16:9 photo was a passing control.

The exporter now waits for each local photo before SVG serialization and uses a centered 16:9 crop within the actual rendered photo bounds. The pitch-framing wrapper preserves that photo path. A missing or unreadable photo aborts export rather than silently encoding the default pitch. The editor UI and authored page, image, and animation data are preserved.

Validation uses synthetic local photos, the real exporter and encoders, saved video bytes, frame pixel checks, full authored-data comparisons, and missing-photo failure handling. It retains a photo's own internal border. Chromium export checks, a real MediaRecorder fallback export, missing-photo handling in both engines, and 4,355 unit tests passed. WebKit's generated file passed cross-decoding after its native test decoder rejected the codec; the native rejection remains recorded separately. The regression cross-decodes that same Blob only for this unsupported-codec error, retaining all pixel assertions.

Status: 3.178 candidate; exact-commit CI, staging publication and production promotion pending. No production-data changes or report status changes. Real iPad crash resolution is outside this report's verified scope.

The first candidate CI exposed a fixture error on Linux WebKit: MediaRecorder is absent and the existing Linux WebCodecs safety guard disables its encoder. The app correctly reports unsupported video and cleans up; the fixture had waited for a file that cannot be created. Preserve this first failure. Explicit unsupported-environment checks cover the notice, no file, cleanup, original-data preservation, and native photo readiness/SVG/canvas rendering. They are recorded separately from actual video encoding; capable environments retain the full real-video assertions.
