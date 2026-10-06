const {spawnSync}=require('node:child_process');
const files=['00000000_baseline','20260915_roster_canonical','20260915_private_board','20260917_admin_content_owners','20260918_restore_drill','20260930_role_alignment','20260930_staff_view_only','20260930_admin_people','20261006_scout_record_guard','20261007_restore_2948_teams'];
const env={...process.env,PGLITE_MODULE:process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite')};
for(const file of files){const r=spawnSync(process.execPath,['migrations/'+file+'.local-test.cjs'],{env,stdio:'inherit',timeout:120000});if(r.status!==0)process.exit(r.status||1);}
