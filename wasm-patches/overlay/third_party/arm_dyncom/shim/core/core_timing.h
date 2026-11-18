#pragma once

#include "arm_dyncom_host.hpp"
#include "common/common_types.h"

namespace Core::Timing {

class Timer {
public:
    explicit Timer(const PandaDynComHost* host_) : host(host_) {}

    void AddTicks(u64 ticks) const {
        if (host != nullptr && host->currentTimestamp != nullptr) {
            *host->currentTimestamp += ticks;
        }
    }

private:
    const PandaDynComHost* host;
};

}  // namespace Core::Timing
