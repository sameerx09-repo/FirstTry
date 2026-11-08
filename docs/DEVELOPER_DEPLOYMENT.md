# Developer deployment experience

The local deployment path is implemented. A hosted Vercel-style Git service is a separate, unfinished layer: no Git account connection, cloud build worker, automatic push deployment or public developer registration is available yet.

## First deployment

An operator assigns a developer account in the local edition. The developer signs into the developer portal and Android host with that account. In this repository:

```powershell
pnpm cli init hello-mini --vite
pnpm --dir hello-mini install
# Supply your assigned account password for login only.
$env:FIRSTTRY_PASSWORD = '<your-password>'
pnpm cli login developer@firsttry.local
Remove-Item Env:FIRSTTRY_PASSWORD
pnpm cli deploy hello-mini
```

Deploy runs the configured build locally, validates the output, creates the app listing if necessary, uploads the immutable bundle and prints a private Android preview link. It saves a deployment receipt in the invocation directory's ignored `.firsttry/deployment.json`. Run subsequent lifecycle commands from the same directory. Sign into the Android host as the owning developer, then open the preview link. ADB connects local devices to the API; mini-app updates require no new host APK.

```powershell
pnpm cli inspect                  # Fetch current review status, reason and versions
pnpm cli submit                   # Request moderation for the last deployment
# Once a moderator approves it:
pnpm cli publish                  # Publish that approved deployment
pnpm cli rollback <version-id>    # Switch to an earlier approved version
```

`deploy hello-mini --submit` combines preview upload and review submission. Deployment never automatically approves a version or publishes unreviewed code. Repeat deploys with identical files reuse the existing version; changed files with an existing semantic version explain how to increment the manifest version. Failed builds upload nothing. Pausing, publishing, feedback and analytics remain available in the dashboard.

## Existing projects

Add a `firsttry.json` at the project root:

```json
{
  "outputDirectory": "dist",
  "buildScript": "build"
}
```

`buildScript` names an existing package.json script, executed locally using Node's script runner. Dependencies must already be installed. No build command is executed on the API server. Output must stay inside the project. `--skip-build` explicitly deploys an already built output. Static projects can use `{ "outputDirectory": "." }` with no build step.

The output must contain `index.html`, `manifest.json` and self-contained supported assets. For Vite, put the manifest in `public/manifest.json`; update its version before shipping changed code. The generated Vite configuration disables module-preload polyfills to fit the no-network runtime. Static HTML/CSS/JavaScript and the TypeScript/Vite starter have been exercised. Other frameworks must produce compliant static bundles and pass validation; SSR, server functions, external fetches, remote scripts, dynamic imports and arbitrary network APIs are unsupported. Do not ship secrets in frontend code.

The current limits are 2 MB compressed, 6 MB expanded, 64 files and 2 MB per file. `pnpm cli validate <project>` runs the same build and validation without uploading. The CLI is a private workspace package; a public `npx firsttry` distribution is not published.

## Integration availability

| Integration                                                                 | Actual status                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| Static bundles and ZIP upload                                               | Implemented and exercised                              |
| TypeScript/Vite starter, saved build/output settings                        | Implemented; builds run locally                        |
| Immutable deployments, private Android links, moderation, publish, rollback | Implemented                                            |
| Developer dashboard, REST API, SDK completion events and feedback           | Implemented locally                                    |
| Android ADB install, launch, API tunnel, device selection and tests         | Implemented and emulator-tested                        |
| External PostgreSQL and S3/MinIO                                            | Adapters exist; external services remain unverified    |
| React/other framework presets                                               | No dedicated integration; compliant static output only |
| GitHub/GitLab/Bitbucket import or push-to-deploy                            | Not implemented                                        |
| Cloud builds, deployment queues and live build logs                         | Not implemented                                        |
| CI deployment tokens, team invitations, Git PR checks and QR previews       | Not implemented                                        |
| Self-service account creation, browser/device CLI login, public CLI package | Not implemented                                        |

## Hosted Vercel-style flow to build next

1. **Account and project import:** verified developer onboarding, browser-based CLI login, project ownership and a GitHub App installation scoped to chosen repositories. Start with GitHub, then add other providers.
2. **Project settings:** repository, root directory, branch, build script, output directory and protected build-only environment variables. Detect known presets and let the developer review settings before the first build.
3. **Build service:** verified webhook signatures, deduplicated commit jobs, disposable isolated workers, pinned dependencies, resource/time limits, restricted credentials, build logs and cancel/retry controls. Run untrusted repository code outside the API process.
4. **Preview deployments:** each commit creates an immutable private preview tied to its commit and branch, with Android deep link/QR, access controls and deployment status. PR builds from untrusted forks never receive project secrets.
5. **Review and production:** merging to the configured branch can upload and submit a candidate automatically. Production promotion requires the existing approval rules. Reuse already approved immutable bytes; new bytes need review. Add explicit opt-in promotion settings rather than silently publishing.
6. **Operational controls:** scoped revocable CI tokens, project/team permissions, audit history, usage limits, retention, deletion, health monitoring and production signing/TLS configuration.

Acceptance rehearsal: a newly invited developer imports a repository, sees a build and logs, opens its authenticated Android preview, pushes a change and receives a new preview, submits it for review, publishes an approved version, then rolls back. Test webhook replay, fork secrets, worker isolation, failed builds, ownership boundaries, cancellation, revoked access and active takedown as well as the happy path. These hosted acceptance checks have not been run because the hosted integrations do not exist yet.
