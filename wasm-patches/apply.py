#!/usr/bin/env python3
"""
Apply the Emscripten / WebGL2 / ARM11 DynCom interpreter patches to a Panda3DS checkout.
"""

from __future__ import annotations

from pathlib import Path
import sys


def write_if_changed(path: Path, new_text: str) -> None:
    if path.exists() and path.read_text(encoding="utf-8") == new_text:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new_text, encoding="utf-8")


def copy_file_if_changed(src: Path, dst: Path) -> None:
    data = src.read_bytes()
    if dst.exists() and dst.read_bytes() == data:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(data)


def replace_once(path: Path, old: str, new: str, *, allow_already: bool = True) -> None:
    text = path.read_text(encoding="utf-8")
    if allow_already and new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected 1 occurrence in {path}, found {count} for snippet:\n{old[:180]}")
    write_if_changed(path, text.replace(old, new, 1))


def copy_azahar_arm(azahar_dir: Path, p3ds_dir: Path) -> None:
    arm_dyncom_src = p3ds_dir / "third_party" / "arm_dyncom" / "src" / "core" / "arm"
    for sub in ("dyncom", "skyeye_common"):
        src_root = azahar_dir / "src" / "core" / "arm" / sub
        dst_root = arm_dyncom_src / sub
        if not src_root.is_dir():
            raise RuntimeError(f"Missing Azahar directory: {src_root}")
        for src in src_root.rglob("*"):
            if src.is_file():
                copy_file_if_changed(src, dst_root / src.relative_to(src_root))


def copy_overlay(overlay_dir: Path, p3ds_dir: Path) -> None:
    for src in overlay_dir.rglob("*"):
        if src.is_file():
            rel = src.relative_to(overlay_dir)
            copy_file_if_changed(src, p3ds_dir / rel)


def patch_azahar_dyncom(p3ds_dir: Path) -> None:
    dyncom_dir = p3ds_dir / "third_party" / "arm_dyncom" / "src" / "core" / "arm" / "dyncom"

    # Keep static translation cache compact for wasm32 SharedArrayBuffer startup memory
    replace_once(
        dyncom_dir / "arm_dyncom_trans.h",
        "#define TRANS_CACHE_SIZE (64 * 1024 * 2000)",
        "#define TRANS_CACHE_SIZE (16 * 1024 * 1024)",
    )

    interp = dyncom_dir / "arm_dyncom_interpreter.cpp"

    # Prevent translation cache overflow in long-running commercial games
    replace_once(
        interp,
        "static int InterpreterTranslateBlock(ARMul_State* cpu, std::size_t& bb_start, u32 addr) {\n"
        "    MICROPROFILE_SCOPE(DynCom_Decode);\n"
        "\n"
        "    // Decode instruction, get index\n"
        "    // Allocate memory and init InsCream\n"
        "    // Go on next, until terminal instruction\n"
        "    // Save start addr of basicblock in CreamCache\n"
        "    ARM_INST_PTR inst_base = nullptr;\n"
        "    TransExtData ret = TransExtData::NON_BRANCH;\n"
        "    bb_start = trans_cache_buf_top;",
        "static int InterpreterTranslateBlock(ARMul_State* cpu, std::size_t& bb_start, u32 addr) {\n"
        "    MICROPROFILE_SCOPE(DynCom_Decode);\n"
        "    if (trans_cache_buf_top + 65536 >= TRANS_CACHE_SIZE) {\n"
        "        cpu->instruction_cache.clear();\n"
        "        trans_cache_buf_top = 0;\n"
        "    }\n"
        "\n"
        "    // Decode instruction, get index\n"
        "    // Allocate memory and init InsCream\n"
        "    // Go on next, until terminal instruction\n"
        "    // Save start addr of basicblock in CreamCache\n"
        "    ARM_INST_PTR inst_base = nullptr;\n"
        "    TransExtData ret = TransExtData::NON_BRANCH;\n"
        "    bb_start = trans_cache_buf_top;",
    )
    replace_once(
        interp,
        "    cpu->instruction_cache[pc_start] = bb_start;\n\n    return KEEP_GOING;\n}\n\n"
        "static int InterpreterTranslateSingle(ARMul_State* cpu, std::size_t& bb_start, u32 addr) {\n"
        "    MICROPROFILE_SCOPE(DynCom_Decode);\n\n"
        "    ARM_INST_PTR inst_base = nullptr;\n"
        "    bb_start = trans_cache_buf_top;",
        "    cpu->instruction_cache[pc_start | (cpu->TFlag ? 1u : 0u)] = bb_start;\n\n    return KEEP_GOING;\n}\n\n"
        "static int InterpreterTranslateSingle(ARMul_State* cpu, std::size_t& bb_start, u32 addr) {\n"
        "    MICROPROFILE_SCOPE(DynCom_Decode);\n"
        "    if (trans_cache_buf_top + 65536 >= TRANS_CACHE_SIZE) {\n"
        "        cpu->instruction_cache.clear();\n"
        "        trans_cache_buf_top = 0;\n"
        "    }\n\n"
        "    ARM_INST_PTR inst_base = nullptr;\n"
        "    bb_start = trans_cache_buf_top;",
    )
    replace_once(
        interp,
        "    cpu->instruction_cache[pc_start] = bb_start;\n\n    return KEEP_GOING;\n}\n\nstatic int clz",
        "    cpu->instruction_cache[pc_start | (cpu->TFlag ? 1u : 0u)] = bb_start;\n\n    return KEEP_GOING;\n}\n\nstatic int clz",
    )
    replace_once(
        interp,
        "    // Find the cached instruction cream, otherwise translate it...\n"
        "    auto itr = cpu->instruction_cache.find(cpu->Reg[15]);",
        "    // Find the cached instruction cream, otherwise translate it...\n"
        "    auto itr = cpu->instruction_cache.find(cpu->Reg[15] | (cpu->TFlag ? 1u : 0u));",
    )

    # Synchronize PC/CPSR/ticks cleanly around Panda3DS Kernel::serviceSVC context switches
    replace_once(
        interp,
        "SWI_INST: {\n"
        "    if (inst_base->cond == ConditionCode::AL || CondPassed(cpu, inst_base->cond)) {\n"
        "        swi_inst* const inst_cream = (swi_inst*)inst_base->component;\n"
        "        cpu->system.GetRunningCore().GetTimer().AddTicks(num_instrs);\n"
        "        cpu->NumInstrsToExecute =\n"
        "            num_instrs >= cpu->NumInstrsToExecute ? 0 : cpu->NumInstrsToExecute - num_instrs;\n"
        "        num_instrs = 0;\n"
        "        Kernel::SVCContext{cpu->system}.CallSVC(inst_cream->num & 0xFFFF);\n"
        "        // The kernel would call ERET to get here, which clears exclusive memory state.\n"
        "        cpu->UnsetExclusiveMemoryAddress();\n"
        "    }\n\n"
        "    cpu->Reg[15] += cpu->GetInstructionSize();\n"
        "    INC_PC(sizeof(swi_inst));\n"
        "    FETCH_INST;\n"
        "    GOTO_NEXT_INST;\n"
        "}",
        "SWI_INST: {\n"
        "    if (inst_base->cond == ConditionCode::AL || CondPassed(cpu, inst_base->cond)) {\n"
        "        swi_inst* const inst_cream = (swi_inst*)inst_base->component;\n"
        "        cpu->Reg[15] += cpu->GetInstructionSize();\n"
        "        SAVE_NZCVT;\n"
        "        const u32 svcNum = inst_cream->num & 0xFFFF;\n"
        "        cpu->system.GetRunningCore().GetTimer().AddTicks(num_instrs + ((svcNum & 0xFF) == 0x28 ? 152 : 1));\n"
        "        cpu->NumInstrsToExecute =\n"
        "            num_instrs >= cpu->NumInstrsToExecute ? 0 : cpu->NumInstrsToExecute - num_instrs;\n"
        "        num_instrs = 0;\n"
        "        const u32 saved_pc = cpu->Reg[15];\n"
        "        const u32 saved_sp = cpu->Reg[13];\n"
        "        const u32 saved_cpsr = cpu->Cpsr;\n"
        "        const u32 saved_tls = cpu->CP15[CP15_THREAD_URO];\n"
        "        Kernel::SVCContext{cpu->system}.CallSVC(svcNum);\n"
        "        // The kernel would call ERET to get here, which clears exclusive memory state.\n"
        "        cpu->UnsetExclusiveMemoryAddress();\n"
        "        const auto* host = cpu->system.Host();\n"
        "        if (host != nullptr && host->shouldYield()) {\n"
        "            LOAD_NZCVT;\n"
        "            goto END;\n"
        "        }\n"
        "        if (cpu->Reg[15] != saved_pc || cpu->Reg[13] != saved_sp ||\n"
        "            cpu->Cpsr != saved_cpsr || cpu->CP15[CP15_THREAD_URO] != saved_tls) {\n"
        "            LOAD_NZCVT;\n"
        "            if (host != nullptr && host->currentTimestamp != nullptr && host->nextTimestamp != nullptr) {\n"
        "                cpu->NumInstrsToExecute = (*host->nextTimestamp > *host->currentTimestamp)\n"
        "                                              ? (*host->nextTimestamp - *host->currentTimestamp)\n"
        "                                              : 0;\n"
        "                if (cpu->NumInstrsToExecute == 0) {\n"
        "                    goto END;\n"
        "                }\n"
        "            }\n"
        "            goto DISPATCH;\n"
        "        }\n"
        "        INC_PC(sizeof(swi_inst));\n"
        "        FETCH_INST;\n"
        "        GOTO_NEXT_INST;\n"
        "    }\n\n"
        "    cpu->Reg[15] += cpu->GetInstructionSize();\n"
        "    INC_PC(sizeof(swi_inst));\n"
        "    FETCH_INST;\n"
        "    GOTO_NEXT_INST;\n"
        "}",
    )


def patch_panda3ds(p3ds_dir: Path) -> None:
    # 1. CMakeLists.txt
    cmake = p3ds_dir / "CMakeLists.txt"
    replace_once(
        cmake,
        "if(ANDROID)\n"
        "    set(DEFAULT_OPENGL_PROFILE OpenGLES)\n"
        "else()\n"
        "    set(DEFAULT_OPENGL_PROFILE OpenGL)\n"
        "endif()",
        "if(ANDROID OR EMSCRIPTEN)\n"
        "    set(DEFAULT_OPENGL_PROFILE OpenGLES)\n"
        "else()\n"
        "    set(DEFAULT_OPENGL_PROFILE OpenGL)\n"
        "endif()",
    )
    replace_once(
        cmake,
        "if(IOS)\n"
        "    set(ENABLE_DISCORD_RPC OFF)\n"
        "    set(ENABLE_LUAJIT OFF)\n"
        "endif()",
        "if(IOS OR EMSCRIPTEN)\n"
        "    set(ENABLE_DISCORD_RPC OFF)\n"
        "    set(ENABLE_LUAJIT OFF)\n"
        "endif()\n"
        "if(EMSCRIPTEN)\n"
        "    set(ENABLE_VULKAN OFF CACHE BOOL \"\" FORCE)\n"
        "    set(ENABLE_METAL OFF CACHE BOOL \"\" FORCE)\n"
        "    set(ENABLE_QT_GUI OFF CACHE BOOL \"\" FORCE)\n"
        "    set(ENABLE_RENDERDOC_API OFF CACHE BOOL \"\" FORCE)\n"
        "    set(ENABLE_FASTMEM OFF CACHE BOOL \"\" FORCE)\n"
        "    set(ENABLE_TESTS OFF CACHE BOOL \"\" FORCE)\n"
        "    set(ENABLE_WAYLAND OFF CACHE BOOL \"\" FORCE)\n"
        "    set(DISABLE_SSE4 ON CACHE BOOL \"\" FORCE)\n"
        "    set(OPENGL_PROFILE OpenGLES CACHE STRING \"\" FORCE)\n"
        "endif()",
    )
    replace_once(
        cmake,
        "include_directories(third_party/dynarmic/src)",
        "if(NOT EMSCRIPTEN)\n    include_directories(third_party/dynarmic/src)\nendif()",
    )
    replace_once(
        cmake,
        "if (NOT ANDROID)\n    if (USE_SYSTEM_SDL2)",
        "if (NOT ANDROID AND NOT EMSCRIPTEN)\n    if (USE_SYSTEM_SDL2)",
    )
    replace_once(
        cmake,
        "if(NOT APPLE AND (CMAKE_SYSTEM_PROCESSOR STREQUAL \"aarch64\" OR CMAKE_SYSTEM_PROCESSOR STREQUAL \"arm64\"))\n"
        "    set(CRYPTOPP_OPT_DISABLE_ASM ON CACHE BOOL \"\" FORCE)\n"
        "endif()",
        "if(EMSCRIPTEN OR (NOT APPLE AND (CMAKE_SYSTEM_PROCESSOR STREQUAL \"aarch64\" OR CMAKE_SYSTEM_PROCESSOR STREQUAL \"arm64\")))\n"
        "    set(CRYPTOPP_OPT_DISABLE_ASM ON CACHE BOOL \"\" FORCE)\n"
        "endif()",
    )
    replace_once(
        cmake,
        "if(HOST_X64 OR HOST_ARM64)\n"
        "    set(DYNARMIC_TESTS OFF)\n"
        "    set(DYNARMIC_FRONTENDS \"A32\" CACHE STRING \"\")\n"
        "    add_subdirectory(third_party/dynarmic)\n"
        "    add_compile_definitions(CPU_DYNARMIC)\n"
        "else()\n"
        "    message(FATAL_ERROR \"Currently unsupported CPU architecture\")\n"
        "endif()",
        "if(EMSCRIPTEN)\n"
        "    add_subdirectory(third_party/arm_dyncom)\n"
        "    add_compile_definitions(CPU_DYNCOM)\n"
        "elseif(HOST_X64 OR HOST_ARM64)\n"
        "    set(DYNARMIC_TESTS OFF)\n"
        "    set(DYNARMIC_FRONTENDS \"A32\" CACHE STRING \"\")\n"
        "    add_subdirectory(third_party/dynarmic)\n"
        "    add_compile_definitions(CPU_DYNARMIC)\n"
        "else()\n"
        "    message(FATAL_ERROR \"Currently unsupported CPU architecture\")\n"
        "endif()",
    )
    replace_once(
        cmake,
        "set(CAPSTONE_ARCHITECTURE_DEFAULT OFF)\n"
        "set(CAPSTONE_ARM_SUPPORT ON)\n"
        "set(CAPSTONE_BUILD_MACOS_THIN ON)\n"
        "add_subdirectory(third_party/capstone)\n"
        "include_directories(third_party/capstone/include)",
        "if(NOT EMSCRIPTEN)\n"
        "    set(CAPSTONE_ARCHITECTURE_DEFAULT OFF)\n"
        "    set(CAPSTONE_ARM_SUPPORT ON)\n"
        "    set(CAPSTONE_BUILD_MACOS_THIN ON)\n"
        "    add_subdirectory(third_party/capstone)\n"
        "    include_directories(third_party/capstone/include)\n"
        "endif()",
    )
    replace_once(
        cmake,
        "set(SOURCE_FILES src/emulator.cpp src/io_file.cpp src/config.cpp\n"
        "                 src/core/CPU/cpu_dynarmic.cpp src/core/CPU/dynarmic_cycles.cpp",
        "if(EMSCRIPTEN)\n"
        "    set(CPU_SOURCE_FILES src/core/CPU/cpu_dyncom.cpp)\n"
        "else()\n"
        "    set(CPU_SOURCE_FILES src/core/CPU/cpu_dynarmic.cpp src/core/CPU/dynarmic_cycles.cpp)\n"
        "endif()\n\n"
        "set(SOURCE_FILES src/emulator.cpp src/io_file.cpp src/config.cpp\n"
        "                 ${CPU_SOURCE_FILES}",
    )
    replace_once(
        cmake,
        "target_link_libraries(AlberCore PRIVATE dynarmic glad resources_console_fonts fdk-aac)\n"
        "target_link_libraries(AlberCore PUBLIC glad capstone fmt::fmt teakra)",
        "if(EMSCRIPTEN)\n"
        "    target_link_libraries(AlberCore PRIVATE glad resources_console_fonts fdk-aac)\n"
        "    target_link_libraries(AlberCore PUBLIC arm_dyncom glad fmt::fmt teakra)\n"
        "else()\n"
        "    target_link_libraries(AlberCore PRIVATE dynarmic glad resources_console_fonts fdk-aac)\n"
        "    target_link_libraries(AlberCore PUBLIC glad capstone fmt::fmt teakra)\n"
        "endif()",
    )
    replace_once(
        p3ds_dir / "third_party" / "toml11" / "toml" / "comments.hpp",
        "#include <initializer_list>",
        "#include <exception>\n#include <initializer_list>",
    )
    replace_once(
        cmake,
        "    target_link_libraries(Alber PRIVATE AlberCore)\n"
        "    target_sources(Alber PRIVATE ${FRONTEND_SOURCE_FILES} ${FRONTEND_HEADER_FILES} ${GL_CONTEXT_SOURCE_FILES} ${APP_RESOURCES})",
        "    target_link_libraries(Alber PRIVATE AlberCore)\n"
        "    target_sources(Alber PRIVATE ${FRONTEND_SOURCE_FILES} ${FRONTEND_HEADER_FILES} ${GL_CONTEXT_SOURCE_FILES} ${APP_RESOURCES})\n"
        "    if(EMSCRIPTEN)\n"
        "        set_target_properties(Alber PROPERTIES OUTPUT_NAME \"Panda3DS\")\n"
        "    endif()",
    )

    # 2. third_party/glad/CMakeLists.txt (do not pull X11/GLX/EGL stubs into Emscripten)
    replace_once(
        p3ds_dir / "third_party" / "glad" / "CMakeLists.txt",
        "elseif(NOT APPLE)\n    set(GLAD_FILES ${GLAD_FILES} src/glad_egl.c src/glad_glx.c)",
        "elseif(NOT APPLE AND NOT EMSCRIPTEN)\n    set(GLAD_FILES ${GLAD_FILES} src/glad_egl.c src/glad_glx.c)",
    )

    # 3. include/cpu.hpp
    replace_once(
        p3ds_dir / "include" / "cpu.hpp",
        "#ifdef CPU_DYNARMIC\n#include \"cpu_dynarmic.hpp\"",
        "#ifdef CPU_DYNARMIC\n#include \"cpu_dynarmic.hpp\"\n#elif defined(CPU_DYNCOM)\n#include \"cpu_dyncom.hpp\"",
    )

    # 4. host_memory & virtual_buffer Emscripten fallback (no memfd_create / mmap fastmem)
    replace_once(
        p3ds_dir / "third_party" / "host_memory" / "host_memory.cpp",
        "#elif defined(__linux__) || defined(__FreeBSD__) || (defined(TARGET_OS_OSX) && TARGET_OS_OSX == 1)  // ^^^ Windows ^^^ vvv Linux vvv",
        "#elif (defined(__linux__) || defined(__FreeBSD__) || (defined(TARGET_OS_OSX) && TARGET_OS_OSX == 1)) && !defined(__EMSCRIPTEN__)  // ^^^ Windows ^^^ vvv Linux vvv",
    )
    replace_once(
        p3ds_dir / "third_party" / "host_memory" / "host_memory.cpp",
        "#elif (defined(__linux__) || defined(__FreeBSD__)) || \\\n"
        "\t(defined(TARGET_OS_OSX) && TARGET_OS_OSX == 1) && defined(PANDA3DS_HARDWARE_FASTMEM)  // ^^^ Windows ^^^ vvv Linux vvv",
        "#elif ((defined(__linux__) || defined(__FreeBSD__)) || \\\n"
        "\t(defined(TARGET_OS_OSX) && TARGET_OS_OSX == 1)) && defined(PANDA3DS_HARDWARE_FASTMEM) && !defined(__EMSCRIPTEN__)  // ^^^ Windows ^^^ vvv Linux vvv",
    )
    replace_once(
        p3ds_dir / "third_party" / "host_memory" / "host_memory.cpp",
        "\t\ttry {\n"
        "\t\t\t// Fastmem is disabled, just throw bad alloc and use the VirtualBuffer fallback.\n"
        "\t\t\tif (!enableFastmem) {\n"
        "\t\t\t\tthrow std::bad_alloc{};\n"
        "\t\t\t}",
        "\t\ttry {\n"
        "\t\t\tif (!enableFastmem) {\n"
        "\t\t\t\tfallback_buffer = std::make_unique<Common::VirtualBuffer<u8>>(backing_size);\n"
        "\t\t\t\tbacking_base = fallback_buffer->data();\n"
        "\t\t\t\tvirtual_base = nullptr;\n"
        "\t\t\t\treturn;\n"
        "\t\t\t}",
    )
    replace_once(
        p3ds_dir / "include" / "helpers.hpp",
        "\t\tstd::cout << termcolor::on_red << \"[FATAL] \";\n"
        "\t\tstd::printf(fmt, args...);\n"
        "\t\tstd::cout << termcolor::reset << \"\\n\";\n\n"
        "\t\texit(1);",
        "\t\tstd::cout << termcolor::on_red << \"[FATAL] \";\n"
        "\t\tstd::printf(fmt, args...);\n"
        "\t\tstd::cout << termcolor::reset << \"\\n\" << std::flush;\n"
        "\t\tstd::fflush(stdout);\n"
        "\t\tstd::fflush(stderr);\n\n"
        "\t\texit(1);",
    )
    replace_once(
        p3ds_dir / "third_party" / "host_memory" / "virtual_buffer.cpp",
        "#ifdef _WIN32\n#include <windows.h>\n#else\n#include <sys/mman.h>\n#endif",
        "#ifdef _WIN32\n#include <windows.h>\n#elif defined(__EMSCRIPTEN__)\n#include <cstdlib>\n#else\n#include <sys/mman.h>\n#endif",
    )
    replace_once(
        p3ds_dir / "third_party" / "host_memory" / "virtual_buffer.cpp",
        "#ifdef _WIN32\n\t\tvoid* base{VirtualAlloc(nullptr, size, MEM_COMMIT, PAGE_READWRITE)};\n#else",
        "#ifdef _WIN32\n\t\tvoid* base{VirtualAlloc(nullptr, size, MEM_COMMIT, PAGE_READWRITE)};\n"
        "#elif defined(__EMSCRIPTEN__)\n\t\tvoid* base{std::calloc(1, size)};\n#else",
    )
    replace_once(
        p3ds_dir / "third_party" / "host_memory" / "virtual_buffer.cpp",
        "#ifdef _WIN32\n\t\tif (!VirtualFree(base, 0, MEM_RELEASE)) {\n\t\t\tHelpers::panic(\"Failed to free memory pages\");\n\t\t}\n#else",
        "#ifdef _WIN32\n\t\tif (!VirtualFree(base, 0, MEM_RELEASE)) {\n\t\t\tHelpers::panic(\"Failed to free memory pages\");\n\t\t}\n"
        "#elif defined(__EMSCRIPTEN__)\n\t\tstd::free(base);\n#else",
    )

    # 5. WebGL 2 ES 3.00 shaders + GLES/WebGL2 renderer fixes
    for shader in ("opengl_es_display.vert", "opengl_es_display.frag"):
        replace_once(
            p3ds_dir / "src" / "host_shaders" / shader,
            "#version 310 es",
            "#version 300 es",
        )

    opengl_hpp = p3ds_dir / "third_party" / "opengl" / "opengl.hpp"
    replace_once(
        opengl_hpp,
        "\tstatic void enableLogicOp() { glEnable(GL_COLOR_LOGIC_OP); }\n"
        "\tstatic void disableLogicOp() { glDisable(GL_COLOR_LOGIC_OP); }",
        "#if defined(USING_GLES) || defined(__EMSCRIPTEN__)\n"
        "\tstatic void enableLogicOp() {}\n"
        "\tstatic void disableLogicOp() {}\n"
        "#else\n"
        "\tstatic void enableLogicOp() { glEnable(GL_COLOR_LOGIC_OP); }\n"
        "\tstatic void disableLogicOp() { glDisable(GL_COLOR_LOGIC_OP); }\n"
        "#endif",
    )
    replace_once(
        opengl_hpp,
        "\tstatic void enableClipPlane(GLuint index) { glEnable(GL_CLIP_DISTANCE0 + index); }\n"
        "\tstatic void disableClipPlane(GLuint index) { glDisable(GL_CLIP_DISTANCE0 + index); }",
        "#if defined(USING_GLES) || defined(__EMSCRIPTEN__)\n"
        "\tstatic void enableClipPlane(GLuint) {}\n"
        "\tstatic void disableClipPlane(GLuint) {}\n"
        "#else\n"
        "\tstatic void enableClipPlane(GLuint index) { glEnable(GL_CLIP_DISTANCE0 + index); }\n"
        "\tstatic void disableClipPlane(GLuint index) { glDisable(GL_CLIP_DISTANCE0 + index); }\n"
        "#endif",
    )
    replace_once(
        opengl_hpp,
        "\tstatic void setLogicOp(GLenum op) { glLogicOp(op); }",
        "#if defined(USING_GLES) || defined(__EMSCRIPTEN__)\n"
        "\tstatic void setLogicOp(GLenum) {}\n"
        "#else\n"
        "\tstatic void setLogicOp(GLenum op) { glLogicOp(op); }\n"
        "#endif",
    )
    replace_once(
        opengl_hpp,
        "    static void setFillMode(GLenum mode) { glPolygonMode(GL_FRONT_AND_BACK, mode); }\n"
        "    static void setFillMode(FillMode mode) { glPolygonMode(GL_FRONT_AND_BACK, static_cast<GLenum>(mode)); }",
        "#if defined(USING_GLES) || defined(__EMSCRIPTEN__)\n"
        "    static void setFillMode(GLenum) {}\n"
        "    static void setFillMode(FillMode) {}\n"
        "#else\n"
        "    static void setFillMode(GLenum mode) { glPolygonMode(GL_FRONT_AND_BACK, mode); }\n"
        "    static void setFillMode(FillMode mode) { glPolygonMode(GL_FRONT_AND_BACK, static_cast<GLenum>(mode)); }\n"
        "#endif",
    )

    renderer_gl = p3ds_dir / "src" / "core" / "renderer_gl" / "renderer_gl.cpp"
    replace_once(
        renderer_gl,
        "#include \"PICA/shader_decompiler.hpp\"",
        "#include \"PICA/shader_decompiler.hpp\"\n"
        "#ifdef __EMSCRIPTEN__\n"
        "#include <emscripten/html5.h>\n"
        "#endif",
    )
    replace_once(
        renderer_gl,
        "\tauto gl_resources = cmrc::RendererGL::get_filesystem();\n"
        "\tauto vertexShaderSource = gl_resources.open(\"opengl_vertex_shader.vert\");\n"
        "\tauto fragmentShaderSource = gl_resources.open(\"opengl_fragment_shader.frag\");\n\n"
        "\tOpenGL::Shader vert({vertexShaderSource.begin(), vertexShaderSource.size()}, OpenGL::Vertex);\n"
        "\tOpenGL::Shader frag({fragmentShaderSource.begin(), fragmentShaderSource.size()}, OpenGL::Fragment);\n"
        "\ttriangleProgram.create({vert, frag});\n"
        "\tinitUbershader(triangleProgram);",
        "\tif (!driverInfo.usingGLES) {\n"
        "\t\tauto gl_resources = cmrc::RendererGL::get_filesystem();\n"
        "\t\tauto vertexShaderSource = gl_resources.open(\"opengl_vertex_shader.vert\");\n"
        "\t\tauto fragmentShaderSource = gl_resources.open(\"opengl_fragment_shader.frag\");\n\n"
        "\t\tOpenGL::Shader vert({vertexShaderSource.begin(), vertexShaderSource.size()}, OpenGL::Vertex);\n"
        "\t\tOpenGL::Shader frag({fragmentShaderSource.begin(), fragmentShaderSource.size()}, OpenGL::Fragment);\n"
        "\t\ttriangleProgram.create({vert, frag});\n"
        "\t\tinitUbershader(triangleProgram);\n"
        "\t}",
    )
    replace_once(
        renderer_gl,
        "\tLUTTexture.create(256, Lights::LUT_Count + 1, GL_RG32F);\n"
        "\tLUTTexture.bind();\n"
        "\tLUTTexture.setMinFilter(OpenGL::Linear);\n"
        "\tLUTTexture.setMagFilter(OpenGL::Linear);",
        "\tbool lutLinear = true;\n"
        "#ifdef __EMSCRIPTEN__\n"
        "\tlutLinear = emscripten_webgl_enable_extension(emscripten_webgl_get_current_context(), \"OES_texture_float_linear\") != 0;\n"
        "#endif\n"
        "\tLUTTexture.create(256, Lights::LUT_Count + 1, GL_RG32F);\n"
        "\tLUTTexture.bind();\n"
        "\tLUTTexture.setMinFilter(lutLinear ? OpenGL::Linear : OpenGL::Nearest);\n"
        "\tLUTTexture.setMagFilter(lutLinear ? OpenGL::Linear : OpenGL::Nearest);",
    )
    replace_once(
        renderer_gl,
        "\tbool usingUbershader = emulatorConfig->useUbershaders;",
        "\tbool usingUbershader = !driverInfo.usingGLES && emulatorConfig->useUbershaders;",
    )
    replace_once(
        renderer_gl,
        "\t\tconst auto textureData = std::span{startPointer, tex.sizeInBytes()};  // Get pointer to the texture data in 3DS memory",
        "\t\tconst auto textureData = std::span{startPointer, sizeInBytes};  // Get pointer to the texture data in 3DS memory",
    )
    replace_once(
        renderer_gl,
        "\tif (usingAcceleratedShader) {\n"
        "\t\tglBindBufferRange(\n"
        "\t\t\tGL_UNIFORM_BUFFER, vsUBOBlockBinding, hwShaderUniformUBO->GetGLBufferId(), hwShaderUniformUBOOffset, PICAShader::totalUniformSize()\n"
        "\t\t);\n"
        "\t}",
        "\tif (usingAcceleratedShader) {\n"
        "\t\tconstexpr usize vsUniformPaddedSize = (PICAShader::totalUniformSize() + 15) & ~usize(15);\n"
        "\t\tglBindBufferRange(\n"
        "\t\t\tGL_UNIFORM_BUFFER, vsUBOBlockBinding, hwShaderUniformUBO->GetGLBufferId(), hwShaderUniformUBOOffset, vsUniformPaddedSize\n"
        "\t\t);\n"
        "\t}",
    )
    replace_once(
        renderer_gl,
        "\t\t\tif (shaderUnit.vs.uniformsDirty) {\n"
        "\t\t\t\tshaderUnit.vs.uniformsDirty = false;\n"
        "\t\t\t\tauto uboRes = hwShaderUniformUBO->Map(driverInfo.uboAlignment, PICAShader::totalUniformSize());\n"
        "\t\t\t\tstd::memcpy(uboRes.pointer, shaderUnit.vs.getUniformPointer(), PICAShader::totalUniformSize());\n"
        "\t\t\t\thwShaderUniformUBO->Unmap(PICAShader::totalUniformSize());\n\n"
        "\t\t\t\thwShaderUniformUBOOffset = uboRes.buffer_offset;\n"
        "\t\t\t}",
        "\t\t\tif (shaderUnit.vs.uniformsDirty) {\n"
        "\t\t\t\tshaderUnit.vs.uniformsDirty = false;\n"
        "\t\t\t\tconstexpr usize vsUniformPaddedSize = (PICAShader::totalUniformSize() + 15) & ~usize(15);\n"
        "\t\t\t\tauto uboRes = hwShaderUniformUBO->Map(driverInfo.uboAlignment, vsUniformPaddedSize);\n"
        "\t\t\t\tstd::memcpy(uboRes.pointer, shaderUnit.vs.getUniformPointer(), PICAShader::totalUniformSize());\n"
        "\t\t\t\tstd::memset(static_cast<u8*>(uboRes.pointer) + PICAShader::totalUniformSize(), 0, vsUniformPaddedSize - PICAShader::totalUniformSize());\n"
        "\t\t\t\thwShaderUniformUBO->Unmap(vsUniformPaddedSize);\n\n"
        "\t\t\t\thwShaderUniformUBOOffset = uboRes.buffer_offset;\n"
        "\t\t\t}",
    )
    replace_once(
        p3ds_dir / "third_party" / "miniaudio" / "miniaudio.h",
        "#if defined(MA_EMSCRIPTEN)\n"
        "EMSCRIPTEN_KEEPALIVE\n"
        "void ma_device__on_notification_unlocked(ma_device* pDevice)",
        "#if defined(MA_EMSCRIPTEN)\n"
        "#ifdef __cplusplus\n"
        "extern \"C\"\n"
        "#endif\n"
        "EMSCRIPTEN_KEEPALIVE\n"
        "void ma_device__on_notification_unlocked(ma_device* pDevice)",
    )
    replace_once(
        p3ds_dir / "src" / "core" / "renderer_gl" / "textures.cpp",
        "#include <array>",
        "#include <array>\n#include <vector>",
    )
    replace_once(
        p3ds_dir / "third_party" / "miniaudio" / "miniaudio.h",
        "#if defined(MA_EMSCRIPTEN)\n"
        "EMSCRIPTEN_KEEPALIVE\n"
        "void ma_device__on_notification_unlocked(ma_device* pDevice)",
        "#if defined(MA_EMSCRIPTEN)\n"
        "#ifdef __cplusplus\n"
        "extern \"C\"\n"
        "#endif\n"
        "EMSCRIPTEN_KEEPALIVE\n"
        "void ma_device__on_notification_unlocked(ma_device* pDevice)",
    )
    replace_once(
        p3ds_dir / "src" / "core" / "renderer_gl" / "textures.cpp",
        "    static constexpr std::array<OpenGL::WrappingMode, 8> wrappingModes = {\n"
        "        OpenGL::ClampToEdge, OpenGL::ClampToBorder, OpenGL::Repeat, OpenGL::RepeatMirrored,\n"
        "        OpenGL::ClampToEdge, OpenGL::ClampToBorder, OpenGL::Repeat, OpenGL::Repeat\n"
        "    };",
        "#if defined(USING_GLES) || defined(__EMSCRIPTEN__)\n"
        "    static constexpr std::array<OpenGL::WrappingMode, 8> wrappingModes = {\n"
        "        OpenGL::ClampToEdge, OpenGL::ClampToEdge, OpenGL::Repeat, OpenGL::RepeatMirrored,\n"
        "        OpenGL::ClampToEdge, OpenGL::ClampToEdge, OpenGL::Repeat, OpenGL::Repeat\n"
        "    };\n"
        "#else\n"
        "    static constexpr std::array<OpenGL::WrappingMode, 8> wrappingModes = {\n"
        "        OpenGL::ClampToEdge, OpenGL::ClampToBorder, OpenGL::Repeat, OpenGL::RepeatMirrored,\n"
        "        OpenGL::ClampToEdge, OpenGL::ClampToBorder, OpenGL::Repeat, OpenGL::Repeat\n"
        "    };\n"
        "#endif",
    )

    # 6. SDL2 WebGL2 GLES 3.00 context + emscripten_set_main_loop_arg
    frontend_hpp = p3ds_dir / "include" / "panda_sdl" / "frontend_sdl.hpp"
    replace_once(
        frontend_hpp,
        "\tbool loadROM(const std::filesystem::path& path);\n\tvoid run();",
        "\tbool loadROM(const std::filesystem::path& path);\n\tvoid run();\n\tvoid runSingleFrame();",
    )

    frontend_cpp = p3ds_dir / "src" / "panda_sdl" / "frontend_sdl.cpp"
    replace_once(
        frontend_cpp,
        "#include \"panda_sdl/frontend_sdl.hpp\"",
        "#include \"panda_sdl/frontend_sdl.hpp\"\n"
        "#ifdef __EMSCRIPTEN__\n"
        "#include <emscripten.h>\n"
        "#endif",
    )
    replace_once(
        frontend_cpp,
        "\tif (needOpenGL) {\n"
        "\t\t// Demand 4.1 core for OpenGL renderer (max available on MacOS), 3.3 for the software & null renderers\n"
        "\t\t// MacOS gets mad if we don't explicitly demand a core profile\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, config.rendererType == RendererType::OpenGL ? 4 : 3);\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, config.rendererType == RendererType::OpenGL ? 1 : 3);\n"
        "\t\twindow = SDL_CreateWindow(windowTitle, windowX, windowY, windowWidth, windowHeight, SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE);\n\n"
        "\t\tif (window == nullptr) {\n"
        "\t\t\tHelpers::panic(\"Window creation failed: %s\", SDL_GetError());\n"
        "\t\t}\n\n"
        "\t\tglContext = SDL_GL_CreateContext(window);\n"
        "\t\tif (glContext == nullptr) {\n"
        "\t\t\tHelpers::warn(\"OpenGL context creation failed: %s\\nTrying again with OpenGL ES.\", SDL_GetError());\n\n"
        "\t\t\t// Some low end devices (eg RPi, emulation handhelds) don't support desktop GL, but only OpenGL ES, so fall back to that if GL context\n"
        "\t\t\t// creation failed\n"
        "\t\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_ES);\n"
        "\t\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);\n"
        "\t\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 1);\n"
        "\t\t\tglContext = SDL_GL_CreateContext(window);\n"
        "\t\t\tif (glContext == nullptr) {\n"
        "\t\t\t\tHelpers::panic(\"OpenGL context creation failed: %s\", SDL_GetError());\n"
        "\t\t\t}\n\n"
        "\t\t\tif (!gladLoadGLES2Loader(reinterpret_cast<GLADloadproc>(SDL_GL_GetProcAddress))) {\n"
        "\t\t\t\tHelpers::panic(\"OpenGL init failed\");\n"
        "\t\t\t}\n\n"
        "\t\t\temu.getRenderer()->setupGLES();\n"
        "\t\t} else {\n"
        "\t\t\tif (!gladLoadGLLoader(reinterpret_cast<GLADloadproc>(SDL_GL_GetProcAddress))) {\n"
        "\t\t\t\tHelpers::panic(\"OpenGL init failed\");\n"
        "\t\t\t}\n"
        "\t\t}\n\n"
        "\t\tSDL_GL_SetSwapInterval(config.vsyncEnabled ? 1 : 0);\n"
        "\t}",
        "\tif (needOpenGL) {\n"
        "#ifdef __EMSCRIPTEN__\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_ES);\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 0);\n"
        "\t\twindow = SDL_CreateWindow(windowTitle, windowX, windowY, windowWidth, windowHeight, SDL_WINDOW_OPENGL);\n\n"
        "\t\tif (window == nullptr) {\n"
        "\t\t\tHelpers::panic(\"Window creation failed: %s\", SDL_GetError());\n"
        "\t\t}\n\n"
        "\t\tglContext = SDL_GL_CreateContext(window);\n"
        "\t\tif (glContext == nullptr) {\n"
        "\t\t\tHelpers::panic(\"WebGL2 OpenGL ES 3.0 context creation failed: %s\", SDL_GetError());\n"
        "\t\t}\n\n"
        "\t\tif (!gladLoadGLES2Loader(reinterpret_cast<GLADloadproc>(SDL_GL_GetProcAddress))) {\n"
        "\t\t\tHelpers::panic(\"OpenGL ES init failed\");\n"
        "\t\t}\n\n"
        "\t\temu.getRenderer()->setupGLES();\n"
        "#else\n"
        "\t\t// Demand 4.1 core for OpenGL renderer (max available on MacOS), 3.3 for the software & null renderers\n"
        "\t\t// MacOS gets mad if we don't explicitly demand a core profile\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, config.rendererType == RendererType::OpenGL ? 4 : 3);\n"
        "\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, config.rendererType == RendererType::OpenGL ? 1 : 3);\n"
        "\t\twindow = SDL_CreateWindow(windowTitle, windowX, windowY, windowWidth, windowHeight, SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE);\n\n"
        "\t\tif (window == nullptr) {\n"
        "\t\t\tHelpers::panic(\"Window creation failed: %s\", SDL_GetError());\n"
        "\t\t}\n\n"
        "\t\tglContext = SDL_GL_CreateContext(window);\n"
        "\t\tif (glContext == nullptr) {\n"
        "\t\t\tHelpers::warn(\"OpenGL context creation failed: %s\\nTrying again with OpenGL ES.\", SDL_GetError());\n\n"
        "\t\t\t// Some low end devices (eg RPi, emulation handhelds) don't support desktop GL, but only OpenGL ES, so fall back to that if GL context\n"
        "\t\t\t// creation failed\n"
        "\t\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_ES);\n"
        "\t\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);\n"
        "\t\t\tSDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 1);\n"
        "\t\t\tglContext = SDL_GL_CreateContext(window);\n"
        "\t\t\tif (glContext == nullptr) {\n"
        "\t\t\t\tHelpers::panic(\"OpenGL context creation failed: %s\", SDL_GetError());\n"
        "\t\t\t}\n\n"
        "\t\t\tif (!gladLoadGLES2Loader(reinterpret_cast<GLADloadproc>(SDL_GL_GetProcAddress))) {\n"
        "\t\t\t\tHelpers::panic(\"OpenGL init failed\");\n"
        "\t\t\t}\n\n"
        "\t\t\temu.getRenderer()->setupGLES();\n"
        "\t\t} else {\n"
        "\t\t\tif (!gladLoadGLLoader(reinterpret_cast<GLADloadproc>(SDL_GL_GetProcAddress))) {\n"
        "\t\t\t\tHelpers::panic(\"OpenGL init failed\");\n"
        "\t\t\t}\n"
        "\t\t}\n"
        "#endif\n\n"
        "\t\tSDL_GL_SetSwapInterval(config.vsyncEnabled ? 1 : 0);\n"
        "\t}",
    )
    replace_once(
        frontend_cpp,
        "void FrontendSDL::run() {\n"
        "\tprogramRunning = true;\n"
        "\tkeyboardAnalogX = false;\n"
        "\tkeyboardAnalogY = false;\n"
        "\tholdingRightClick = false;\n\n"
        "\twhile (programRunning) {",
        "void FrontendSDL::run() {\n"
        "\tprogramRunning = true;\n"
        "\tkeyboardAnalogX = false;\n"
        "\tkeyboardAnalogY = false;\n"
        "\tholdingRightClick = false;\n\n"
        "#ifdef __EMSCRIPTEN__\n"
        "\tstatic bool mainLoopRegistered = false;\n"
        "\tif (mainLoopRegistered) {\n"
        "\t\temscripten_resume_main_loop();\n"
        "\t\treturn;\n"
        "\t}\n"
        "\tmainLoopRegistered = true;\n"
        "\temscripten_set_main_loop_arg([](void* userdata) { static_cast<FrontendSDL*>(userdata)->runSingleFrame(); }, this, 0, false);\n"
        "#else\n"
        "\twhile (programRunning) {\n"
        "\t\trunSingleFrame();\n"
        "\t}\n"
        "#endif\n"
        "}\n\n"
        "void FrontendSDL::runSingleFrame() {\n"
        "\tif (!programRunning) {\n"
        "#ifdef __EMSCRIPTEN__\n"
        "\t\temscripten_cancel_main_loop();\n"
        "#endif\n"
        "\t\treturn;\n"
        "\t}",
    )
    replace_once(
        frontend_cpp,
        "\t\tSDL_GL_SwapWindow(window);\n\t}\n}",
        "\tSDL_GL_SwapWindow(window);\n}",
    )

    replace_once(
        p3ds_dir / "src" / "panda_sdl" / "main.cpp",
        "\tFrontendSDL app;\n\n"
        "\tif (argc > 1) {\n"
        "\t\tauto romPath = std::filesystem::current_path() / argv[1];\n"
        "\t\tif (!app.loadROM(romPath)) {\n"
        "\t\t\t// For some reason just .c_str() doesn't show the proper path\n"
        "\t\t\tHelpers::panic(\"Failed to load ROM file: %s\", romPath.string().c_str());\n"
        "\t\t}\n"
        "\t} else {\n"
        "\t\tprintf(\"No ROM inserted! Load a ROM by dragging and dropping it into the emulator window!\\n\");\n"
        "\t}\n\n"
        "\tapp.run();",
        "#ifdef __EMSCRIPTEN__\n"
        "\tstatic FrontendSDL* appPtr = nullptr;\n"
        "\tif (appPtr == nullptr) {\n"
        "\t\tappPtr = new FrontendSDL();\n"
        "\t}\n"
        "\tFrontendSDL& app = *appPtr;\n"
        "#else\n"
        "\tFrontendSDL app;\n"
        "#endif\n\n"
        "\tif (argc > 1) {\n"
        "\t\tauto romPath = std::filesystem::current_path() / argv[1];\n"
        "\t\tif (!app.loadROM(romPath)) {\n"
        "\t\t\t// For some reason just .c_str() doesn't show the proper path\n"
        "\t\t\tHelpers::panic(\"Failed to load ROM file: %s\", romPath.string().c_str());\n"
        "\t\t}\n"
        "\t} else {\n"
        "\t\tprintf(\"No ROM inserted! Load a ROM by dragging and dropping it into the emulator window!\\n\");\n"
        "\t}\n\n"
        "\tapp.run();",
    )

    # 7. Emulator Emscripten save/config path (/user) and Thumb NCSD entrypoint support
    emu_cpp = p3ds_dir / "src" / "emulator.cpp"
    replace_once(
        emu_cpp,
        "#ifdef __ANDROID__\n\tappDataPath = getAndroidAppPath();\n#else",
        "#ifdef __ANDROID__\n\tappDataPath = getAndroidAppPath();\n#elif defined(__EMSCRIPTEN__)\n\tappDataPath = std::filesystem::path(\"/user\");\n#else",
    )
    if "CPSR::Thumb" in emu_cpp.read_text(encoding="utf-8"):
        replace_once(emu_cpp, "CPSR::Thumb", "(1u << 5)", allow_already=False)
    replace_once(
        emu_cpp,
        "\tcpu.setReg(15, loadedNCSD.entrypoint);\n\n"
        "\tif (loadedNCSD.entrypoint & 1) {\n"
        "\t\tHelpers::panic(\"Misaligned NCSD entrypoint; should this start the CPU in Thumb mode?\");\n"
        "\t}",
        "\tcpu.setReg(15, loadedNCSD.entrypoint & ~1u);\n\n"
        "\tif (loadedNCSD.entrypoint & 1) {\n"
        "\t\tcpu.setCPSR(cpu.getCPSR() | (1u << 5));\n"
        "\t}",
    )


def main() -> int:
    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} <wasm-patches-dir> <panda3ds-dir> <azahar-dir>", file=sys.stderr)
        return 1

    patches_dir = Path(sys.argv[1]).resolve()
    p3ds_dir = Path(sys.argv[2]).resolve()
    azahar_dir = Path(sys.argv[3]).resolve()

    copy_azahar_arm(azahar_dir, p3ds_dir)
    copy_overlay(patches_dir / "overlay", p3ds_dir)
    patch_azahar_dyncom(p3ds_dir)
    patch_panda3ds(p3ds_dir)
    print("Successfully applied Emscripten & ARM11 DynCom patches to", p3ds_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
