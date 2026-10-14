# Android ARM64 hardware validation

Use a separate debug application ID when running the service tests. The production
app's rootfs, homes, workspaces, profile and pairing keys must remain intact. The
instrumentation fixtures bootstrap only the `.pr23check` package; ordinary package
runs retain the precondition that a guest is already installed.

```sh
cat > /tmp/horus-device.gradle <<'GRADLE'
allprojects {
    plugins.withId('com.android.application') {
        android.buildTypes.getByName('debug').applicationIdSuffix = '.pr23check'
        if (project.hasProperty('horus.testCmakeVersion')) {
            android.externalNativeBuild.cmake.version = project.property('horus.testCmakeVersion')
        }
    }
}
GRADLE
adb devices -l
cd android
./gradlew -I /tmp/horus-device.gradle :app:connectedDebugAndroidTest
./gradlew -I /tmp/horus-device.gradle :app:installDebug
```

On the validation host, CMake 4.4.3 was already installed; use
`-Phorus.testCmakeVersion=4.4.3` to select it. PRoot and the JNI PTY helper were
rebuilt from source with NDK 27.1.12297006, targeting API 24. `buildAlpineRuntime`
invokes `scripts/native/build-proot-runtime.sh` and regenerates the binary digest
manifest before packaging.

`Pr23RuntimeDeviceTest` uses a short, disposable guest and validates:

- AF_UNIX bind/connect at `/tmp/claude-messaging-61001/12264.sock` as UID 61001.
- Guest `/tmp` writes reaching the writable host `PROOT_TMP_DIR`; startup removes
  orphaned PID-named staging files while preserving live-process files.
- Removing a hardlink source directory while a surviving alias retains its data.
  `PROOT_L2S_DIR` uses persistent app storage outside temporary/package directories,
  with an identity bind for its absolute backing paths. Partial storage resets
  preserve backing data; resetting both home and workspace clears it.
- Fresh Codex provisioning, ARM64 optional-package resolution and `codex --version`.
- The GC defaults, MSBuild server opt-outs and `UseSharedCompilation=false`;
  .NET 10 console restore/build/execution without extra build-server flags.
- Interactive Zsh `false` followed by `exit` or Ctrl-D returning zero, while
  explicit exit 137 and guest SIGKILL retain 137. Interactive `-c` launchers
  preserve CLI command failures.
- A real Android `TerminalInputView` emitting byte `09` with all Ctrl/Alt combinations.

The complete suite also covers seccomp off/on, PTY control sequences, Ctrl-C,
resize, process teardown, rootfs installation/probes, foreground service lifetime,
package workflows/persistence, GitHub CLI and harness provisioning/recovery, and
an offline four-CLI compatibility matrix. Authentication/resume is deliberately
recorded as not tested because fixtures contain no credentials; Linux sandbox
support and optional doctor commands are recorded separately from offline help. On this
kernel, the Codex Linux sandbox probe returns exit 1; the unsandboxed probe passes.
The unconfigured Codex doctor/auth check is also recorded as failed, not mistaken
for an installation or offline-execution failure.

For focused harness diagnosis, select
`TerminalToolchainDeviceTest#provisionsHarnessTargetsBeforeTheirInteractiveSessions`
with instrumentation argument `horusHarnessTarget=opencode` (or `claude`/`codex`).
`horusKeepFailedGuest=true` retains a failed disposable guest for direct ADB
instrumentation diagnosis. Gradle's connected runner may uninstall its target
package afterward, so retaining a guest across that teardown requires installing
the app/test APKs and invoking `adb shell am instrument` directly. Remove only
those explicitly retained test-owned guests after diagnosis.

Validation on 2026-10-14 used a Samsung Galaxy S23 Ultra (SM-S918B), ARM64,
Android 16 / API 36, kernel `5.15.189-android13-8-33413713-abS918BXXSAFZF5`.
.NET SDK 10.0.303 / runtime 10.0.12 built and ran a console application;
Codex 0.162.1 resolved `@openai/codex-linux-arm64` 0.162.1-linux-arm64.

Host checks passed: 39 Jest suites / 347 tests; 225 Android unit tests with the
existing opt-in native throughput benchmark skipped; TypeScript typecheck; native
Unix-socket translation and initial-guest exit-status checks.

The final unfiltered `:app:connectedDebugAndroidTest` run passed all **14 tests**
with **zero failures and zero skips**, covering the six existing device classes
and `Pr23RuntimeDeviceTest`. Seccomp off/on each passed all 16 probe steps. The
four-CLI matrix installed Claude 2.1.296, Codex 0.162.1, OpenCode 1.19.0 and Gemini
0.64.0; offline execution and relaunch passed for all four. The separate harness
test passed fresh provisioning, root/non-root execution and intentional payload
corruption recovery for Codex and OpenCode.
