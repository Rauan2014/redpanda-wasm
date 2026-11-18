#pragma once

#include <memory>
#include <span>

#include "arm_dyncom_host.hpp"
#include "helpers.hpp"
#include "kernel.hpp"
#include "memory.hpp"
#include "scheduler.hpp"

class Emulator;

class CPU {
	struct InstanceDeleter {
		void operator()(DynComInstance* instance) const;
	};

	Memory& mem;
	Kernel& kernel;
	Scheduler& scheduler;
	Emulator& emu;
	PandaDynComHost host;
	u32* gprs = nullptr;
	u32* fprsPtr = nullptr;
	std::unique_ptr<DynComInstance, InstanceDeleter> instance;

  public:
	static constexpr u64 ticksPerSec = Scheduler::arm11Clock;

	CPU(Memory& mem, Kernel& kernel, Emulator& emu);
	~CPU();

	void reset();

	void setReg(int index, u32 value) { gprs[index] = value; }
	u32 getReg(int index) { return gprs[index]; }

	std::span<u32, 16> regs() { return std::span<u32, 16>(gprs, 16); }
	std::span<u32, 32> fprs() { return std::span<u32, 32>(fprsPtr, 32); }

	void setCPSR(u32 value);
	u32 getCPSR();

	void setFPSCR(u32 value);
	u32 getFPSCR();

	void setTLSBase(u32 value);

	u64 getTicks() { return scheduler.currentTimestamp; }
	u64& getTicksRef() { return scheduler.currentTimestamp; }
	Scheduler& getScheduler() { return scheduler; }

	void addTicks(u64 ticks) { scheduler.currentTimestamp += ticks; }

	void clearCache();
	void clearCacheRange(u32 start, u32 size);

	void runFrame();
};
