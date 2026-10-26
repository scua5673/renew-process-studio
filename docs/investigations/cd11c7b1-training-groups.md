# Training program disappearance investigation

Support report: `cd11c7b1-4c98-4083-815b-4460d852c261`.

An existing training program disappeared from view while changing groups. The report's 3.177 Windows installed Edge client recorded repeated `StorageOwnerChangedError` events. This error also covers a changed source mirror, so these events do not establish an account switch or durable deletion.

This draft claims the report for one investigation. Reproduce using synthetic schedule data, identify the failing read/write/recovery boundary, and retain the original failing evidence before making a fix. Preserve owner isolation, exact-source confirmation, authored training content, and pending recovery data. No customer storage or production app-data writes.

Status: investigating; no recovery or resolution claimed. Merge and production promotion require the existing CI, staging, and publication checks.
