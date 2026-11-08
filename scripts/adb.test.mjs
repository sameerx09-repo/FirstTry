import assert from "node:assert/strict";
import test from "node:test";
import {
  instrumentationPassed,
  parseDevices,
  parseOptions,
  selectDevice,
  validateAppLink,
} from "./adb.mjs";

test("device parsing ignores daemon messages and handles status and CRLF", () => {
  assert.deepEqual(
    parseDevices(
      "* daemon started successfully\r\nList of devices attached\r\nusb-123 device product:foo model:Pixel\r\n127.0.0.1:5557 offline\r\nphone unauthorized\r\n",
    ),
    [
      { serial: "usb-123", state: "device" },
      { serial: "127.0.0.1:5557", state: "offline" },
      { serial: "phone", state: "unauthorized" },
    ],
  );
});
test("selection requires one ready device or explicit ready serial", () => {
  const devices = [
    { serial: "a", state: "device" },
    { serial: "b", state: "device" },
    { serial: "c", state: "unauthorized" },
  ];
  assert.throws(() => selectDevice(devices), /Multiple/);
  assert.equal(selectDevice(devices, "b"), "b");
  assert.throws(() => selectDevice(devices, "c"), /unauthorized/);
  assert.throws(() => selectDevice(devices, "missing"), /not connected/);
  assert.throws(() => selectDevice([]), /No ready/);
  assert.equal(selectDevice(devices.slice(1)), "b");
});
test("options honor explicit serial and port over environment and reject malformed arguments", () => {
  assert.deepEqual(
    parseOptions(["run", "--serial", "phone", "--port", "5038"], {
      ANDROID_SERIAL: "other",
      FIRSTTRY_ADB_PORT: "5039",
    }),
    { command: "run", serial: "phone", port: "5038", positional: [] },
  );
  assert.equal(parseOptions(["devices"], {}).port, "5039");
  for (const args of [
    ["run", "--serial"],
    ["run", "--port", "0"],
    ["run", "--port", "70000"],
    ["run", "--port", "5037x"],
    ["run", "--bad"],
  ])
    assert.throws(() => parseOptions(args, {}));
});
test("instrumentation exit success is insufficient without a nonzero JUnit pass", () => {
  assert.equal(instrumentationPassed("Time: 76\nOK (4 tests)\n"), true);
  for (const report of [
    "",
    "OK (0 tests)",
    "INSTRUMENTATION_CODE: -1",
    "FAILURES!!!\nOK (4 tests)",
    "INSTRUMENTATION_FAILED: crash\nOK (4 tests)",
    "Process crashed.",
  ])
    assert.equal(instrumentationPassed(report), false);
});

test("desktop links accept only constrained FirstTry routes and reject command injection", () => {
  for (const uri of [
    "firsttry://mini/rentalflow",
    "firsttry://preview/seed-color-clash?version=seed-v1",
    "firsttry://preview/a96542bc-01a9-4032-b7d0-dbee77ba1d9d?dev=1",
    "firsttry://preview/a96542bc-01a9-4032-b7d0-dbee77ba1d9d?version=b75f203b-1e71-4201-9cd3-c52c218219e0",
  ])
    assert.equal(validateAppLink(uri), uri);
  for (const uri of [
    undefined,
    "https://example.com",
    "firsttry://mini/rentalflow;id",
    "firsttry://mini/rentalflow&reboot",
    'firsttry://mini/rentalflow" -Command bad',
    "firsttry://mini/rentalflow%22",
    "firsttry://mini/../rentalflow",
    "firsttry://preview/app?version=v1&extra=bad",
    "firsttry://mini/rentalflow#fragment",
    "firsttry://mini/rentalflow\n",
    "firsttry://preview/app",
    "firsttry://preview/app?dev=2",
    "firsttry://preview/app?dev=1&version=v1",
    "firsttry://preview/app?dev=1&extra=bad",
  ])
    assert.throws(() => validateAppLink(uri));
});

test("local emulator aliases count as one device while unrelated phones remain ambiguous", () => {
  const aliases = [
    { serial: "emulator-5558", state: "device" },
    { serial: "127.0.0.1:5559", state: "device" },
  ];
  assert.equal(selectDevice(aliases), "127.0.0.1:5559");
  assert.equal(selectDevice(aliases, "emulator-5558"), "emulator-5558");
  assert.throws(
    () => selectDevice([...aliases, { serial: "usb-phone", state: "device" }]),
    /Multiple/,
  );
  assert.throws(
    () =>
      selectDevice([
        { serial: "emulator-5558", state: "device" },
        { serial: "127.0.0.1:5561", state: "device" },
      ]),
    /Multiple/,
  );
});
