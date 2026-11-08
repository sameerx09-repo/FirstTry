"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "../ui/api";

function Device() {
  const params = useSearchParams(),
    [code, setCode] = useState(params.get("code") ?? ""),
    [who, setWho] = useState<{ name: string; role: string } | null | false>(
      null,
    ),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/me")
      .then(setWho)
      .catch(() => setWho(false));
  }, []);
  return (
    <main className="login">
      <Link href="/" className="brand">
        ✳ FirstTry
      </Link>
      <h1>Connect the FirstTry CLI</h1>
      {done ? (
        <p role="status">
          Approved. Return to your terminal — it will finish signing in.
        </p>
      ) : who === false || (who && who.role !== "developer") ? (
        <p>
          {who === false ? (
            <>
              Sign in as a developer first.{" "}
              <Link
                href={`/login?next=${encodeURIComponent("/device" + (code ? "?code=" + code : ""))}`}
              >
                Sign in
              </Link>
            </>
          ) : (
            "Only developer accounts can connect the CLI."
          )}
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await api("/auth/device/approve", "POST", { userCode: code });
              setDone(true);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <p>
            Signed in as <strong>{who ? who.name : "…"}</strong>. Enter the code
            shown in your terminal. Only approve codes you just requested
            yourself.
          </p>
          <label>
            Code
            <input
              required
              autoFocus
              autoComplete="off"
              maxLength={9}
              placeholder="ABCD-EFGH"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary">Approve</button>
        </form>
      )}
    </main>
  );
}
export default function DevicePage() {
  return (
    <Suspense>
      <Device />
    </Suspense>
  );
}
