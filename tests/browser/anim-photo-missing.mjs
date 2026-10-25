// Reuse the real export fixture; a valid reference deliberately has no local IDB picture.
process.env.PS_PHOTO_MISSING='1';
await import('./anim-photo-pages.mjs');
