#ifdef CPU_DYNCOM
#include "cpu_dyncom.hpp"

#include <algorithm>
#include <atomic>
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

#include "arm_defs.hpp"
#include "emulator.hpp"

namespace {
	std::atomic<u32> g_cpuClockScalePct{100};

	u8 hostRead8(void* mem, u32 vaddr) { return static_cast<Memory*>(mem)->read8(vaddr); }
	u16 hostRead16(void* mem, u32 vaddr) { return static_cast<Memory*>(mem)->read16(vaddr); }
	u32 hostRead32(void* mem, u32 vaddr) { return static_cast<Memory*>(mem)->read32(vaddr); }
	u64 hostRead64(void* mem, u32 vaddr) { return static_cast<Memory*>(mem)->read64(vaddr); }
	void hostWrite8(void* mem, u32 vaddr, u8 val) { static_cast<Memory*>(mem)->write8(vaddr, val); }
	void hostWrite16(void* mem, u32 vaddr, u16 val) { static_cast<Memory*>(mem)->write16(vaddr, val); }
	void hostWrite32(void* mem, u32 vaddr, u32 val) { static_cast<Memory*>(mem)->write32(vaddr, val); }
	void hostWrite64(void* mem, u32 vaddr, u64 val) { static_cast<Memory*>(mem)->write64(vaddr, val); }
	void hostServiceSVC(void* kernel, u32 swi) { static_cast<Kernel*>(kernel)->serviceSVC(swi); }
}  // namespace

#ifdef __EMSCRIPTEN__
extern "C" EMSCRIPTEN_KEEPALIVE void panda_set_cpu_clock_scale(std::uint32_t percent) {
	g_cpuClockScalePct.store(std::clamp(percent, 15u, 200u), std::memory_order_relaxed);
}
#endif

void CPU::InstanceDeleter::operator()(DynComInstance* ptr) const {
	if (ptr != nullptr) {
		DynComBridge::destroyState(ptr);
	}
}

CPU::CPU(Memory& mem, Kernel& kernel, Emulator& emu) : mem(mem), kernel(kernel), scheduler(emu.getScheduler()), emu(emu) {
	mem.setCPUTicks(getTicksRef());

	host.memCtx = &this->mem;
	host.kernelCtx = &this->kernel;
	host.currentTimestamp = &scheduler.currentTimestamp;
	host.nextTimestamp = &scheduler.nextTimestamp;
	host.frameDone = &emu.frameDone;
	host.read8 = &hostRead8;
	host.read16 = &hostRead16;
	host.read32 = &hostRead32;
	host.read64 = &hostRead64;
	host.write8 = &hostWrite8;
	host.write16 = &hostWrite16;
	host.write32 = &hostWrite32;
	host.write64 = &hostWrite64;
	host.serviceSVC = &hostServiceSVC;
	host.readTable = this->mem.getReadTable();
	host.writeTable = this->mem.getWriteTable();

	instance.reset(DynComBridge::createState(&host, &gprs, &fprsPtr));
}

CPU::~CPU() = default;

void CPU::reset() {
	DynComBridge::resetState(instance.get(), CPSR::UserMode, FPSCR::MainThreadDefault, VirtualAddrs::TLSBase);
}

void CPU::setCPSR(u32 value) { DynComBridge::setCPSR(instance.get(), value); }
u32 CPU::getCPSR() { return DynComBridge::getCPSR(instance.get()); }

void CPU::setFPSCR(u32 value) { DynComBridge::setFPSCR(instance.get(), value); }
u32 CPU::getFPSCR() { return DynComBridge::getFPSCR(instance.get()); }

void CPU::setTLSBase(u32 value) { DynComBridge::setTLSBase(instance.get(), value); }

void CPU::clearCache() { DynComBridge::clearCache(instance.get()); }
void CPU::clearCacheRange(u32 start, u32 size) { DynComBridge::clearCacheRange(instance.get(), start, size); }

void CPU::runFrame() {
	emu.frameDone = false;
	const u32 scalePct = g_cpuClockScalePct.load(std::memory_order_relaxed);
	host.clockScalePct = scalePct;
#ifdef __EMSCRIPTEN__
	const double cpuStartMs = emscripten_get_now();
	u64 frameInstrs = 0;
#endif

	while (!emu.frameDone) {
		const u64 ticksRemaining =
			(scheduler.nextTimestamp > scheduler.currentTimestamp) ? (scheduler.nextTimestamp - scheduler.currentTimestamp) : 1;
		const u64 scaledBudget = std::max<u64>(1, (ticksRemaining * scalePct) / 100);

		const u32 executed = DynComBridge::runInterpreter(instance.get(), scaledBudget);
#ifdef __EMSCRIPTEN__
		frameInstrs += executed;
#endif
		scheduler.currentTimestamp += (u64(executed) * 100 + scalePct - 1) / scalePct;
		if (executed == 0 && !emu.frameDone && scheduler.currentTimestamp < scheduler.nextTimestamp) {
			scheduler.currentTimestamp += 1;
		}

		emu.pollScheduler();
	}
#ifdef __EMSCRIPTEN__
	Helpers::g_pandaPerf.armInstrs += frameInstrs;
	Helpers::g_pandaPerf.cpuMs += emscripten_get_now() - cpuStartMs;
#endif
}
#endif  // CPU_DYNCOM
