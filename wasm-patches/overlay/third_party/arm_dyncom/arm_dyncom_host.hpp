#pragma once

#include <cstdint>

struct DynComInstance;

struct PandaDynComHost {
    void* memCtx = nullptr;
    void* kernelCtx = nullptr;
    std::uint64_t* currentTimestamp = nullptr;
    const std::uint64_t* nextTimestamp = nullptr;
    const bool* frameDone = nullptr;

    std::uint8_t (*read8)(void* mem, std::uint32_t vaddr) = nullptr;
    std::uint16_t (*read16)(void* mem, std::uint32_t vaddr) = nullptr;
    std::uint32_t (*read32)(void* mem, std::uint32_t vaddr) = nullptr;
    std::uint64_t (*read64)(void* mem, std::uint32_t vaddr) = nullptr;
    void (*write8)(void* mem, std::uint32_t vaddr, std::uint8_t val) = nullptr;
    void (*write16)(void* mem, std::uint32_t vaddr, std::uint16_t val) = nullptr;
    void (*write32)(void* mem, std::uint32_t vaddr, std::uint32_t val) = nullptr;
    void (*write64)(void* mem, std::uint32_t vaddr, std::uint64_t val) = nullptr;
    void (*serviceSVC)(void* kernel, std::uint32_t swi) = nullptr;

    const std::uintptr_t* readTable = nullptr;
    const std::uintptr_t* writeTable = nullptr;
    std::uint32_t clockScalePct = 100;

    bool shouldYield() const {
        if (frameDone != nullptr && *frameDone) {
            return true;
        }
        if (currentTimestamp != nullptr && nextTimestamp != nullptr &&
            *currentTimestamp >= *nextTimestamp) {
            return true;
        }
        return false;
    }
};

namespace DynComBridge {

DynComInstance* createState(const PandaDynComHost* host, std::uint32_t** outGprs,
                            std::uint32_t** outFprs);
void destroyState(DynComInstance* instance);
void resetState(DynComInstance* instance, std::uint32_t initialCpsr, std::uint32_t initialFpscr,
                std::uint32_t initialTlsBase);

void clearCache(DynComInstance* instance);
void clearCacheRange(DynComInstance* instance, std::uint32_t start, std::uint32_t size);

std::uint32_t getCPSR(const DynComInstance* instance);
void setCPSR(DynComInstance* instance, std::uint32_t cpsr);

std::uint32_t getFPSCR(const DynComInstance* instance);
void setFPSCR(DynComInstance* instance, std::uint32_t fpscr);

void setTLSBase(DynComInstance* instance, std::uint32_t tlsBase);
std::uint32_t runInterpreter(DynComInstance* instance, std::uint64_t numInstrs);

}  // namespace DynComBridge
