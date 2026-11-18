#pragma once

#include "common/common_types.h"

namespace Common {

inline u16 swap16(u16 val) {
    return __builtin_bswap16(val);
}

inline u32 swap32(u32 val) {
    return __builtin_bswap32(val);
}

inline u64 swap64(u64 val) {
    return __builtin_bswap64(val);
}

}  // namespace Common
