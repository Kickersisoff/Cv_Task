# Real Time Pose Estimation using Webcam

Simple electron app that sends video frames from the frontend to c++ backend, the C++ code behind the scenes (in backend) process the video frames using opencv and tensorflow-lite for pose detection on the received frames. The extracted pose data, including keypoint coordinates, will be streamed through WebSockets to the frontend interface. Printing the angles and the landmark points in the frontend utilising canvas. CrowCpp framework is utilised in the backend to create websocket server.


### Frontend Technologies - 
* Javascript frontend
* Electron js
* ws(websocket)

### Backend Technologies - 
* C++ Backend
* Tensorflow-Lite
* OpenCv
* CrowCpp
* nlohmann/json

### Cmake to Build the c++ code.

Oher C++ Dependencies installed via vcpkg package manager.
