# ConveyorGuard AI

Real-time conveyor belt monitoring system with AI vision defect detection, Arduino sensor telemetry, and maintenance work orders.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 + |
| Python | 3.12 |
| pip | any |
| Arduino IDE | 2.x (for uploading the sketch) |

---

## Installation

### 1 — Install Python dependencies

```powershell
cd backend
& "C:\Users\Aarthy\AppData\Local\Programs\Python\Python312\python.exe" -m pip install -r requirements.txt
```

> If there is no `requirements.txt` yet, install manually:
> ```powershell
> & "C:\Users\Aarthy\AppData\Local\Programs\Python\Python312\python.exe" -m pip install fastapi uvicorn[standard] opencv-python torch torchvision ultralytics pillow pyserial
> ```

### 2 — Install Node.js dependencies

```powershell
cd frontend
npm install
```

---

## Starting the App

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — Backend (FastAPI + Arduino bridge)

**Option A — PowerShell script (recommended)**
```powershell
cd backend
.\run_backend.ps1
```

**Option B — Batch file**
```powershell
cd backend
.\run_backend.bat
```

**Option C — Manual**
```powershell
cd backend
& "C:\Users\Aarthy\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

The backend will be available at: `http://127.0.0.1:8000`

---

### Terminal 2 — Frontend (React / Vite)

```powershell
cd frontend
npm run dev
```

Open your browser at: `http://localhost:3000` (or whichever port Vite prints)

---

## Connecting the Arduino

1. Upload the `arduino/conveyor_monitor.ino` sketch to your **Arduino UNO R4 Minima** using Arduino IDE.
2. Make sure the serial baud rate is set to **115200** in the sketch (it is by default).
3. In the app, open the **Conveyor Health** panel (right column).
4. Under **Arduino Minima**, click **Refresh** to detect the COM port.
5. Select the correct port (e.g. `COM3`) and click **Connect**.
6. Live sensor data will begin streaming in the **Live Sensor Telemetry** section.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Backend health check |
| `GET` | `/api/arduino/ports` | List available COM ports |
| `POST` | `/api/arduino/connect` | Connect to Arduino serial port |
| `POST` | `/api/arduino/disconnect` | Disconnect from Arduino |
| `GET` | `/api/arduino/status` | Connection status + last reading |
| `WS` | `/ws/arduino` | Live Arduino sensor stream (JSON) |
| `POST` | `/api/evaluate` | Run ML inference on a single image |
| `WS` | `/ws/evaluate` | Live video frame inference (WebSocket) |

---

## Sensor Mapping (Arduino → App)

| Arduino Field | Sensor | Unit | Hardware |
|---|---|---|---|
| `TEMP` | Temperature | °C | DS18B20 |
| `ACC` + `VIB` | Vibration | mm/s | MPU6050 + digital sensor |
| `DIST` | Belt Tension | cm | HC-SR04 ultrasonic |
| `LOAD` | Load | kg | HX711 load cell |
| `SPEED` | Belt Speed | m/s | Encoder |
| `SOUND` | Acoustic | dB | Sound sensor |
| `IR_LEFT` / `IR_RIGHT` | Alignment | mm | IR sensor pair |

---

## Available ML Models

| Model File | Description |
|---|---|
| `best_stage1.pt` | YOLOv8 Belt ROI & Surface Tear Detector |
| `best_stage2.pt` | PatchCore Memory Bank Anomaly Detector |
| `model.pt` | ConveyCheck Visual Inspection ResNet |
| `yolox_s.pth` | YOLOX-S Surface Crack & Fracture Network |
| `roboflow_conveyor_damage.pt` | Trained Roboflow Belt Damage Detector |

---

## Project Structure

```
project-refine-main/
├── backend/
│   ├── app.py                   # FastAPI server + ML inference
│   ├── arduino_serial.py        # Arduino serial reader & WS bridge
│   ├── run_backend.bat          # Windows batch launcher
│   ├── run_backend.ps1          # PowerShell launcher
│   ├── best_stage1.pt
│   ├── best_stage2.pt
│   ├── model.pt
│   ├── roboflow_conveyor_damage.pt
│   └── yolox_s.pth
└── frontend/
    ├── src/
    │   ├── components/conveyor/
    │   │   ├── AIVision.tsx       # Live camera + model overlay
    │   │   ├── ArduinoPanel.tsx   # Arduino connection widget
    │   │   ├── ConveyorHealth.tsx # Health metrics panel
    │   │   └── SensorTelemetry.tsx# Live sensor chart & tiles
    │   └── lib/conveyor/
    │       ├── store.tsx          # Global state & Arduino data injection
    │       ├── useArduino.ts      # Arduino WebSocket hook
    │       └── types.ts           # Shared TypeScript types
    └── package.json
```

---

## Stopping the App

- **Frontend**: `Ctrl+C` in the frontend terminal
- **Backend**: `Ctrl+C` in the backend terminal
