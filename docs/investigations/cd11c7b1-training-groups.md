# Training program disappearance investigation

Support report: `cd11c7b1-4c98-4083-815b-4460d852c261`.

An existing training program disappeared from view while changing groups. The report's 3.177 Windows installed Edge client recorded repeated `StorageOwnerChangedError` events. This error also covers a changed source mirror, so these events do not establish an account switch or durable deletion.

Read-only comparison of the available saved versions found the authored programs intact. Sessions had moved from one group to another, which correctly excluded them from the previous group's filter. Stored history cannot establish the contents of unsent device drafts or every intermediate edit.

The synthetic UI reproduction exposed a separate defect: after changing a session's group and closing the detail sheet, the old filter's notice retained its previous count. `syncViews()` now refreshes that notice from the current schedule without rebuilding the group selector. It also explains how many sessions belong to other groups and offers a view-only All action.

Preserve owner isolation, exact-source confirmation, authored training content, and pending recovery data. No customer storage or production app-data writes. Customer snapshot contents are excluded from this repository and all synthetic fixtures. The regression checks actual group controls, unchanged authored programs across memory/mirror/IDB/fixture-server/reload, and zero schedule writes from view controls at phone, tablet, and desktop widths in Chromium and WebKit.

The first published-code verification stopped on mobile reload because the test read the body class before asynchronous phone startup opened Today, then tried to click a hidden desktop hub. The test now waits for app readiness and resolves the visible navigation at click time. All authored-data, server-ACK, reload, view-only-write, and geometry assertions remain unchanged; the original failure is retained.

Status: the runtime fix is on staging. Production promotion requires the corrected exact-commit CI and published-code verification. The initial failing evidence is retained privately. This change does not claim to recover unsent content or resolve physical iPad termination.
