"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "../ui/api";
export default function Login() {
  const [email, setEmail] = useState("developer@firsttry.local"),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  return (
    <main className="login">
      <Link href="/" className="brand">
        ✳ FirstTry
      </Link>
      <h1>Your next idea starts here.</h1>
      <p>Sign in to the local developer or moderator workspace.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const u = await api("/auth/login", "POST", { email, password });
            // Only same-site relative paths are honoured as a return target.
            const next = new URLSearchParams(location.search).get("next");
            if (next && /^\/(?![/\\])/.test(next)) {
              location.href = next;
              return;
            }
            location.href =
              u.role === "admin"
                ? "/admin"
                : u.role === "developer"
                  ? "/developer"
                  : "/";
          } catch (e: any) {
            setError(e.message);
          }
        }}
      >
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary">Sign in</button>
      </form>
      <p className="footnote">
        Development accounts are documented in README.
        <br />
        Not available in production configuration.
      </p>
    </main>
  );
}
