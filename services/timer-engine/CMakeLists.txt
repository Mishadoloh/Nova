cmake_minimum_required(VERSION 3.20)
project(nova_timer_engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(timer_core src/timer_engine.cpp)
target_include_directories(timer_core PUBLIC include)
target_compile_options(timer_core PRIVATE -Wall -Wextra -Wpedantic -Werror)

add_executable(timer-engine src/main.cpp)
target_link_libraries(timer-engine PRIVATE timer_core)
target_compile_options(timer-engine PRIVATE -Wall -Wextra -Wpedantic -Werror)

enable_testing()
add_executable(timer-engine-tests tests/timer_engine_test.cpp)
target_link_libraries(timer-engine-tests PRIVATE timer_core)
add_test(NAME timer-engine-tests COMMAND timer-engine-tests)

