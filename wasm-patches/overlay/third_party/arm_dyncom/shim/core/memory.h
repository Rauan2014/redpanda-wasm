#pragma once

#include <cstdint>
#include <cstring>

#include "arm_dyncom_host.hpp"
#include "common/common_types.h"

namespace Memory {

struct PageTable {};

class MemorySystem {
public:
    explicit MemorySystem(const PandaDynComHost* host_)
        : host(host_),
          read_table(host_ ? host_->readTable : nullptr),
          write_table(host_ ? host_->writeTable : nullptr) {}

    u8 Read8(u32 vaddr) const {
        const std::uintptr_t p = read_table ? read_table[vaddr >> 12] : 0;
        if (p != 0) [[likely]] {
            return *reinterpret_cast<const u8*>(p + (vaddr & 0xFFFu));
        }
        return host->read8(host->memCtx, vaddr);
    }

    u16 Read16(u32 vaddr) const {
        const u32 off = vaddr & 0xFFFu;
        const std::uintptr_t p = read_table ? read_table[vaddr >> 12] : 0;
        if (p != 0 && off <= 0xFFEu) [[likely]] {
            u16 val;
            std::memcpy(&val, reinterpret_cast<const void*>(p + off), sizeof(val));
            return val;
        }
        return host->read16(host->memCtx, vaddr);
    }

    u32 Read32(u32 vaddr) const {
        const u32 off = vaddr & 0xFFFu;
        const std::uintptr_t p = read_table ? read_table[vaddr >> 12] : 0;
        if (p != 0 && off <= 0xFFCu) [[likely]] {
            u32 val;
            std::memcpy(&val, reinterpret_cast<const void*>(p + off), sizeof(val));
            return val;
        }
        return host->read32(host->memCtx, vaddr);
    }

    u64 Read64(u32 vaddr) const {
        const u32 off = vaddr & 0xFFFu;
        const std::uintptr_t p = read_table ? read_table[vaddr >> 12] : 0;
        if (p != 0 && off <= 0xFF8u) [[likely]] {
            u64 val;
            std::memcpy(&val, reinterpret_cast<const void*>(p + off), sizeof(val));
            return val;
        }
        return host->read64(host->memCtx, vaddr);
    }

    void Write8(u32 vaddr, u8 value) const {
        const std::uintptr_t p = write_table ? write_table[vaddr >> 12] : 0;
        if (p != 0) [[likely]] {
            *reinterpret_cast<u8*>(p + (vaddr & 0xFFFu)) = value;
            return;
        }
        host->write8(host->memCtx, vaddr, value);
    }

    void Write16(u32 vaddr, u16 value) const {
        const u32 off = vaddr & 0xFFFu;
        const std::uintptr_t p = write_table ? write_table[vaddr >> 12] : 0;
        if (p != 0 && off <= 0xFFEu) [[likely]] {
            std::memcpy(reinterpret_cast<void*>(p + off), &value, sizeof(value));
            return;
        }
        host->write16(host->memCtx, vaddr, value);
    }

    void Write32(u32 vaddr, u32 value) const {
        const u32 off = vaddr & 0xFFFu;
        const std::uintptr_t p = write_table ? write_table[vaddr >> 12] : 0;
        if (p != 0 && off <= 0xFFCu) [[likely]] {
            std::memcpy(reinterpret_cast<void*>(p + off), &value, sizeof(value));
            return;
        }
        host->write32(host->memCtx, vaddr, value);
    }

    void Write64(u32 vaddr, u64 value) const {
        const u32 off = vaddr & 0xFFFu;
        const std::uintptr_t p = write_table ? write_table[vaddr >> 12] : 0;
        if (p != 0 && off <= 0xFF8u) [[likely]] {
            std::memcpy(reinterpret_cast<void*>(p + off), &value, sizeof(value));
            return;
        }
        host->write64(host->memCtx, vaddr, value);
    }

    inline const u8* GetReadPointer(u32 vaddr, u32 byte_count) const {
        const u32 off = vaddr & 0xFFFu;
        const std::uintptr_t p = read_table ? read_table[vaddr >> 12] : 0;
        if (p != 0 && byte_count <= 0x1000u && off <= (0x1000u - byte_count)) [[likely]] {
            return reinterpret_cast<const u8*>(p + off);
        }
        return nullptr;
    }

    inline u8* GetWritePointer(u32 vaddr, u32 byte_count) const {
        const u32 off = vaddr & 0xFFFu;
        const std::uintptr_t p = write_table ? write_table[vaddr >> 12] : 0;
        if (p != 0 && byte_count <= 0x1000u && off <= (0x1000u - byte_count)) [[likely]] {
            return reinterpret_cast<u8*>(p + off);
        }
        return nullptr;
    }

private:
    const PandaDynComHost* host;
    const std::uintptr_t* read_table;
    const std::uintptr_t* write_table;
};

}  // namespace Memory
