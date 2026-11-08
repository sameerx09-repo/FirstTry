import Link from "next/link";
export default async function Share({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const response = await fetch(
    "http://127.0.0.1:3001/api/v1/catalog/" + encodeURIComponent(slug),
    { cache: "no-store" },
  );
  if (!response.ok)
    return (
      <main className="login">
        <h1>This experiment is unavailable.</h1>
        <Link href="/">Find something else to try</Link>
      </main>
    );
  const a = await response.json();
  return (
    <main className="login share-page">
      <Link className="brand" href="/">
        ✳ FirstTry
      </Link>
      <div className="app-icon" style={{ background: a.color }}>
        {a.icon}
      </div>
      <h1>{a.title}</h1>
      <p>{a.summary}</p>
      <p>
        by {a.creator} · {a.category}
      </p>
      <div className="group disclosure">
        <p>
          Open this mini-app inside the FirstTry Android host. No separate
          mini-app installation is needed.
        </p>
      </div>
      <a className="primary" href={"firsttry://mini/" + a.slug}>
        Open in FirstTry
      </a>
      <p className="footnote">
        The Android host is in local development. An official installation link
        will appear after publication.
      </p>
      <Link href={"/?app=" + encodeURIComponent(a.slug)}>
        View in discovery
      </Link>
    </main>
  );
}
