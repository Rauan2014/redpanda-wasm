#pragma once

#include <atomic>
#include <cstdio>
#include <string>
#include <fmt/format.h>
#include "common/common_types.h"

namespace DynComLog {
inline bool allowLog() {
    static std::atomic<int> count{0};
    return count.load(std::memory_order_relaxed) < 24 &&
           count.fetch_add(1, std::memory_order_relaxed) < 24;
}
}  // namespace DynComLog

#define LOG_TRACE(log_class, ...) ((void)0)
#define LOG_DEBUG(log_class, ...) ((void)0)
#define LOG_INFO(log_class, ...) ((void)0)

#define LOG_WARNING(log_class, ...)                                                                \
    do {                                                                                           \
        if (DynComLog::allowLog()) {                                                               \
            std::fprintf(stderr, "[DynCom WARN] %s\n", fmt::format(__VA_ARGS__).c_str());          \
        }                                                                                          \
    } while (0)

#define LOG_ERROR(log_class, ...)                                                                  \
    do {                                                                                           \
        if (DynComLog::allowLog()) {                                                               \
            std::fprintf(stderr, "[DynCom ERROR] %s\n", fmt::format(__VA_ARGS__).c_str());         \
        }                                                                                          \
    } while (0)

#define LOG_CRITICAL(log_class, ...)                                                               \
    do {                                                                                           \
        std::fprintf(stderr, "[DynCom CRITICAL] %s\n", fmt::format(__VA_ARGS__).c_str());          \
    } while (0)
