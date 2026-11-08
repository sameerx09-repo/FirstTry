# Repeatable local rehearsal

1. Start `pnpm dev`; open the developer and moderator workspaces in separate browser profiles.
2. Open the Android host with port 3001 reversed to the API; onboard as a guest.
3. Play Color Clash, exit, save it and submit optional feedback. Play Decision Spinner using only local choices.
4. Run CLI init/validate/login/deploy for a unique slug. The deployment is private and absent from public catalog.
5. Sign into the Android host as the developer. Open the printed firsttry://preview/<app-id>?version=<version-id> intent. An unrelated developer is denied.
6. Submit in the developer dashboard. Sign into the host as moderator for functional review; never execute uploaded scripts inside the dashboard origin.
7. Approve with a reason in admin. Publish in developer UI. Refresh the consumer catalog and launch the approved bundle on Android.
8. Complete Tiny Quiz and verify actual Android SDK events in the seed owner's analytics. Browser mock SDK events do not count as this verification.
9. Upload a changed semantic version. Confirm publication is denied until reviewed. Approve, publish and verify new sessions use it while the existing session stays pinned.
10. Publish the older eligible approved version to roll back. Rejected/disabled versions remain ineligible.
11. Report the app, observe the moderator queue, then suspend it. New launches fail immediately; an active host session closes on the next renewal check.
12. Repeat with tampered hashes, forged grants and invalid archives; use the automated fixture suite rather than publishing malicious content.
13. Review audit and actual session/feedback records. Test block/unblock, guest login migration and account/app-data deletion.

Automated equivalents: API integration/security tests, browser journeys and Android instrumentation. Read TEST_RESULTS.md for which steps were actually executed in each environment.
