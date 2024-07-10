// tensorflow lite headers
#include <tensorflow/lite/model.h>
#include <tensorflow/lite/interpreter.h>
#include <tensorflow/lite/kernels/register.h>
#include <tensorflow/lite/optional_debug_tools.h>
#include <tensorflow/lite/string_util.h>

#include <opencv2/imgproc.hpp>
#include <opencv2/highgui.hpp>

//Include Crow for web server functionality and JSON parsing
#include <crow.h>
#include <nlohmann/json.hpp>

#include "base64.h"
#include "base64.cpp"

#include <iostream>
#include <fstream>
#include <memory>
#include <vector>

// Constants for the pose estimation model
const int num_keypoints = 17;
const float confidence_threshold = 0.2;

// Function to process the frame and get landmark points
std::vector<std::vector<float>> process_frame(cv::Mat& frame, std::unique_ptr<tflite::Interpreter>& interpreter) {

    // taking input dimensions
    int input_height = interpreter->input_tensor(0)->dims->data[1];
    int input_width = interpreter->input_tensor(0)->dims->data[2];

    // resize the input frame to match model's expected nput size (125x125)
    cv::Mat resized_image;
    cv::resize(frame, resized_image, cv::Size(input_width, input_height));

    // Ensure the input tensor is of type float
    uint8_t* input = interpreter->typed_input_tensor<uint8_t>(0);
    memcpy(input, resized_image.data, resized_image.total() * resized_image.elemSize());

    if (interpreter->Invoke() != kTfLiteOk) {
        throw std::runtime_error("Inference failed");
    }

    float* results = interpreter->typed_output_tensor<float>(0);

    // process the results to extract landmarks
    std::vector<std::vector<float>> landmarks;
    for (int i = 0; i < num_keypoints; ++i) {
        float y = results[i * 3];
        float x = results[i * 3 + 1];
        float conf = results[i * 3 + 2];

        if (conf > confidence_threshold) {
            landmarks.push_back({x, y, conf});
        } else {
            landmarks.push_back({-1, -1, -1}); // Invalid landmark
        }
    }

    return landmarks;
}

int main() {

    // TF lite model path 
    std::string model_file = "C:/Users/OMS/Downloads/lite-model_movenet_singlepose_lightning_tflite_float16_4.tflite";

    // loading the model
    auto model = tflite::FlatBufferModel::BuildFromFile(model_file.c_str());
    if (!model) {
        throw std::runtime_error("Failed to load TFLite model");
    }

    tflite::ops::builtin::BuiltinOpResolver op_resolver;
    std::unique_ptr<tflite::Interpreter> interpreter;
    tflite::InterpreterBuilder(*model, op_resolver)(&interpreter);

    if (interpreter->AllocateTensors() != kTfLiteOk) {
        throw std::runtime_error("Failed to allocate tensors");
    }

    // create a crow app for handling websocket connections
    crow::SimpleApp app;


    // websocket routes and handlers
    CROW_WEBSOCKET_ROUTE(app, "/ws")
        .onaccept([&](const crow::request& req, void** userdata) {
            CROW_LOG_INFO << "WebSocket connection attempt";
            return true;
        })
        .onopen([&](crow::websocket::connection& conn) {
            CROW_LOG_INFO << "New WebSocket connection opened";
        })
        .onmessage([&](crow::websocket::connection& conn, const std::string& data, bool is_binary) {
            if (!is_binary) {

                // Print received data size from the frontend using websockets
                std::cout << "Received data size: " << data.size() << " bytes" << std::endl;

                // Decode base64 image
                std::string decoded_data = base64_decode(data);
                std::vector<uchar> jpg_data(decoded_data.begin(), decoded_data.end());
                cv::Mat frame = cv::imdecode(jpg_data, cv::IMREAD_COLOR);
                
                if (!frame.empty()) {
                    std::cout << "Successfully decoded image. Size: " << frame.cols << "x" << frame.rows << std::endl;
                    
                    try {
                        // process the frame to get landmarks
                        auto landmarks = process_frame(frame, interpreter);
                        
                        // Print the number of landmarks detected
                        std::cout << "Detected " << landmarks.size() << " landmarks" << std::endl;
                        
                        // Print the first landmark to check if the model is working
                        if (!landmarks.empty()) {
                            std::cout << "First landmark: x=" << landmarks[0][0] 
                                    << ", y=" << landmarks[0][1] 
                                    << ", confidence=" << landmarks[0][2] << std::endl;
                        }
                        
                        // converting landmarks to json (for sending it to frontend)
                        nlohmann::json json_landmarks;
                        for (const auto& landmark : landmarks) {
                            json_landmarks.push_back({
                                {"x", landmark[0]},
                                {"y", landmark[1]},
                                {"confidence", landmark[2]}
                            });
                        }
                        
                        // send JSON response back to frontend
                        std::string json_output = json_landmarks.dump();

                        // std::cout << "Sending JSON response. Size: " << json_output.size() << " bytes" << std::endl;
                        conn.send_text(json_output);

                    } catch (const std::exception& e) {
                        CROW_LOG_ERROR << "Error processing frame: " << e.what();
                        conn.send_text("Error processing frame");
                    }
                } else {
                    CROW_LOG_ERROR << "Received empty frame";
                    conn.send_text("Received empty frame");
                }
            } else {
                CROW_LOG_ERROR << "Received unexpected binary data";
                conn.send_text("Please send base64 encoded image data");
            }
        })
        .onerror([&](crow::websocket::connection& conn, const std::string& error_message) {
            CROW_LOG_ERROR << "WebSocket error: " << error_message;
        })
        .onclose([&](crow::websocket::connection& conn, const std::string& reason) {
            CROW_LOG_INFO << "WebSocket connection closed: " << reason;
        });

    // start the crow app
    app.port(8080).multithreaded().run();

    return 0;
}