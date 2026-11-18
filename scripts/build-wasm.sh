#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Panda3DS -> WebAssembly (Emscripten) Build Script
# ==============================================================================
# Note on upstream wheremyfoodat/Panda3DS:
#   Upstream Panda3DS currently targets x86_64 and arm64 hosts via Dynarmic JIT
#   (CMakeLists.txt aborts with "Currently unsupported CPU architecture" on
#   wasm32) and names its binary target "Alber" without an ENABLE_SDL2 option
#   or ARM interpreter backend. If building against a WASM-patched fork/branch,
#   set PANDA3DS_REPO / PANDA3DS_BRANCH below.
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${WORK_DIR:-$ROOT_DIR/.wasm-build}"
EMSDK_DIR="${EMSDK_DIR:-$WORK_DIR/emsdk}"
PANDA3DS_REPO="${PANDA3DS_REPO:-https://github.com/wheremyfoodat/Panda3DS.git}"
PANDA3DS_DIR="${PANDA3DS_DIR:-$WORK_DIR/Panda3DS}"
BUILD_DIR="$PANDA3DS_DIR/build-wasm"
OUT_DIR="$ROOT_DIR/public/wasm"

mkdir -p "$WORK_DIR" "$OUT_DIR"

echo "[1/5] Checking Emscripten toolchain (emcmake, emmake, em++)..."
if ! command -v emcmake >/dev/null 2>&1 || ! command -v emmake >/dev/null 2>&1 || ! command -v em++ >/dev/null 2>&1; then
  if [[ ! -d "$EMSDK_DIR" ]]; then
    echo "emsdk not found in PATH. Cloning emsdk into $EMSDK_DIR..."
    git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
  fi
  pushd "$EMSDK_DIR" >/dev/null
  ./emsdk install latest
  ./emsdk activate latest
  # shellcheck disable=SC1091
  source "$EMSDK_DIR/emsdk_env.sh"
  popd >/dev/null
else
  echo "Emscripten already active: $(em++ --version | head -n 1)"
fi

if ! command -v cmake >/dev/null 2>&1; then
  echo "ERROR: 'cmake' is not installed or not in PATH. Install CMake >= 3.16 before running this script." >&2
  exit 1
fi

echo "[2/5] Cloning/updating Panda3DS repository (--recursive)..."
if [[ ! -d "$PANDA3DS_DIR/.git" ]]; then
  git clone --recursive "$PANDA3DS_REPO" "$PANDA3DS_DIR"
else
  git -C "$PANDA3DS_DIR" submodule update --init --recursive
fi

if [[ -n "${PANDA3DS_BRANCH:-}" ]]; then
  git -C "$PANDA3DS_DIR" checkout "$PANDA3DS_BRANCH"
  git -C "$PANDA3DS_DIR" submodule update --init --recursive
fi

mkdir -p "$BUILD_DIR"
pushd "$BUILD_DIR" >/dev/null

echo "[3/5] Configuring Panda3DS with emcmake cmake..."
CXX_FLAGS="-O3 -pthread -sUSE_SDL=2 -sUSE_WEBGL2=1 -sFULL_ES3=1"
EXE_LINKER_FLAGS="-pthread -sUSE_SDL=2 -sUSE_WEBGL2=1 -sFULL_ES3=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=512MB -sPTHREAD_POOL_SIZE=4 -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 -sEXPORTED_RUNTIME_METHODS=['FS','IDBFS','callMain'] -lidbfs.js"

if ! emcmake cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DENABLE_QT_GUI=OFF \
  -DENABLE_SDL2=ON \
  -DENABLE_VULKAN=OFF \
  -DCMAKE_CXX_FLAGS="$CXX_FLAGS" \
  -DCMAKE_EXE_LINKER_FLAGS="$EXE_LINKER_FLAGS"; then
  echo "" >&2
  echo "==============================================================================" >&2
  echo "CMake configuration failed." >&2
  echo "If upstream wheremyfoodat/Panda3DS aborted with 'Currently unsupported CPU" >&2
  echo "architecture', upstream lacks an ARM11 interpreter / WASM backend for Dynarmic" >&2
  echo "and defines target 'Alber' instead of 'Panda3DS'." >&2
  echo "==============================================================================" >&2
  exit 1
fi

echo "[4/5] Compiling with emmake make -j$(nproc)..."
emmake make -j"$(nproc)"

echo "[5/5] Copying artifacts (.js, .wasm, .worker.js) to $OUT_DIR..."
copy_artifact() {
  local ext="$1"
  local found=""
  for candidate in "Panda3DS.${ext}" "Alber.${ext}"; do
    if [[ -f "$candidate" ]]; then
      found="$candidate"
      break
    fi
  done
  if [[ -n "$found" ]]; then
    cp -f "$found" "$OUT_DIR/Panda3DS.${ext}"
    echo "Copied $found -> $OUT_DIR/Panda3DS.${ext}"
  else
    echo "WARNING: Artifact *.$ext was not found in $BUILD_DIR" >&2
  fi
}

copy_artifact "js"
copy_artifact "wasm"
copy_artifact "worker.js"

popd >/dev/null
echo "Done! WebAssembly artifacts placed in $OUT_DIR."
