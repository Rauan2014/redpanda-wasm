#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Panda3DS -> WebAssembly (Emscripten + ARM11 DynCom Interpreter) Build Script
# ==============================================================================
# Applies wasm-patches/ onto wheremyfoodat/Panda3DS (replacing x86_64/arm64-only
# Dynarmic JIT with Azahar's full ARM11v6K/Thumb/VFPv2/CP15 DynCom interpreter,
# Emscripten main-loop integration, GLES 3.00 / WebGL2 fixes, and virtual
# memory fallback without Linux memfd_create) and compiles into public/wasm/.
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${WORK_DIR:-$ROOT_DIR/.wasm-build}"
CMAKE_DIR="${CMAKE_DIR:-$WORK_DIR/cmake}"
EMSDK_DIR="${EMSDK_DIR:-$WORK_DIR/emsdk}"
PANDA3DS_REPO="${PANDA3DS_REPO:-https://github.com/wheremyfoodat/Panda3DS.git}"
PANDA3DS_DIR="${PANDA3DS_DIR:-$WORK_DIR/Panda3DS}"
AZAHAR_REPO="${AZAHAR_REPO:-https://github.com/azahar-emu/azahar.git}"
AZAHAR_DIR="${AZAHAR_DIR:-$WORK_DIR/azahar}"
PATCHES_DIR="$ROOT_DIR/wasm-patches"
BUILD_DIR="$PANDA3DS_DIR/build-wasm"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/public/wasm}"

mkdir -p "$WORK_DIR" "$OUT_DIR"

echo "[1/6] Checking CMake and Emscripten toolchain (emcmake, emmake, em++)..."
if ! command -v cmake >/dev/null 2>&1; then
  if [[ ! -x "$CMAKE_DIR/bin/cmake" ]]; then
    echo "CMake not found in PATH. Downloading portable Linux x86_64 CMake into $CMAKE_DIR..."
    CMAKE_URL="$(python3 -c '
import json, urllib.request
data = json.loads(urllib.request.urlopen("https://api.github.com/repos/Kitware/CMake/releases/latest", timeout=20).read())
for a in data["assets"]:
    if a["name"].endswith("-linux-x86_64.tar.gz"):
        print(a["browser_download_url"])
        break
')"
    curl -fsSL "$CMAKE_URL" -o "$WORK_DIR/cmake.tar.gz"
    rm -rf "$WORK_DIR/cmake.tmp" && mkdir -p "$WORK_DIR/cmake.tmp"
    tar -xzf "$WORK_DIR/cmake.tar.gz" -C "$WORK_DIR/cmake.tmp" --strip-components=1
    rm -f "$WORK_DIR/cmake.tar.gz"
    mv "$WORK_DIR/cmake.tmp" "$CMAKE_DIR"
  fi
  export PATH="$CMAKE_DIR/bin:$PATH"
fi
cmake --version | head -n 1

if ! command -v emcmake >/dev/null 2>&1 || ! command -v emmake >/dev/null 2>&1 || ! command -v em++ >/dev/null 2>&1; then
  if [[ ! -d "$EMSDK_DIR" ]]; then
    echo "emsdk not found in PATH. Cloning emsdk into $EMSDK_DIR..."
    git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
  fi
  pushd "$EMSDK_DIR" >/dev/null
  if [[ ! -x "$EMSDK_DIR/upstream/emscripten/em++" ]]; then
    ./emsdk install latest
    ./emsdk activate latest
  fi
  export EMSDK_QUIET=1
  # shellcheck disable=SC1091
  source "$EMSDK_DIR/emsdk_env.sh"
  popd >/dev/null
else
  echo "Emscripten already active: $(em++ --version | head -n 1)"
fi

echo "[2/6] Cloning/updating Panda3DS and Azahar ARM DynCom sources..."
if [[ ! -d "$PANDA3DS_DIR/.git" ]]; then
  git clone --recursive --shallow-submodules "$PANDA3DS_REPO" "$PANDA3DS_DIR"
else
  git -C "$PANDA3DS_DIR" submodule update --init --recursive
fi

if [[ -n "${PANDA3DS_BRANCH:-}" ]]; then
  git -C "$PANDA3DS_DIR" checkout "$PANDA3DS_BRANCH"
  git -C "$PANDA3DS_DIR" submodule update --init --recursive
fi

if [[ ! -d "$AZAHAR_DIR/.git" ]]; then
  git clone --depth 1 --filter=blob:none --sparse "$AZAHAR_REPO" "$AZAHAR_DIR"
  git -C "$AZAHAR_DIR" sparse-checkout set --no-cone \
    src/core/arm/dyncom src/core/arm/skyeye_common \
    src/core/arm/arm_interface.h src/common/common_types.h src/common/bit_field.h src/common/swap.h
fi

echo "[3/6] Applying Emscripten, WebGL2, and ARM11 DynCom interpreter patches..."
git -C "$PANDA3DS_DIR" checkout -- .
python3 "$PATCHES_DIR/apply.py" "$PATCHES_DIR" "$PANDA3DS_DIR" "$AZAHAR_DIR"

if [[ -d "$BUILD_DIR" ]]; then
  if [[ ! -f "$BUILD_DIR/CMakeCache.txt" ]] || [[ ! -f "$BUILD_DIR/Makefile" ]] || ! grep -q -- "-msimd128" "$BUILD_DIR/CMakeCache.txt" || ! grep -q -- "-flto" "$BUILD_DIR/CMakeCache.txt"; then
    echo "Purging stale/incomplete CMake build directory..."
    rm -rf "$BUILD_DIR"
  fi
fi

mkdir -p "$BUILD_DIR"
pushd "$BUILD_DIR" >/dev/null

echo "[4/6] Configuring Panda3DS with emcmake cmake..."
CXX_FLAGS="-O3 -msimd128 -flto -pthread -fwasm-exceptions -sUSE_SDL=2"
C_FLAGS="-O3 -msimd128 -flto -pthread -sUSE_SDL=2"
EXE_LINKER_FLAGS="-O3 -msimd128 -flto -pthread -fwasm-exceptions -sUSE_SDL=2 -sUSE_WEBGL2=1 -sFULL_ES3=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=512MB -sMAXIMUM_MEMORY=2GB -sSTACK_SIZE=2MB -sPTHREAD_POOL_SIZE=1 -sENVIRONMENT=web,worker -sINVOKE_RUN=0 -sEXIT_RUNTIME=0"

emcmake cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DENABLE_LTO=OFF \
  -DENABLE_QT_GUI=OFF \
  -DENABLE_SDL2=ON \
  -DENABLE_VULKAN=OFF \
  -DCMAKE_C_FLAGS="$C_FLAGS" \
  -DCMAKE_CXX_FLAGS="$CXX_FLAGS" \
  -DCMAKE_EXE_LINKER_FLAGS="$EXE_LINKER_FLAGS"

echo "[5/6] Compiling with emmake make -j$(nproc)..."
emmake make -j"$(nproc)"

echo "[6/6] Copying artifacts (.js, .wasm, .worker.js) to $OUT_DIR..."
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
    return 0
  fi
  return 1
}

copy_artifact "js" || { echo "ERROR: Panda3DS.js not generated" >&2; exit 1; }
copy_artifact "wasm" || { echo "ERROR: Panda3DS.wasm not generated" >&2; exit 1; }
if ! copy_artifact "worker.js"; then
  cat > "$OUT_DIR/Panda3DS.worker.js" <<'EOF'
// Emscripten >= 4/7 bundles pthread worker bootstrapping directly in /wasm/Panda3DS.js.
// This file is kept as a valid Worker entrypoint fallback for static hosts.
if (typeof importScripts === 'function') {
  importScripts('/wasm/Panda3DS.js');
}
EOF
  echo "Wrote Emscripten worker shim -> $OUT_DIR/Panda3DS.worker.js"
fi

popd >/dev/null
echo "Done! WebAssembly artifacts generated in $OUT_DIR"
