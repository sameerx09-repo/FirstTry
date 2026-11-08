"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Compass,
  ChartNoAxesColumnIncreasing,
  Bookmark,
  UserRound,
  ChevronRight,
  X,
  Ellipsis,
  ArrowLeft,
  Gamepad2,
  Palette,
  Smile,
  Wrench,
  ShieldCheck,
  Heart,
  Flag,
  LockKeyhole,
  HelpCircle,
  SlidersHorizontal,
  Share2,
  Check,
} from "lucide-react";
import { api, type MiniApp } from "./api";
export default function Consumer() {
  const [apps, setApps] = useState<MiniApp[]>([]),
    [tab, setTab] = useState("Discover"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [saved, setSaved] = useState<MiniApp[]>([]),
    [recent, setRecent] = useState<MiniApp[]>([]),
    [selected, setSelected] = useState<MiniApp | null>(null),
    [nativeOnly, setNativeOnly] = useState<MiniApp | null>(null),
    [playing, setPlaying] = useState<MiniApp | null>(null),
    [menu, setMenu] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [feedback, setFeedback] = useState<MiniApp | null>(null),
    [feedbackText, setFeedbackText] = useState(""),
    [rating, setRating] = useState("up"),
    [report, setReport] = useState<MiniApp | null>(null),
    [reportCategory, setReportCategory] = useState("other"),
    [reportText, setReportText] = useState(""),
    [panel, setPanel] = useState(""),
    [panelData, setPanelData] = useState<any[]>([]),
    [user, setUser] = useState<any>(null);
  async function refresh() {
    const [catalog, saves, history] = await Promise.all([
      api("/catalog"),
      api("/saved"),
      api("/history"),
    ]);
    setApps(catalog.items);
    setSaved(saves);
    setRecent(history);
  }
  useEffect(() => {
    api("/auth/guest", "POST")
      .then(async () => {
        await refresh();
        const slug = new URLSearchParams(window.location.search).get("app");
        if (slug)
          setSelected(await api("/catalog/" + encodeURIComponent(slug)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    api("/me")
      .then(setUser)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  async function action(fn: () => Promise<void>) {
    try {
      setError("");
      await fn();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function save(a: MiniApp) {
    await action(async () => {
      const exists = saved.some((s) => s.id === a.id);
      await api("/apps/" + a.id + "/save", exists ? "DELETE" : "POST");
      await refresh();
      setNotice(exists ? "Removed from Saved" : "Saved for later");
    });
  }
  async function launch(a: MiniApp) {
    await action(async () => {
      const response = await fetch("/seed-preview/" + a.slug + "/index.html");
      if (!response.ok) {
        setNativeOnly(a);
        return;
      }
      await api("/sessions", "POST", { appId: a.id });
      setPlaying(a);
      setMenu(false);
      await refresh();
    });
  }
  function close() {
    const a = playing;
    setPlaying(null);
    setMenu(false);
    if (a) {
      setFeedback(a);
      setFeedbackText("");
    }
  }
  async function share(a: MiniApp) {
    await navigator.clipboard.writeText(location.origin + "/m/" + a.slug);
    setNotice("Link copied");
  }
  async function profilePanel(name: string) {
    setPanel(name);
    if (name === "Blocked creators") setPanelData(await api("/blocks"));
    else if (name === "My reports") setPanelData(await api("/my-reports"));
    else setPanelData([]);
  }
  const visible = (tab === "Saved" ? saved : apps).filter(
    (a) =>
      (!category || a.category === category) &&
      (!query ||
        (a.title + " " + a.summary)
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const duration = (a: MiniApp) =>
    a.manifest?.estimatedDurationSeconds < 60
      ? a.manifest.estimatedDurationSeconds + " sec"
      : Math.round((a.manifest?.estimatedDurationSeconds ?? 60) / 60) + " min";
  const appIcon = (a: MiniApp, small = false) => (
    <span
      className={"app-icon " + (small ? "small" : "")}
      style={{ background: a.color }}
    >
      {a.icon}
    </span>
  );
  const rows = (items: MiniApp[]) => (
    <div className="group app-list">
      {items.map((a) => (
        <div className="app-row" key={a.id}>
          <button className="row-main" onClick={() => setSelected(a)}>
            {appIcon(a, true)}
            <span>
              <strong>{a.title}</strong>
              <span className="description">{a.summary}</span>
              <span className="meta">
                {a.category} <span>·</span> {duration(a)}
              </span>
            </span>
          </button>
          <button className="try" onClick={() => launch(a)}>
            Try
          </button>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <div className="workbench">
        <Link href="/">
          FirstTry <span>LOCAL PREVIEW</span>
        </Link>
        <nav>
          <Link href="/developer">Developer</Link>
          <Link href="/admin">Moderation</Link>
        </nav>
      </div>
      <div className="consumer-layout">
        <aside className="intro">
          <span className="eyebrow">SMALL APPS. GOOD DISCOVERIES.</span>
          <h1>
            A little curious?
            <br />
            You’re in the
            <br />
            <em>right place.</em>
          </h1>
          <p>
            Quick games, useful little tools, and creative breaks. Find
            something new to try.
          </p>
          <div className="intro-note">
            <ShieldCheck size={22} />
            <span>
              One Android host.
              <br />
              Reviewed mini-apps. Your choice.
            </span>
          </div>
          <span className="preview-label">
            Browser design preview · bundled seed apps only
          </span>
        </aside>
        <section className="phone-shell" aria-label="FirstTry consumer preview">
          {error && (
            <div role="alert" className="alert">
              {error}
              <button
                onClick={() => {
                  setError("");
                  void refresh();
                }}
              >
                Retry
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="toast">
              <Check size={16} />
              {notice}
            </div>
          )}
          {playing ? (
            <>
              <header className="player-header">
                {appIcon(playing, true)}
                <div>
                  <strong>{playing.title}</strong>
                  <small>by {playing.creator}</small>
                </div>
                <div className="capsule">
                  <button
                    aria-label="Mini-app menu"
                    onClick={() => setMenu(!menu)}
                  >
                    <Ellipsis size={20} />
                  </button>
                  <button aria-label="Close mini-app" onClick={close}>
                    <X size={20} />
                  </button>
                </div>
              </header>
              <iframe
                title={playing.title + " playable preview"}
                src={"/seed-preview/" + playing.slug + "/index.html"}
                sandbox="allow-scripts"
                className="player"
              />
              {menu && (
                <div className="sheet-backdrop" onClick={() => setMenu(false)}>
                  <div className="sheet" onClick={(e) => e.stopPropagation()}>
                    <h2>{playing.title}</h2>
                    {[
                      ["Save / unsave", () => save(playing)],
                      ["Share", () => share(playing)],
                      [
                        "Report",
                        () => {
                          setReport(playing);
                          setMenu(false);
                        },
                      ],
                      [
                        "Block creator",
                        () =>
                          action(async () => {
                            await api(
                              "/developers/" + playing.developer_id + "/block",
                              "POST",
                            );
                            setPlaying(null);
                            await refresh();
                          }),
                      ],
                      [
                        "Clear app data",
                        () =>
                          action(async () => {
                            await api("/me/app-data/" + playing.id, "DELETE");
                            setPlaying(null);
                            await refresh();
                          }),
                      ],
                    ].map(([name, fn]) => (
                      <button
                        className="setting"
                        key={String(name)}
                        onClick={() => void (fn as () => void)()}
                      >
                        {String(name)}
                        <ChevronRight size={16} />
                      </button>
                    ))}
                    <button
                      className="secondary"
                      onClick={() => setMenu(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : selected ? (
            <>
              <header className="screen-header">
                <button
                  aria-label="Back to discover"
                  onClick={() => {
                    setSelected(null);
                    window.history.replaceState(null, "", "/");
                  }}
                >
                  <ArrowLeft />
                </button>
                <strong>Mini-app</strong>
                <button
                  aria-label="Share mini-app"
                  onClick={() => action(() => share(selected))}
                >
                  <Share2 size={20} />
                </button>
              </header>
              <main className="detail">
                {appIcon(selected)}
                <h1>{selected.title}</h1>
                <p>{selected.summary}</p>
                <div className="creator">by {selected.creator}</div>
                <div className="detail-facts">
                  <span>{selected.category}</span>
                  <span>{duration(selected)}</span>
                  <span>General audience</span>
                </div>
                <button className="primary" onClick={() => launch(selected)}>
                  Try now
                </button>
                <button className="secondary" onClick={() => save(selected)}>
                  {saved.some((a) => a.id === selected.id)
                    ? "Saved ✓"
                    : "Save for later"}
                </button>
                <div className="group disclosure">
                  <ShieldCheck />
                  <div>
                    <strong>A little experience. Clear boundaries.</strong>
                    <p>
                      No device permissions. Reviewed version {selected.semver}.
                      Your host keeps close and report controls available.
                    </p>
                  </div>
                </div>
                <button
                  className="text-button"
                  onClick={() => setReport(selected)}
                >
                  Report this mini-app
                </button>
              </main>
            </>
          ) : (
            <>
              <header className="screen-header">
                <h2>{tab === "Discover" ? "FirstTry" : tab}</h2>
                <span className="header-mark">✳</span>
              </header>
              <main className="consumer-content">
                {tab === "Profile" ? (
                  <>
                    <div className="group profile-card">
                      <span className="avatar">
                        <UserRound size={38} />
                      </span>
                      <div>
                        <strong>{user?.name ?? "Guest explorer"}</strong>
                        <p>
                          {user
                            ? "Your little corner of FirstTry"
                            : "Sign in to sync your saved apps"}
                        </p>
                      </div>
                      <Link href="/login" aria-label="Sign in">
                        <ChevronRight />
                      </Link>
                    </div>
                    <div className="group settings">
                      {[
                        [Heart, "Interests"],
                        [LockKeyhole, "Privacy & data"],
                        [ShieldCheck, "Blocked creators"],
                        [Flag, "My reports"],
                      ].map(([Icon, name]: any) => (
                        <button
                          className="setting"
                          key={name}
                          onClick={() => action(() => profilePanel(name))}
                        >
                          <Icon size={21} />
                          <span>{name}</span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </div>
                    <div className="group settings">
                      {[
                        [HelpCircle, "Help & support"],
                        [SlidersHorizontal, "About FirstTry"],
                      ].map(([Icon, name]: any) => (
                        <button
                          className="setting"
                          key={name}
                          onClick={() => action(() => profilePanel(name))}
                        >
                          <Icon size={21} />
                          <span>{name}</span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </div>
                    <p className="footnote">
                      Made for a little everyday discovery.
                      <br />
                      Local development edition
                    </p>
                  </>
                ) : (
                  <>
                    <label className="search">
                      <Search size={19} />
                      <input
                        placeholder="Search mini-apps"
                        aria-label="Search mini-apps"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    {tab === "Discover" && !query && (
                      <>
                        {recent.length > 0 && (
                          <>
                            <div className="section-heading">
                              <h3>Recently used</h3>
                              <ChevronRight size={17} />
                            </div>
                            <div className="recent-apps">
                              {recent.slice(0, 4).map((a) => (
                                <button key={a.id} onClick={() => launch(a)}>
                                  {appIcon(a)}
                                  <span>{a.title}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="categories">
                          {[
                            [Gamepad2, "games", "Games"],
                            [Smile, "fun", "Fun"],
                            [Palette, "creative", "Creative"],
                            [Wrench, "utility", "Utility"],
                          ].map(([Icon, key, label]: any) => (
                            <button
                              className={category === key ? "active" : ""}
                              key={key}
                              onClick={() =>
                                setCategory(category === key ? "" : key)
                              }
                            >
                              <Icon size={23} />
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                        {!category && apps[0] && (
                          <div className="feature">
                            <div>
                              <span className="eyebrow">
                                YOUR DAILY LITTLE CHALLENGE
                              </span>
                              <h2>
                                Thirty seconds.
                                <br />
                                How many colors?
                              </h2>
                              <button
                                className="primary"
                                onClick={() =>
                                  launch(
                                    apps.find(
                                      (a) => a.slug === "color-clash",
                                    ) ?? apps[0],
                                  )
                                }
                              >
                                Try Color Clash <ChevronRight size={16} />
                              </button>
                            </div>
                            <div className="color-art">
                              <i />
                              <i />
                              <i />
                              <i />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="section-heading">
                      <h3>
                        {tab === "Saved"
                          ? "Your saved mini-apps"
                          : tab === "Trending"
                            ? "Editor’s picks"
                            : category
                              ? "Explore " + category
                              : query
                                ? "Search results"
                                : "Fresh drops"}
                      </h3>
                      {category && (
                        <button
                          className="text-button"
                          onClick={() => setCategory("")}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {tab === "Trending" && (
                      <p className="section-note">
                        Curated picks while real engagement signals grow.
                      </p>
                    )}
                    {loading ? (
                      <div className="group empty">Finding something good…</div>
                    ) : visible.length ? (
                      rows(visible)
                    ) : (
                      <div className="group empty">
                        <Bookmark />
                        <h3>
                          {tab === "Saved"
                            ? "Keep the good ones close."
                            : "Nothing here just yet."}
                        </h3>
                        <p>
                          {tab === "Saved"
                            ? "Save a mini-app from its detail page to find it here."
                            : "Try another search or category."}
                        </p>
                      </div>
                    )}
                    {tab === "Saved" && recent.length > 0 && (
                      <>
                        <div className="section-heading">
                          <h3>Recently tried</h3>
                        </div>
                        {rows(recent.filter((a) => a.manifest).slice(0, 3))}
                      </>
                    )}
                    <div className="bottom-note">
                      <ShieldCheck size={15} />
                      Small experiences. No individual app installs.
                    </div>
                  </>
                )}
              </main>
              <nav className="bottom-tabs" aria-label="Main navigation">
                {[
                  [Compass, "Discover"],
                  [ChartNoAxesColumnIncreasing, "Trending"],
                  [Bookmark, "Saved"],
                  [UserRound, "Profile"],
                ].map(([Icon, name]: any) => (
                  <button
                    key={name}
                    className={tab === name ? "selected" : ""}
                    onClick={() => {
                      setTab(name);
                      setQuery("");
                      setCategory("");
                    }}
                  >
                    <Icon size={23} />
                    <span>{name}</span>
                  </button>
                ))}
              </nav>
            </>
          )}
          {nativeOnly && (
            <div className="sheet-backdrop">
              <section
                className="sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="android-launch-title"
              >
                <h2 id="android-launch-title">
                  Open {nativeOnly.title} on Android
                </h2>
                <p>
                  This mini-app is published. Play it in the FirstTry Android
                  host; browser play is available for the bundled demos.
                </p>
                <a
                  className="primary inline"
                  href={"firsttry://mini/" + nativeOnly.slug}
                >
                  Open in FirstTry for Android
                </a>
                <Link
                  className="secondary inline"
                  href={"/m/" + nativeOnly.slug}
                >
                  View public listing
                </Link>
                <button
                  className="secondary"
                  onClick={() => action(() => share(nativeOnly))}
                >
                  Copy app link
                </button>
                <p className="footnote">
                  On a computer, open the app link on your Android device with
                  FirstTry installed, or use your connected development
                  emulator.
                </p>
                <button
                  className="text-button"
                  onClick={() => setNativeOnly(null)}
                >
                  Back to discovery
                </button>
              </section>
            </div>
          )}
          {feedback && (
            <div className="sheet-backdrop">
              <form
                className="sheet"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await api("/apps/" + feedback.id + "/feedback", "POST", {
                      rating,
                      body: feedbackText,
                    });
                    setFeedback(null);
                    setNotice("Thanks. Your feedback helps.");
                  });
                }}
              >
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="Dismiss feedback"
                  onClick={() => setFeedback(null)}
                >
                  <X />
                </button>
                <h2>Worth a little break?</h2>
                <p>How was {feedback.title}? Feedback is optional.</p>
                <div className="rating">
                  <button
                    type="button"
                    className={rating === "up" ? "chosen" : ""}
                    onClick={() => setRating("up")}
                  >
                    👍 Enjoyed it
                  </button>
                  <button
                    type="button"
                    className={rating === "down" ? "chosen" : ""}
                    onClick={() => setRating("down")}
                  >
                    👎 Could be better
                  </button>
                </div>
                <textarea
                  maxLength={140}
                  placeholder="Anything to share? (optional)"
                  aria-label="Feedback"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
                <button className="primary">Send feedback</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setFeedback(null)}
                >
                  Skip for now
                </button>
              </form>
            </div>
          )}
          {report && (
            <div className="sheet-backdrop">
              <form
                className="sheet"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await api("/apps/" + report.id + "/report", "POST", {
                      category: reportCategory,
                      detail: reportText,
                    });
                    setReport(null);
                    setNotice("Report sent to the moderation queue");
                  });
                }}
              >
                <h2>Report {report.title}</h2>
                <select
                  aria-label="Report category"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                >
                  {["harmful", "scam", "privacy", "ip", "other"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <textarea
                  aria-label="Report details"
                  placeholder="What should we know?"
                  maxLength={500}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                />
                <button className="primary">Send report</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setReport(null)}
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
          {panel && (
            <div className="sheet-backdrop">
              <div className="sheet">
                <button
                  className="sheet-close"
                  aria-label="Close settings"
                  onClick={() => setPanel("")}
                >
                  <X />
                </button>
                <h2>{panel}</h2>
                {panel === "Blocked creators" || panel === "My reports" ? (
                  panelData.length ? (
                    panelData.map((d: any) => (
                      <div className="setting" key={d.id}>
                        <span>
                          {d.name ?? d.title}
                          <small>{d.status ?? ""}</small>
                        </span>
                        {panel === "Blocked creators" && (
                          <button
                            onClick={() =>
                              action(async () => {
                                await api(
                                  "/developers/" + d.id + "/block",
                                  "DELETE",
                                );
                                await profilePanel(panel);
                                await refresh();
                              })
                            }
                          >
                            Unblock
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>No items yet.</p>
                  )
                ) : panel === "Privacy & data" ? (
                  <>
                    <p>
                      Guest activity uses a random identifier. Mini-apps receive
                      no platform login credentials. Feedback may be reviewed by
                      moderators.
                    </p>
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm("Delete your account/guest data?"))
                          void action(async () => {
                            await api("/me", "DELETE");
                            await api("/auth/guest", "POST");
                            await refresh();
                            setPanel("");
                            setUser(null);
                            setNotice("Data deleted");
                          });
                      }}
                    >
                      Delete my data
                    </button>
                  </>
                ) : panel === "Interests" ? (
                  <p>
                    Browse Games, Fun, Creative and Utility using the Discover
                    category controls. Personalized recommendations are not
                    enabled in this local edition.
                  </p>
                ) : (
                  <p>
                    FirstTry is a curated place for small games and useful web
                    experiences. Use the mini-app menu to report a problem.
                    Local preview edition; not a published store release.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
        <aside className="side-note">
          <span>01 / DISCOVER SOMETHING</span>
          <p>
            Some ideas only need
            <br />a minute of your day.
          </p>
          <div className="mini-stack">
            <i>▦</i>
            <i>ϟ</i>
            <i>☺</i>
          </div>
        </aside>
      </div>
    </>
  );
}
