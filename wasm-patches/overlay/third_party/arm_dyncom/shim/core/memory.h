#pragma once

#include "arm_dyncom_host.hpp"
#include "common/common_types.h"

namespace Memory {

struct PageTable {};

class MemorySystem {
public:
    explicit MemorySystem(const PandaDynComHost* host_) : host(host_) {}

    u8 Read8(u32 vaddr) const {
        return host->read8(host->memCtx, vaddr);
    }

    u16 Read16(u32 vaddr) const {
        return host->read16(host->memCtx, vaddr);
    }

    u32 Read32(u32 vaddr) const {
        return host->read32(host->memCtx, vaddr);
    }

    u64 Read64(u32 vaddr) const {
        return host->read64(host->memCtx, vaddr);
    }

    void Write8(u32 vaddr, u8 value) const {
        host->write8(host->memCtx, vaddr, value);
    }

    void Write16(u32 vaddr, u16 value) const {
        host->write16(host->memCtx, vaddr, value);
    }

    void Write32(u32 vaddr, u32 value) const {
        host->write32(host->memCtx, vaddr, value);
    }

    void Write64(u32 vaddr, u64 value) const {
        host->write64(host->memCtx, vaddr, value);
    }

private:
    const PandaDynComHost* host;
};

}  // namespace Memory
