# Public Android release checklist

- [ ] Independent Android/WebView/backend security review completed and blocking findings resolved.
- [ ] Production API, TLS, pinned signing keys, key rotation and storage/worker isolation configured.
- [ ] Verify current target SDK and Play policies at submission; local SDK 35 is not a future policy guarantee.
- [ ] Acquire domain and verify App Links with actual release certificate fingerprints.
- [ ] Sign release artifact through the official process; remove local accounts/debug trust and satisfy production startup gate.
- [ ] Publish truthful privacy/terms, Data Safety, content rating, target audience and functioning account deletion.
- [ ] Staff content review, user reports, block controls, takedown, incident response and appeals.
- [ ] Give reviewers working access and at least three usable mini-apps; demonstrate no developer APK/native payload installation.
- [ ] Test physical devices, low memory, multiple OS/WebView versions and failure recovery.
- [ ] Describe dynamic reviewed web content and the host's discovery value accurately.

Policy references from the master spec must be reverified at submission. This checklist does not establish approval.
