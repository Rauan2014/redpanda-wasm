#pragma once

#include <cstdint>
#include <cstring>
#include <vector>

class DynComICache {
public:
    static constexpr std::uint32_t INVALID = 0xFFFFFFFFu;
    static constexpr std::uint32_t L2_BITS = 12;
    static constexpr std::uint32_t L2_SIZE = 1u << L2_BITS;
    static constexpr std::uint32_t L2_MASK = L2_SIZE - 1u;
    static constexpr std::uint32_t L1_SIZE = 1u << (32 - L2_BITS);

    DynComICache() : pages(L1_SIZE, nullptr) {}

    DynComICache(const DynComICache&) = delete;
    DynComICache& operator=(const DynComICache&) = delete;

    ~DynComICache() {
        for (std::uint32_t idx : active_pages) {
            delete[] pages[idx];
            pages[idx] = nullptr;
        }
    }

    inline std::uint32_t find(std::uint32_t key) const {
        const std::uint32_t* page = pages[key >> L2_BITS];
        return page ? page[key & L2_MASK] : INVALID;
    }

    inline void insert(std::uint32_t key, std::uint32_t offset) {
        const std::uint32_t l1 = key >> L2_BITS;
        std::uint32_t* page = pages[l1];
        if (!page) [[unlikely]] {
            page = new std::uint32_t[L2_SIZE];
            std::memset(page, 0xFF, L2_SIZE * sizeof(std::uint32_t));
            pages[l1] = page;
            active_pages.push_back(l1);
        }
        page[key & L2_MASK] = offset;
    }

    inline void clear() {
        for (std::uint32_t idx : active_pages) {
            std::memset(pages[idx], 0xFF, L2_SIZE * sizeof(std::uint32_t));
        }
        ++gen;
    }

    inline void invalidateRange(std::uint32_t start, std::uint32_t size) {
        if (size == 0 || size >= 0x400000u) {
            clear();
            return;
        }
        const std::uint32_t end = start + size;
        if (end < start) {
            clear();
            return;
        }
        const std::uint32_t first_l1 = start >> L2_BITS;
        const std::uint32_t last_l1 = (end - 1u) >> L2_BITS;
        for (std::uint32_t l1 = first_l1; l1 <= last_l1; ++l1) {
            if (pages[l1] != nullptr) {
                std::memset(pages[l1], 0xFF, L2_SIZE * sizeof(std::uint32_t));
            }
        }
        ++gen;
    }

    inline std::uint32_t generation() const {
        return gen;
    }

private:
    std::vector<std::uint32_t*> pages;
    std::vector<std::uint32_t> active_pages;
    std::uint32_t gen = 1;
};
