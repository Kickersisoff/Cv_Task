cmake_minimum_required(VERSION 3.10)
project(websocket)

set(CMAKE_CXX_STANDARD 17)

# OpenCV Integration
if(WIN32)
    set(OpenCV_DIR "C:/opt/opencv/build/x64/vc16/lib")
endif()
find_package(OpenCV REQUIRED)
include_directories(${OpenCV_INCLUDE_DIRS})

set(Crow_DIR "C:/opt/vcpkg/packages/crow_x64-windows/share/crow")
set(nlohmann_json_DIR "C:/opt/vcpkg/packages/nlohmann-json_x64-windows/share/nlohmann_json")
set(ASIO_INCLUDE_DIR "C:/opt/vcpkg/packages/asio_x64-windows/include")

find_package(Crow CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
set(CPPBASE64_DIR "C:/opt/vcpkg/packages/cpp-base64_x64-windows/include/cpp-base64")

# Add the directory containing base64.h to the include path
include_directories(${CPPBASE64_DIR})

INCLUDE_DIRECTORIES(${CMAKE_CURRENT_SOURCE_DIR}/../tflite-dist/include/)
add_executable(${PROJECT_NAME} main.cpp)

target_link_libraries(websocket PRIVATE Crow::Crow nlohmann_json::nlohmann_json ${OpenCV_LIBS})

if(WIN32)
    find_library(TFLITE tensorflowlite.dll.if HINTS ${CMAKE_CURRENT_SOURCE_DIR}/../tflite-dist/libs/windows_x64/)
    find_library(FLATBUFFERS flatbuffers  HINTS ${CMAKE_CURRENT_SOURCE_DIR}/../tflite-dist/libs/windows_x64/)
    target_link_libraries(${PROJECT_NAME} PRIVATE ${TFLITE} ${FLATBUFFERS} ${OpenCV_LIBS})
endif()

if(WIN32)
    add_custom_command(
        TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/../tflite-dist/libs/windows_x64/tensorflowlite.dll ${CMAKE_BINARY_DIR}/Release/
    )

    add_custom_command(
        TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy ${OpenCV_DIR}/x64/vc15/bin/opencv_world452.dll ${CMAKE_BINARY_DIR}/Release/
    )
endif()
