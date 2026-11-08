import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
export type DeploymentConfig = {
  outputDirectory: string;
  buildScript?: string;
  /** Subdirectory holding the mini-app; build and output are relative to it. */
  rootDirectory?: string;
};
const relativeDir = (value: unknown) =>
  typeof value === "string" &&
  !!value &&
  !isAbsolute(value) &&
  !/^[A-Za-z]:|\\/.test(value);
export function parseDeploymentConfig(value: unknown): DeploymentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("firsttry.json must be an object");
  const config = value as Record<string, unknown>;
  if (
    Object.keys(config).some(
      (key) =>
        !["outputDirectory", "buildScript", "rootDirectory"].includes(key),
    )
  )
    throw new Error(
      "Unknown firsttry.json setting; supported: outputDirectory, buildScript, rootDirectory",
    );
  if (
    typeof config.outputDirectory !== "string" ||
    !config.outputDirectory ||
    isAbsolute(config.outputDirectory) ||
    /^[A-Za-z]:|\\/.test(config.outputDirectory)
  )
    throw new Error("outputDirectory must be a relative project directory");
  if (
    config.buildScript !== undefined &&
    (typeof config.buildScript !== "string" ||
      !/^[a-zA-Z0-9:_-]+$/.test(config.buildScript))
  )
    throw new Error("buildScript must name a package.json script");
  if (config.rootDirectory !== undefined && !relativeDir(config.rootDirectory))
    throw new Error("rootDirectory must be a relative project directory");
  return {
    outputDirectory: config.outputDirectory,
    ...(config.rootDirectory
      ? { rootDirectory: config.rootDirectory as string }
      : {}),
    ...(config.buildScript
      ? { buildScript: config.buildScript as string }
      : {}),
  };
}
/** Directory that is built and packaged; must stay inside the checkout. */
export function projectRoot(base: string, config: DeploymentConfig) {
  const root = resolve(base, config.rootDirectory ?? ".");
  const path = relative(base, root);
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error("rootDirectory must stay inside the project");
  return root;
}
export function outputPath(project: string, config: DeploymentConfig) {
  const output = resolve(project, config.outputDirectory);
  const path = relative(project, output);
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error("outputDirectory must stay inside the project");
  return output;
}
export async function readDeploymentConfig(
  project: string,
): Promise<DeploymentConfig> {
  let source: string;
  try {
    source = await readFile(resolve(project, "firsttry.json"), "utf8");
  } catch (error: any) {
    if (error.code === "ENOENT") return { outputDirectory: "." };
    throw error;
  }
  return parseDeploymentConfig(JSON.parse(source));
}
export function findReusableVersion(
  versions: any[],
  semver: string,
  hash: string,
) {
  const version = versions.find((item) => item.semver === semver);
  if (version && version.bundle_hash !== hash)
    throw new Error(
      `Version ${semver} already exists with different files. Increment manifest.json version before deploying.`,
    );
  return version;
}
