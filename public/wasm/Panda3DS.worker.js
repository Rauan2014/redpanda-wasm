// Emscripten >= 4/7 bundles pthread worker bootstrapping directly in /wasm/Panda3DS.js.
// This file is kept as a valid Worker entrypoint fallback for static hosts.
if (typeof importScripts === 'function') {
  importScripts('/wasm/Panda3DS.js');
}
