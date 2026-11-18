#pragma once

#include "common/common_types.h"
#include "core/core.h"

namespace Kernel {

class SVCContext {
public:
    explicit SVCContext(Core::System& system_) : system(system_) {}

    void CallSVC(u32 swi) const {
        const auto* host = system.Host();
        if (host != nullptr && host->serviceSVC != nullptr) {
            host->serviceSVC(host->kernelCtx, swi);
        }
    }

private:
    Core::System& system;
};

}  // namespace Kernel
