#pragma once

#include <cstdio>
#include <cstdlib>
#include "common/logging/log.h"

#define ASSERT(cond)                                                                               \
    do {                                                                                           \
        if (!(cond)) [[unlikely]] {                                                                \
            std::fprintf(stderr, "[DynCom ASSERT] Failed: %s (%s:%d)\n", #cond, __FILE__,          \
                         __LINE__);                                                                \
            std::abort();                                                                          \
        }                                                                                          \
    } while (0)

#define ASSERT_MSG(cond, ...)                                                                      \
    do {                                                                                           \
        if (!(cond)) [[unlikely]] {                                                                \
            std::fprintf(stderr, "[DynCom ASSERT] Failed: %s (%s:%d)\n", #cond, __FILE__,          \
                         __LINE__);                                                                \
            std::abort();                                                                          \
        }                                                                                          \
    } while (0)

#define DEBUG_ASSERT(cond) ((void)0)
#define UNREACHABLE() std::abort()
