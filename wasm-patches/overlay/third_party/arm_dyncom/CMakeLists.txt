add_library(arm_dyncom STATIC
    arm_dyncom_bridge.cpp
    src/core/arm/dyncom/arm_dyncom_dec.cpp
    src/core/arm/dyncom/arm_dyncom_interpreter.cpp
    src/core/arm/dyncom/arm_dyncom_thumb.cpp
    src/core/arm/dyncom/arm_dyncom_trans.cpp
    src/core/arm/skyeye_common/armstate.cpp
    src/core/arm/skyeye_common/armsupp.cpp
    src/core/arm/skyeye_common/vfp/vfp.cpp
    src/core/arm/skyeye_common/vfp/vfpsingle.cpp
    src/core/arm/skyeye_common/vfp/vfpdouble.cpp
)

target_include_directories(arm_dyncom PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${CMAKE_CURRENT_SOURCE_DIR}/shim"
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
)

target_include_directories(arm_dyncom INTERFACE
    "${CMAKE_CURRENT_SOURCE_DIR}"
)

target_link_libraries(arm_dyncom PRIVATE fmt::fmt)
