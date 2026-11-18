#include "arm_dyncom_host.hpp"

#include "core/arm/dyncom/arm_dyncom_interpreter.h"
#include "core/arm/dyncom/arm_dyncom_trans.h"
#include "core/arm/skyeye_common/arm_regformat.h"
#include "core/arm/skyeye_common/armstate.h"
#include "core/arm/skyeye_common/vfp/asm_vfp.h"
#include "core/core.h"
#include "core/memory.h"

struct DynComInstance {
    Memory::MemorySystem memSys;
    Core::System coreSys;
    ARMul_State state;

    explicit DynComInstance(const PandaDynComHost* host)
        : memSys(host), coreSys(host), state(coreSys, memSys, USER32MODE) {}
};

namespace DynComBridge {

DynComInstance* createState(const PandaDynComHost* host, std::uint32_t** outGprs,
                            std::uint32_t** outFprs) {
    auto* inst = new DynComInstance(host);
    *outGprs = inst->state.Reg.data();
    *outFprs = inst->state.ExtReg.data();
    return inst;
}

void destroyState(DynComInstance* instance) {
    delete instance;
}

void resetState(DynComInstance* instance, std::uint32_t initialCpsr, std::uint32_t initialFpscr,
                std::uint32_t initialTlsBase) {
    auto& s = instance->state;
    s.Reset();
    s.ChangePrivilegeMode(USER32MODE);
    s.Reg.fill(0);
    s.ExtReg.fill(0);
    setCPSR(instance, initialCpsr);
    setFPSCR(instance, initialFpscr);
    s.VFP[VFP_FPEXC] = FPEXC_EN;
    s.CP15[CP15_COPROCESSOR_ACCESS_CONTROL] = 0x00F00000;
    setTLSBase(instance, initialTlsBase);
    clearCache(instance);
}

void clearCache(DynComInstance* instance) {
    instance->state.instruction_cache.clear();
    trans_cache_buf_top = 0;
}

void clearCacheRange(DynComInstance* instance, std::uint32_t, std::uint32_t) {
    clearCache(instance);
}

std::uint32_t getCPSR(const DynComInstance* instance) {
    const auto& s = instance->state;
    return (s.Cpsr & 0x0fffffdfu) | ((s.NFlag & 1u) << 31) | ((s.ZFlag & 1u) << 30) |
           ((s.CFlag & 1u) << 29) | ((s.VFlag & 1u) << 28) | ((s.TFlag & 1u) << 5);
}

void setCPSR(DynComInstance* instance, std::uint32_t cpsr) {
    auto& s = instance->state;
    const std::uint32_t mode = cpsr & 0x1Fu;
    if (mode != s.Mode) {
        s.ChangePrivilegeMode(mode);
    }
    s.Cpsr = cpsr;
    s.NFlag = (cpsr >> 31) & 1u;
    s.ZFlag = (cpsr >> 30) & 1u;
    s.CFlag = (cpsr >> 29) & 1u;
    s.VFlag = (cpsr >> 28) & 1u;
    s.TFlag = (cpsr >> 5) & 1u;
}

std::uint32_t getFPSCR(const DynComInstance* instance) {
    return instance->state.VFP[VFP_FPSCR];
}

void setFPSCR(DynComInstance* instance, std::uint32_t fpscr) {
    instance->state.VFP[VFP_FPSCR] = fpscr;
}

void setTLSBase(DynComInstance* instance, std::uint32_t tlsBase) {
    instance->state.CP15[CP15_THREAD_URO] = tlsBase;
}

std::uint32_t runInterpreter(DynComInstance* instance, std::uint64_t numInstrs) {
    instance->state.NumInstrsToExecute = numInstrs;
    return InterpreterMainLoop(&instance->state);
}

}  // namespace DynComBridge
