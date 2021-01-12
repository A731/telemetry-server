# telemetry-server
OpenMCT based telemetry server for HPF021

This repository is about the server side of HPF021's telemetry system.
Most of the OpenMCT code is very similar to the openmct-tutorial code snippits, but with telemetry data coming from UART.
The message protocol for the UART side is described at the telemetry-node repository.
This software runs on nodejs and Apache2, and its intended usage is for Linux on ARM and x86.
### NOTE: Do not run install.sh, it is meant to be run on a clean Raspberry Pi with no other software on it. 
