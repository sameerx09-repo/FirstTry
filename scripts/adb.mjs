import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = "app.firsttry.host";
const apk = join(
  root,
  "apps/android/app/build/outputs/apk/debug/app-debug.apk",
);
const testApk = join(
  root,
  "apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk",
);

export function parseDevices(output) {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = line
      .trim()
      .match(
        /^(\S+)\s+(device|offline|unauthorized|recovery|sideload|bootloader)(?:\s|$)/,
      );
    return match ? [{ serial: match[1], state: match[2] }] : [];
  });
}

export function selectDevice(devices, serial) {
  if (serial) {
    const device = devices.find((item) => item.serial === serial);
    if (!device)
      throw new Error(
        `Device ${serial} is not connected. Run android:devices or explicitly connect it.`,
      );
    if (device.state !== "device")
      throw new Error(
        `Device ${serial} is ${device.state}. Unlock it and authorize USB debugging, or reconnect it.`,
      );
    return serial;
  }
  const connected = devices.filter((item) => item.state === "device");
  // ADB can expose the same local emulator through both console and TCP aliases.
  const ready = connected.filter((item) => {
    const emulator = /^emulator-(\d+)$/.exec(item.serial);
    if (!emulator) return true;
    const port = Number(emulator[1]) + 1;
    return !connected.some(
      (other) =>
        other.serial === `127.0.0.1:${port}` ||
        other.serial === `localhost:${port}`,
    );
  });
  if (ready.length === 1) return ready[0].serial;
  if (ready.length > 1)
    throw new Error(
      "Multiple devices are ready. Pass --serial <device-id> or set ANDROID_SERIAL.",
    );
  throw new Error(
    "No ready Android device. Enable USB debugging and authorize the computer, or start an emulator. Run android:devices for status.",
  );
}

export function parseOptions(args, env = process.env) {
  const options = {
    command: args[0] ?? "help",
    serial: env.ANDROID_SERIAL,
    port: env.FIRSTTRY_ADB_PORT ?? "5039",
    positional: [],
  };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--serial" || args[i] === "--port") {
      const key = args[i] === "--serial" ? "serial" : "port";
      if (!args[i + 1] || args[i + 1].startsWith("--"))
        throw new Error(`Missing value for ${args[i]}`);
      options[key] = args[++i];
    } else if (args[i].startsWith("--"))
      throw new Error(`Unknown option ${args[i]}`);
    else options.positional.push(args[i]);
  }
  if (
    !/^\d+$/.test(String(options.port)) ||
    Number(options.port) < 1 ||
    Number(options.port) > 65535
  )
    throw new Error("ADB port must be between 1 and 65535.");
  return options;
}

export function validateAppLink(uri) {
  if (
    typeof uri !== "string" ||
    uri.length > 256 ||
    !/^firsttry:\/\/(?:mini\/[a-z0-9][a-z0-9-]{1,63}|preview\/[a-zA-Z0-9-]{1,80}\?version=[a-zA-Z0-9-]{1,80})$/.test(
      uri,
    )
  ) {
    throw new Error(
      "Expected firsttry://mini/<slug> or firsttry://preview/<app-id>?version=<version-id>. Other schemes, extra parameters and shell characters are rejected.",
    );
  }
  return uri;
}

export function instrumentationPassed(text) {
  return (
    /OK \([1-9]\d* tests?\)/.test(text) &&
    !/FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed/.test(
      text,
    )
  );
}

function findAdb() {
  const binary = process.platform === "win32" ? "adb.exe" : "adb";
  if (process.env.FIRSTTRY_ADB) {
    const override = resolve(process.env.FIRSTTRY_ADB);
    if (!existsSync(override))
      throw new Error("FIRSTTRY_ADB must point to an existing ADB executable.");
    return override;
  }
  const sdkRoots = [
    join(root, ".local/android-sdk"),
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Android/Sdk"),
  ].filter(Boolean);
  for (const sdk of sdkRoots) {
    const candidate = join(sdk, "platform-tools", binary);
    if (existsSync(candidate)) return candidate;
  }
  return binary;
}

export function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  const commands = [
    "doctor",
    "devices",
    "connect",
    "install",
    "reverse",
    "launch",
    "run",
    "logs",
    "test",
    "open-link",
    "validate-link",
  ];
  if (options.command === "help") {
    console.log(
      "Usage: node scripts/adb.mjs <doctor|devices|connect|install|reverse|launch|run|logs|test|open-link> [--serial ID] [--port PORT]\nconnect requires host:port. run installs the debug APK, reverses API port 3001, then launches FirstTry.\nlogs prints the last 200 app log lines. test installs both APKs and resets the debug host account/preferences before testing.",
    );
    return;
  }
  if (!commands.includes(options.command))
    throw new Error(`Unknown command: ${options.command}`);
  if (
    options.positional.length &&
    !["connect", "open-link", "validate-link"].includes(options.command)
  )
    throw new Error(
      "Unexpected positional arguments. Use --serial to choose a device.",
    );
  const appLink = ["open-link", "validate-link"].includes(options.command)
    ? validateAppLink(
        options.positional.length === 1 ? options.positional[0] : undefined,
      )
    : undefined;
  if (options.command === "validate-link") {
    console.log(appLink);
    return;
  }
  const adb = findAdb();
  function invoke(params, timeout = 120000) {
    const result = spawnSync(adb, ["-P", String(options.port), ...params], {
      encoding: "utf8",
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.error)
      throw new Error(`Cannot run ADB at ${adb}: ${result.error.message}`);
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    if (result.status !== 0)
      throw new Error(`ADB command failed (${result.status}): ${output}`);
    return output;
  }
  const version = invoke(["version"]);
  if (
    !/Android Debug Bridge version 1\.0\.(?:4[1-9]|[5-9]\d|\d{3,})\b/.test(
      version,
    )
  )
    throw new Error(
      `ADB is too old. Install current Android SDK Platform-Tools or set FIRSTTRY_ADB. Selected: ${adb}`,
    );
  if (options.command === "connect") {
    const address = options.positional[0];
    if (
      options.positional.length !== 1 ||
      !/^[a-zA-Z0-9._-]+:\d+$/.test(address)
    )
      throw new Error(
        "connect requires an explicit host:port, for example 127.0.0.1:5557.",
      );
    const output = invoke(["connect", address]);
    console.log(output);
    if (!/(?:already )?connected to /i.test(output))
      throw new Error("ADB could not connect to the requested device.");
    return;
  }
  const listing = invoke(["devices", "-l"]);
  if (options.command === "devices") {
    console.log(listing);
    return;
  }
  if (options.command === "doctor") {
    console.log(
      `ADB: ${adb}\nServer port: ${options.port}\n${version}\n\n${listing}`,
    );
    console.log(
      `\nDebug APK: ${existsSync(apk) ? apk : "Missing; build assembleDebug first."}`,
    );
    console.log(
      `Test APK: ${existsSync(testApk) ? testApk : "Missing; build assembleDebugAndroidTest first."}`,
    );
    return;
  }
  const serial = selectDevice(parseDevices(listing), options.serial);
  const device = (params, timeout) =>
    invoke(["-s", serial, ...params], timeout);
  const install = (path) => {
    if (!existsSync(path))
      throw new Error(
        `APK missing: ${path}. Build it with scripts/android.ps1 first.`,
      );
    console.log(device(["install", "-r", path]));
  };
  const reverse = () =>
    console.log(
      device(["reverse", "tcp:3001", "tcp:3001"]) ||
        "API tunnel: device port 3001 → host port 3001",
    );
  const launch = () => {
    const output = device([
      "shell",
      "am",
      "start",
      "-n",
      `${host}/.MainActivity`,
    ]);
    if (/Error:|Exception/.test(output)) throw new Error(output);
    console.log(output);
  };
  console.log(`Device: ${serial}`);
  switch (options.command) {
    case "install":
      install(apk);
      break;
    case "reverse":
      reverse();
      break;
    case "launch":
      launch();
      break;
    case "run":
      install(apk);
      reverse();
      launch();
      break;
    case "open-link": {
      reverse();
      const output = device([
        "shell",
        "am",
        "start",
        "-a",
        "android.intent.action.VIEW",
        "-d",
        appLink,
        "-n",
        `${host}/.MainActivity`,
      ]);
      if (/Error:|Exception/.test(output)) throw new Error(output);
      console.log(output);
      break;
    }
    case "logs": {
      const pid = device(["shell", "pidof", "-s", host]).trim();
      if (!/^\d+$/.test(pid))
        throw new Error("FirstTry is not running. Launch it first.");
      console.log(device(["logcat", "-d", "-t", "200", `--pid=${pid}`]));
      break;
    }
    case "test": {
      // Check both artifacts before changing the installed test host.
      if (![apk, testApk].every(existsSync))
        throw new Error(
          "Build assembleDebug and assembleDebugAndroidTest first.",
        );
      reverse();
      install(apk);
      install(testApk);
      const reset = device(["shell", "pm", "clear", host]);
      if (reset.trim() !== "Success")
        throw new Error(`Test host reset failed: ${reset}`);
      const report = device(
        [
          "shell",
          "am",
          "instrument",
          "-w",
          `${host}.test/androidx.test.runner.AndroidJUnitRunner`,
        ],
        600000,
      );
      mkdirSync(join(root, "output"), { recursive: true });
      writeFileSync(join(root, "output/android-instrumentation.txt"), report);
      console.log(report);
      if (!instrumentationPassed(report))
        throw new Error(
          "Native instrumentation failed; inspect output/android-instrumentation.txt.",
        );
      break;
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
