# Repeated storage-capacity warning investigation

Support report: 095358c2-8c11-497e-a5ed-b95e6597d762.

The report describes a recurring capacity warning on an installed desktop browser. Its privacy-filtered support diagnostic contains a quota error and three storage errors, but no precise storage stage or size metadata. Existing protections and aggregate event labels do not yet establish whether the localStorage mirror or IndexedDB failed.

Read the corresponding minimal event metadata, then reproduce with synthetic originals before changing behavior. Preserve authored content, owner and exact-source guards, pending recovery data, and real failed-save warnings. No production app-data or customer browser-store writes. No customer contents belong in this document, source repository, or fixtures.

Physical iPad termination remains unverified. Investigate only new evidence or concrete untested hypotheses; successful synthetic boot tests alone do not establish a physical-device fix.

Status: investigation claimed; no runtime change or resolution claim.
