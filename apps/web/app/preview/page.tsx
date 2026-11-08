"use client";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import qrcode from "qrcode-generator";

const ID = /^[A-Za-z0-9-]{1,64}$/;

// Shareable preview page: scan the QR with a phone that has the FirstTry host,
// or open the link on the device. Previews stay private to the owning developer;
// this page grants no access by itself.
function Preview() {
  const params = useSearchParams(),
    app = params.get("app") ?? "",
    version = params.get("version") ?? "",
    valid = ID.test(app) && ID.test(version),
    link = `firsttry://preview/${app}?version=${version}`,
    svg = useMemo(() => {
      if (!valid) return "";
      const qr = qrcode(0, "M");
      qr.addData(link);
      qr.make();
      return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    }, [valid, link]);
  return (
    <main className="login">
      <Link href="/" className="brand">
        ✳ FirstTry
      </Link>
      <h1>Open this preview on your phone</h1>
      {valid ? (
        <>
          <div
            role="img"
            aria-label="QR code for the private preview link"
            style={{
              width: 240,
              maxWidth: "100%",
              background: "#fff",
              padding: 8,
              borderRadius: 12,
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p>
            <a className="primary" href={link}>
              Open in FirstTry
            </a>
          </p>
          <p className="footnote">
            Sign into the FirstTry host as the app&apos;s developer. Previews
            are private; this link does nothing for anyone else.
          </p>
        </>
      ) : (
        <p role="alert" className="error">
          Missing or invalid preview link.
        </p>
      )}
    </main>
  );
}
export default function PreviewPage() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}
