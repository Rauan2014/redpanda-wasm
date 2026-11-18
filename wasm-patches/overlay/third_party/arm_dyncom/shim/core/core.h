#pragma once

#include "arm_dyncom_host.hpp"
#include "core/core_timing.h"

namespace Core {

class RunningCore {
public:
    explicit RunningCore(const PandaDynComHost* host_) : timer(host_) {}
    const Timing::Timer& GetTimer() const {
        return timer;
    }

private:
    Timing::Timer timer;
};

class System {
public:
    explicit System(const PandaDynComHost* host_) : host(host_), core(host_) {}

    const RunningCore& GetRunningCore() const {
        return core;
    }

    const PandaDynComHost* Host() const {
        return host;
    }

private:
    const PandaDynComHost* host;
    RunningCore core;
};

}  // namespace Core
