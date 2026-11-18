#pragma once

#include <cstdio>
#include <cstdlib>

[[noreturn]] inline void Crash() {
    std::fprintf(stderr, "[Panda3DS DynCom] Fatal VFP/ARM execution abort\n");
    std::abort();
}
