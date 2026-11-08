"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./api";
import DeployGuide from "./DeployGuide";
import {
  ArrowUpRight,
  Layers,
  Plus,
  ShieldCheck,
  LogOut,
  Package,
  BarChart3,
  MessageSquare,
  Flag,
  History,
  CheckCircle2,
} from "lucide-react";
export default function Workspace({ mode }: { mode: "developer" | "admin" }) {
  const [user, setUser] = useState<any>(null),
    [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [versions, setVersions] = useState<any[]>([]),
    [analytics, setAnalytics] = useState<any>(null),
    [feedback, setFeedback] = useState<any[]>([]),
    [view, setView] = useState(mode === "developer" ? "Apps" : "Review queue"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [summary, setSummary] = useState(""),
    [category, setCategory] = useState("games"),
    [loading, setLoading] = useState(true);
  async function load() {
    setItems(
      await api(
        mode === "developer"
          ? "/developer/apps"
          : view === "Reports"
            ? "/admin/reports"
            : view === "Audit log"
              ? "/admin/audit"
              : view === "Apps"
                ? "/admin/apps"
                : "/admin/reviews",
      ),
    );
  }
  useEffect(() => {
    api("/me")
      .then((u) => {
        if (u.role !== mode) {
          setError("This workspace requires the " + mode + " role.");
          return;
        }
        setUser(u);
        void load().catch((e) => setError(e.message));
      })
      .catch(() => {
        location.href = "/login";
      })
      .finally(() => setLoading(false));
  }, [view]);
  async function action(fn: () => Promise<void>) {
    try {
      setError("");
      await fn();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function open(a: any) {
    setSelected(a);
    const [v, stats, f] = await Promise.all([
      api("/developer/apps/" + a.id + "/versions"),
      api("/developer/apps/" + a.id + "/analytics"),
      api("/developer/apps/" + a.id + "/feedback"),
    ]);
    setVersions(v);
    setAnalytics(stats);
    setFeedback(f);
  }
  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) throw new Error("ZIP exceeds 2 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    await api("/developer/apps/" + selected.id + "/upload", "POST", {
      zipBase64: btoa(binary),
    });
    await open(selected);
    setNotice("Bundle validated. Submit this version for review when ready.");
  }
  async function decision(v: any, d: string) {
    const reason = prompt("Review reason (at least five characters)");
    if (!reason) return;
    await api("/admin/reviews/" + v.id + "/decision", "POST", {
      decision: d,
      reason,
    });
    await load();
    setNotice("Review decision recorded.");
  }
  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Link href="/" className="brand">
          ✳ FirstTry
        </Link>
        <span className="workspace-label">
          {mode === "admin" ? "MODERATION" : "DEVELOPER WORKSPACE"}
        </span>
        <nav>
          {(mode === "developer"
            ? ["Apps"]
            : ["Review queue", "Apps", "Reports", "Audit log"]
          ).map((v, i) => (
            <button
              key={v}
              className={view === v ? "selected" : ""}
              onClick={() => {
                setView(v);
                setSelected(null);
              }}
            >
              {i === 0 ? (
                <Layers size={19} />
              ) : i === 1 ? (
                <Package size={19} />
              ) : i === 2 ? (
                <Flag size={19} />
              ) : (
                <History size={19} />
              )}{" "}
              {v}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span>{user?.name}</span>
          <small>{user?.role}</small>
          <button
            onClick={() =>
              action(async () => {
                await api("/auth/logout", "POST");
                location.href = "/login";
              })
            }
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-header">
          <span>
            <span className="eyebrow">FIRSTTRY / {mode.toUpperCase()}</span>
            <h1>
              {selected
                ? selected.title
                : view === "Apps"
                  ? "Your next little big thing."
                  : view}
            </h1>
            <p>
              {mode === "developer"
                ? "Build small. Share safely. Learn what people love."
                : "Keep discovery useful, trusted, and worth coming back to."}
            </p>
          </span>
          <Link href="/" className="secondary inline">
            Consumer preview <ArrowUpRight size={16} />
          </Link>
        </header>
        {error && (
          <div role="alert" className="alert">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="success">
            {notice}
            <button aria-label="Dismiss" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {!user ? (
          <p>{loading ? "Checking your session…" : error}</p>
        ) : mode === "developer" ? (
          selected ? (
            <>
              <button className="text-button" onClick={() => setSelected(null)}>
                ← All apps
              </button>
              {!versions.length && <DeployGuide slug={selected.slug} />}
              <section className="workspace-card" aria-label="Public release">
                <h2>
                  {versions.some((v) => v.published)
                    ? "Live on FirstTry"
                    : "No public release yet"}
                </h2>
                <p>
                  {versions.some((v) => v.published)
                    ? "Your published version is visible in consumer discovery. Open its listing or launch it in the FirstTry Android host."
                    : "Approval makes a version eligible to publish. Choose Publish / rollback below to make it visible to consumers."}
                </p>
                {versions.some((v) => v.published) && (
                  <div className="table-actions">
                    <Link
                      className="primary inline"
                      href={"/m/" + selected.slug}
                    >
                      View public listing
                    </Link>
                    <a
                      className="secondary inline"
                      href={"firsttry://mini/" + selected.slug}
                    >
                      Open in Android
                    </a>
                    <Link
                      className="secondary inline"
                      href={"/?app=" + encodeURIComponent(selected.slug)}
                    >
                      View in discovery
                    </Link>
                  </div>
                )}
                <p className="footnote">
                  This screen manages deployments. Uploaded mini-apps play in
                  the Android host.
                </p>
              </section>
              <div className="metrics">
                {[
                  [
                    "Approved versions",
                    versions.filter((v) => v.review_status === "approved")
                      .length,
                  ],
                  [
                    "Actual starts",
                    analytics?.versions?.reduce(
                      (n: number, v: any) => n + v.starts,
                      0,
                    ) ?? 0,
                  ],
                  [
                    "Meaningful actions",
                    analytics?.versions?.reduce(
                      (n: number, v: any) => n + v.completions,
                      0,
                    ) ?? 0,
                  ],
                ].map(([label, count]) => (
                  <div className="metric" key={label}>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              <section className="workspace-card">
                <div className="card-heading">
                  <div>
                    <h2>Deployments</h2>
                    <p>
                      Every changed bundle is a new immutable, reviewed version.
                    </p>
                  </div>
                  <label className="primary inline upload">
                    Upload ZIP
                    <input
                      aria-label="Upload ZIP"
                      type="file"
                      accept=".zip"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void action(() => upload(file));
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {versions.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Version</th>
                          <th>Review</th>
                          <th>Decision / hash</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((v) => (
                          <tr key={v.id}>
                            <td>
                              <strong>v{v.semver}</strong>
                              {v.published && (
                                <span className="badge approved">Live</span>
                              )}
                            </td>
                            <td>
                              <span className={"badge " + v.review_status}>
                                {v.review_status}
                              </span>
                            </td>
                            <td className="hash">
                              {v.review_reason || v.bundle_hash.slice(0, 16)}
                            </td>
                            <td>
                              <div className="table-actions">
                                {v.review_status === "validated" && (
                                  <button
                                    onClick={() =>
                                      action(async () => {
                                        await api(
                                          "/developer/apps/" +
                                            selected.id +
                                            "/versions/" +
                                            v.id +
                                            "/submit-review",
                                          "POST",
                                        );
                                        await open(selected);
                                      })
                                    }
                                  >
                                    Submit review
                                  </button>
                                )}
                                {v.review_status === "approved" && (
                                  <button
                                    onClick={() =>
                                      action(async () => {
                                        await api(
                                          "/developer/apps/" +
                                            selected.id +
                                            "/release",
                                          "POST",
                                          { versionId: v.id },
                                        );
                                        await open(selected);
                                        setNotice(
                                          "Approved version published. Use View public listing above to find it.",
                                        );
                                      })
                                    }
                                    disabled={v.published}
                                  >
                                    {v.published
                                      ? "Published"
                                      : "Publish / rollback"}
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    action(async () => {
                                      await navigator.clipboard.writeText(
                                        "firsttry://preview/" +
                                          selected.id +
                                          "?version=" +
                                          v.id,
                                      );
                                      setNotice(
                                        "Android preview link copied. Open it in the Android host signed in as this developer. The host obtains a fresh authorization when opened.",
                                      );
                                    })
                                  }
                                >
                                  Android preview
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty">
                    <Package />
                    <h3>Your first deployment starts here.</h3>
                    <p>
                      Use the CLI template or upload a validated static ZIP.
                    </p>
                  </div>
                )}
                <button
                  className="text-button danger-text"
                  onClick={() =>
                    action(async () => {
                      await api(
                        "/developer/apps/" + selected.id + "/pause",
                        "POST",
                      );
                      await open(selected);
                      setNotice(
                        "Public release paused; active grants revoked.",
                      );
                    })
                  }
                >
                  Pause public release
                </button>
              </section>
              <div className="two-columns">
                <section className="workspace-card">
                  <h2>
                    <BarChart3 size={20} /> Version comparison
                  </h2>
                  {analytics?.versions?.map((v: any) => (
                    <div className="setting" key={v.id}>
                      <span>v{v.semver}</span>
                      <strong>
                        {v.starts} starts · {v.completions} actions
                      </strong>
                    </div>
                  ))}
                  <p className="footnote">
                    Local exact aggregates for verification. Production cohort
                    privacy thresholds are a release gate.
                  </p>
                </section>
                <section className="workspace-card">
                  <h2>
                    <MessageSquare size={20} /> Feedback
                  </h2>
                  {feedback.length ? (
                    feedback.map((f, i) => (
                      <div className="feedback-item" key={i}>
                        <strong>
                          {f.rating === "up"
                            ? "👍 Enjoyed it"
                            : "👎 Could be better"}
                        </strong>
                        <p>{f.body || "No written feedback"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">
                      Feedback appears after real sessions.
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : (
            <>
              <DeployGuide />
              <div className="card-heading">
                <h2>
                  Your mini-apps <span className="count">{items.length}</span>
                </h2>
                <button
                  className="primary inline"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={18} /> Create mini-app
                </button>
              </div>
              <div className="developer-grid">
                {items.map((a) => (
                  <button
                    className="developer-app"
                    key={a.id}
                    onClick={() => action(() => open(a))}
                  >
                    <span className="app-icon" style={{ background: a.color }}>
                      {a.icon}
                    </span>
                    <span className="badge">{a.category}</span>
                    <h2>{a.title}</h2>
                    <p>{a.summary}</p>
                    <span className="developer-app-bottom">
                      {a.version_count} versions <ArrowUpRight size={18} />
                    </span>
                  </button>
                ))}
              </div>
              {!items.length && (
                <div className="empty workspace-card">
                  <Package />
                  <h2>Something small can start something big.</h2>
                  <p>Create your first mini-app listing.</p>
                </div>
              )}
              <section className="workspace-card workflow">
                <ShieldCheck />
                <div>
                  <h3>A clear path from idea to discovery.</h3>
                  <p>
                    Build → validate → private Android preview → review →
                    publish.
                    <br />
                    Upload never automatically publishes executable content.
                  </p>
                </div>
              </section>
            </>
          )
        ) : (
          <section className="workspace-card">
            <div className="card-heading">
              <h2>{view}</h2>
              <span className="badge">{items.length} items</span>
            </div>
            {items.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {(view === "Review queue"
                        ? ["App / version", "Manifest", "Status", "Decision"]
                        : view === "Apps"
                          ? ["App", "Status", "Version", "Action"]
                          : view === "Reports"
                            ? ["App", "Category / detail", "Status", "Action"]
                            : ["Time", "Actor", "Action", "Reason"]
                      ).map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => (
                      <tr key={a.id}>
                        {view === "Review queue" ? (
                          <>
                            <td>
                              <strong>{a.title}</strong>
                              <small>
                                v{a.semver} · {a.creator}
                              </small>
                            </td>
                            <td>
                              <small>
                                {a.manifest.runtime}
                                <br />
                                No declared network domains
                                <br />
                                {a.manifest.capabilities.join(", ")}
                              </small>
                            </td>
                            <td>
                              <span className={"badge " + a.review_status}>
                                {a.review_status}
                              </span>
                              <small>{a.review_reason}</small>
                            </td>
                            <td>
                              {a.review_status === "pending" && (
                                <div className="table-actions">
                                  <button
                                    onClick={() =>
                                      action(() => decision(a, "approved"))
                                    }
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() =>
                                      action(() => decision(a, "rejected"))
                                    }
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          </>
                        ) : view === "Apps" ? (
                          <>
                            <td>
                              <strong>{a.title}</strong>
                              <small>{a.slug}</small>
                            </td>
                            <td>
                              <span className="badge">{a.status}</span>
                            </td>
                            <td>{a.semver ?? "Unpublished"}</td>
                            <td>
                              {a.status === "active" && (
                                <button
                                  className="danger"
                                  onClick={() =>
                                    action(async () => {
                                      const reason = prompt(
                                        "Reason for suspension",
                                      );
                                      if (reason) {
                                        await api(
                                          "/admin/apps/" + a.id + "/suspend",
                                          "POST",
                                          { reason },
                                        );
                                        await load();
                                      }
                                    })
                                  }
                                >
                                  Suspend
                                </button>
                              )}
                            </td>
                          </>
                        ) : view === "Reports" ? (
                          <>
                            <td>{a.title}</td>
                            <td>
                              {a.category}
                              <small>{a.detail}</small>
                            </td>
                            <td>{a.status}</td>
                            <td>
                              {a.status === "open" && (
                                <button
                                  onClick={() =>
                                    action(async () => {
                                      await api(
                                        "/admin/reports/" + a.id + "/resolve",
                                        "POST",
                                      );
                                      await load();
                                    })
                                  }
                                >
                                  Resolve
                                </button>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              <small>
                                {new Date(a.created_at).toLocaleString()}
                              </small>
                            </td>
                            <td>{a.actor}</td>
                            <td>{a.action}</td>
                            <td>{a.reason}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <CheckCircle2 />
                <h3>All clear for now.</h3>
                <p>New submissions and reports appear here.</p>
              </div>
            )}
            <p className="footnote">
              Review uploaded experiences in the restricted Android host. This
              dashboard does not execute uploaded JavaScript.
            </p>
          </section>
        )}
        {creating && (
          <div className="modal-backdrop">
            <form
              className="modal"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  const a = await api("/developer/apps", "POST", {
                    title: name,
                    slug,
                    summary,
                    category,
                  });
                  setCreating(false);
                  await load();
                  await open(a);
                });
              }}
            >
              <h2>Give your idea a home.</h2>
              <label>
                App name
                <input
                  required
                  maxLength={70}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/-$/, ""),
                    );
                  }}
                />
              </label>
              <label>
                Slug
                <input
                  required
                  pattern="[a-z0-9][a-z0-9-]+"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </label>
              <label>
                Short description
                <textarea
                  required
                  minLength={5}
                  maxLength={180}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </label>
              <label>
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["games", "fun", "creative", "utility"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button className="primary">Create listing</button>
              <button
                type="button"
                className="secondary"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
