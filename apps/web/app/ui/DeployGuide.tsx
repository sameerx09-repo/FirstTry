"use client";
import { useState } from "react";
export default function DeployGuide({
  slug = "hello-mini",
}: {
  slug?: string;
}) {
  const [copied, setCopied] = useState(false);
  const commands = `pnpm cli init ${slug} --vite\npnpm --dir ${slug} install\n# Sign in once; approve the code in this dashboard at /device\npnpm cli login\npnpm cli deploy ${slug}\npnpm cli inspect\npnpm cli submit`;
  return (
    <section
      className="workspace-card deploy-guide"
      aria-label="Deployment quickstart"
    >
      <div className="card-heading">
        <div>
          <span className="eyebrow">BUILD → PREVIEW → REVIEW → PUBLISH</span>
          <h2>From idea to private preview.</h2>
          <p>One deploy command builds, validates and uploads your mini-app.</p>
        </div>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(commands);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy quickstart"}
        </button>
      </div>
      <pre className="deploy-commands">
        <code>{commands}</code>
      </pre>
      <p className="footnote">
        These commands use the workspace CLI. Local accounts are invited
        fixtures; self-service registration and a public CLI package are
        pending. Use your assigned developer email. The password is supplied
        through FIRSTTRY_PASSWORD, never a command argument.
      </p>
      <ol className="deploy-steps">
        <li>
          <strong>Build locally</strong>
          <span>
            Static HTML/CSS/JS or the TypeScript/Vite starter. Saved settings
            live in firsttry.json.
          </span>
        </li>
        <li>
          <strong>Test your preview</strong>
          <span>
            Open the returned firsttry:// link in the Android host signed into
            the same developer account.
          </span>
        </li>
        <li>
          <strong>Submit and publish</strong>
          <span>
            Submit from the CLI or this dashboard. After moderator approval, use
            pnpm cli publish. Roll back to an approved version anytime.
          </span>
        </li>
      </ol>
      <details>
        <summary>Integrations and supported projects</summary>
        <div className="setting">
          <span>
            Static bundles · TypeScript/Vite · Android ADB · REST API · SDK
            analytics
          </span>
          <strong>Available locally</strong>
        </div>
        <div className="setting">
          <span>
            GitHub/GitLab imports · push-to-deploy · pull request previews
          </span>
          <strong>Planned</strong>
        </div>
        <div className="setting">
          <span>React and other frameworks</span>
          <strong>Static output only; compatibility validation required</strong>
        </div>
        <p className="footnote">
          The runtime accepts self-contained bundles with no external network
          calls or server functions. Frontend bundles must not contain secrets.
          Git connections, cloud builds, team invitations and CI access tokens
          are not connected yet.
        </p>
      </details>
    </section>
  );
}
