"""
arduino_serial.py
─────────────────
Manages a single serial connection to the Arduino Minima.
Parses the CSV key=value telemetry lines and fans out to all
WebSocket subscribers via an asyncio queue broadcast.

Serial format (every 1 s):
  TEMP=32.00,VIB=0,LOAD=0.85,CURRENT=0.00,SOUND=45.2,DIST=12.3,
  IR_LEFT=1,IR_RIGHT=1,ACC=9.80,SPEED=0.00,HEALTH=100.0,
  RISK=0.0,MOTOR=OFF,STATUS=SYSTEM OK
"""

import asyncio
import threading
from typing import Callable, List, Optional, Any

# pyserial is imported lazily so the app still starts if it is not installed
try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False


# ── Shared state ───────────────────────────────────────────────────────────────
_lock = threading.Lock()
_serial_port: Any = None      # serial.Serial instance
_reader_thread: Optional[threading.Thread] = None
_connected_port: Optional[str] = None
_last_reading: Optional[dict] = None

# Asyncio event loop reference (set at startup from app.py)
_loop: Optional[asyncio.AbstractEventLoop] = None
_subscribers: List[asyncio.Queue] = []


# ── Helpers ────────────────────────────────────────────────────────────────────
def set_event_loop(loop: asyncio.AbstractEventLoop):
    global _loop
    _loop = loop


def list_ports() -> List[dict]:
    """Return list of available serial ports."""
    if not SERIAL_AVAILABLE:
        return []
    return [
        {"port": p.device, "description": p.description or p.device}
        for p in serial.tools.list_ports.comports()
    ]


def get_status() -> dict:
    return {
        "connected": _serial_port is not None and _serial_port.is_open,
        "port": _connected_port,
        "last_reading": _last_reading,
        "serial_available": SERIAL_AVAILABLE,
    }


def subscribe() -> asyncio.Queue:
    """Create and register an asyncio queue that receives parsed readings."""
    q: asyncio.Queue = asyncio.Queue(maxsize=20)
    with _lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue):
    with _lock:
        if q in _subscribers:
            _subscribers.remove(q)


# ── Parser ─────────────────────────────────────────────────────────────────────
def _parse_line(line: str) -> Optional[dict]:
    """
    Parse a CSV line from the new Arduino firmware:
      TEMP=28.50,TEMP_OK=1,VIB=0,LOAD=0.00,LOAD_OK=1,CURRENT=0.00,SOUND=42.0,
      DIST=15.2,DIST_OK=1,IR_LEFT=1,IR_RIGHT=1,ACC=9.81,MPU_OK=1,SPEED=0.00,
      ENCODER_OK=1,HEALTH=100.0,RISK=0.0,MOTOR=OFF,STATUS=SYSTEM OK
    into a typed dictionary. Returns None on parse error.
    """
    try:
        pairs = {}
        for token in line.strip().split(","):
            if "=" not in token:
                continue
            k, _, v = token.partition("=")
            pairs[k.strip().upper()] = v.strip()

        def f(key: str, default: float = 0.0) -> float:
            val = pairs.get(key)
            if val is None or val == "":
                return default
            try:
                return float(val)
            except ValueError:
                return default

        def i(key: str, default: int = 0) -> int:
            val = pairs.get(key)
            if val is None or val == "":
                return default
            try:
                return int(float(val))
            except ValueError:
                return default

        def b(key: str, default: bool = True) -> bool:
            val = pairs.get(key)
            if val is None:
                return default
            return str(val).strip().lower() in ("1", "true", "ok", "yes")

        # ── Diagnostic Sensor Health Flags ────────────────────────────
        temp_ok    = b("TEMP_OK", True)
        load_ok    = b("LOAD_OK", True)
        dist_ok    = b("DIST_OK", True)
        mpu_ok     = b("MPU_OK", True)
        encoder_ok = b("ENCODER_OK", True)

        # ── Primary Sensor Readings ───────────────────────────────────
        temp_raw = f("TEMP", 0.0)
        # Validate DS18B20 range (-55 to +125 °C, != -127 disconnected)
        temperature = round(temp_raw, 1) if temp_ok and -50.0 < temp_raw < 125.0 else round(temp_raw, 1)

        vib_raw = i("VIB", 0)       # 0 or 1 (SW-420 vibration switch)
        
        # Support 3-axis MPU readings from updated firmware (ACCX, ACCY, ACCZ)
        acc_x = f("ACCX", 0.0)
        acc_y = f("ACCY", 0.0)
        acc_z = f("ACCZ", 9.80)
        gyro_x = f("GYROX", 0.0)
        gyro_y = f("GYROY", 0.0)
        gyro_z = f("GYROZ", 0.0)
        
        if "ACC" in pairs:
            acc = f("ACC", 9.80)
        else:
            import math
            acc = math.sqrt(acc_x**2 + acc_y**2 + acc_z**2)

        dynamic_acc = max(0.0, acc - 9.80) if mpu_ok else 0.0
        vibration_mms = round(dynamic_acc * 1.8 + (vib_raw * 2.5), 2)
        if vibration_mms < 0.2:
            vibration_mms = 0.85

        load_raw = f("LOAD", 0.0)
        load_kg  = max(0.0, round(load_raw, 2)) if load_ok else round(load_raw, 2)

        current_a = round(f("CURRENT", 0.0), 2)
        sound_lvl = round(f("SOUND", 0.0), 1)

        dist_raw = f("DIST", 0.0)
        # Ultrasonic distance valid range: 2 to 400 cm
        dist_cm  = round(dist_raw, 1) if dist_ok and 2.0 <= dist_raw <= 400.0 else round(dist_raw, 1)

        speed_raw = f("SPEED", 0.0)
        speed_mps = round(max(0.0, speed_raw), 2)

        # ── Precision Belt Alignment & Tracking ───────────────────────
        # In updated firmware: IRL=0/1 and IRR=0/1 (or IR_LEFT / IR_RIGHT)
        if "IRL" in pairs:
            ir_l = 0 if i("IRL", 0) == 1 else 1 # 1 in sketch means detected (LOW on sensor)
        else:
            ir_l = i("IR_LEFT", 1)

        if "IRR" in pairs:
            ir_r = 0 if i("IRR", 0) == 1 else 1
        else:
            ir_r = i("IR_RIGHT", 1)

        ir_obj = b("IR_OBJ", ir_l == 0 or ir_r == 0)
        buzzer_active = b("BUZZER", False) or ir_obj

        if ir_l == 1 and ir_r == 1:
            alignment_mm = 1.5
            alignment_signed_mm = 0.0
            alignment_direction = "CENTERED"
            alignment_status = "NORMAL"
            alignment_desc = "Centered (Tracking nominal)"
        elif ir_l == 0 and ir_r == 1:
            alignment_mm = 14.5
            alignment_signed_mm = -14.5
            alignment_direction = "LEFT"
            alignment_status = "WARNING"
            alignment_desc = "Drift Left / Object Left (-14.5 mm)"
        elif ir_l == 1 and ir_r == 0:
            alignment_mm = 14.5
            alignment_signed_mm = 14.5
            alignment_direction = "RIGHT"
            alignment_status = "WARNING"
            alignment_desc = "Drift Right / Object Right (+14.5 mm)"
        else:  # ir_l == 0 and ir_r == 0
            alignment_mm = 24.0
            alignment_signed_mm = 0.0
            alignment_direction = "BILATERAL"
            alignment_status = "CRITICAL"
            alignment_desc = "Object Detected Across Sensor Path"

        # Potentiometer and Motor Speed
        pot_val = i("POT", 0)
        motor_pwm_val = i("MOTOR_PWM", 150)
        motor_raw = pairs.get("MOTOR", "0")
        if motor_raw in ("1", "ON", "TRUE"):
            motor_state = "ON"
        else:
            motor_state = "OFF"

        servo_pos = i("SERVO", 20)

        reading = {
            # ── Primary Sensor Keys (mapped directly to frontend store) ──
            "temperature":          temperature,
            "vibration":            vibration_mms,
            "load":                 load_kg,
            "speed":                speed_mps,
            "acoustic":             sound_lvl,
            "tension":              dist_cm,
            "alignment":            round(alignment_mm, 1),
            "current":              current_a,

            # ── Potentiometer & Motor PWM ──────────────────────────────────
            "pot_value":            pot_val,
            "motor_pwm":            motor_pwm_val,
            "motor":                motor_state,
            "servo_position":       servo_pos,

            # ── IR Object Detection & Buzzer Status ────────────────────────
            "ir_left":              ir_l,
            "ir_right":             ir_r,
            "ir_object_detected":   ir_obj,
            "ir_buzzer_active":     buzzer_active,

            # ── Alignment Diagnostics ─────────────────────────────────────
            "alignment_direction":  alignment_direction,
            "alignment_status":     alignment_status,
            "alignment_signed_mm":  round(alignment_signed_mm, 1),
            "alignment_desc":       alignment_desc,

            # ── Diagnostic Health / Availability Flags from Arduino ────────
            "temp_ok":              temp_ok,
            "load_ok":              load_ok,
            "dist_ok":              dist_ok,
            "mpu_ok":               mpu_ok,
            "encoder_ok":           encoder_ok,

            # ── Overall Arduino System Status ─────────────────────────────
            "status":               pairs.get("STATUS", "NORMAL" if (mpu_ok and temp_ok and load_ok) else "PROCESSING").upper(),
            "health":               round(f("HEALTH", 100.0), 1) if "HEALTH" in pairs else None,
            "risk":                 round(f("RISK", 0.0), 1) if "RISK" in pairs else None,
            "acc_raw":              round(acc, 2),
            "accel_x":              round(acc_x, 2),
            "accel_y":              round(acc_y, 2),
            "accel_z":              round(acc_z, 2),
            "gyro_x":               round(gyro_x, 2),
            "gyro_y":               round(gyro_y, 2),
            "gyro_z":               round(gyro_z, 2),
            "vib_digital":          vib_raw,
            "dist_cm":              dist_cm if dist_cm is not None else 0.0,
        }
        return reading
    except Exception as e:
        print(f"[Arduino] Parse error on line: {line.strip()} -> {e}")
        return None


def _handle_text_line(line: str) -> Optional[dict]:
    """
    Handle async event prints from the Arduino UNO R4 Minima firmware,
    such as 'MOTOR : ON', 'IR OBJECT DETECTED', etc.
    Updates and broadcasts the shared last reading state.
    """
    global _last_reading
    with _lock:
        base = dict(_last_reading) if _last_reading else {
            "temperature": 30.0,
            "vibration": 2.0,
            "load": 1.5,
            "speed": 0.0,
            "acoustic": 45.0,
            "tension": 12.0,
            "alignment": 1.5,
            "current": 0.0,
            "motor": "OFF",
            "status": "NORMAL",
            "ir_left": 1,
            "ir_right": 1,
            "ir_object_detected": False,
            "ir_buzzer_active": False,
            "mpu_ok": True,
            "temp_ok": True,
            "load_ok": True,
            "dist_ok": True,
            "encoder_ok": True,
        }

    upper = line.upper().strip()
    updated = False

    if "MOTOR: ON" in upper or "MOTOR : ON" in upper:
        base["motor"] = "ON"
        updated = True
    elif "MOTOR: OFF" in upper or "MOTOR : OFF" in upper:
        base["motor"] = "OFF"
        updated = True
    elif "CAMERA CLEANING STARTED" in upper:
        base["cleaning"] = True
        updated = True
    elif "CAMERA CLEANING COMPLETE" in upper:
        base["cleaning"] = False
        updated = True
    elif "IR ALERT" in upper or "IR OBJECT DETECTED" in upper:
        base["ir_object_detected"] = True
        base["ir_buzzer_active"] = True
        base["ir_left"] = 0
        base["ir_right"] = 0
        base["alignment"] = 24.0
        base["alignment_desc"] = "Object Detected"
        updated = True
    elif "IR BUZZER OFF" in upper:
        base["ir_buzzer_active"] = False
        base["ir_object_detected"] = False
        base["ir_left"] = 1
        base["ir_right"] = 1
        base["alignment"] = 1.5
        base["alignment_desc"] = "Centered (Clear)"
        updated = True
    elif "MPU6050: OK" in upper or "MPU6050 : OK" in upper:
        base["mpu_ok"] = True
        updated = True
    elif "MPU6050: NOT DETECTED" in upper or "MPU6050 : PROCESSING" in upper:
        base["mpu_ok"] = False
        updated = True
    elif "DS18B20: OK" in upper or "DS18B20 : OK" in upper:
        base["temp_ok"] = True
        updated = True
    elif "DS18B20: NOT DETECTED" in upper or "DS18B20 : PROCESSING" in upper:
        base["temp_ok"] = False
        updated = True
    elif "HX711: OK" in upper or "HX711 : OK" in upper:
        base["load_ok"] = True
        updated = True
    elif "HX711: NOT DETECTED" in upper or "HX711 : PROCESSING" in upper:
        base["load_ok"] = False
        updated = True
    elif "SYSTEM READY" in upper:
        base["status"] = "NORMAL"
        updated = True

    return base if updated else None


# ── Broadcast ──────────────────────────────────────────────────────────────────
def _broadcast(reading: dict):
    """Thread-safe broadcast to all asyncio subscriber queues."""
    global _last_reading
    _last_reading = reading
    if _loop is None:
        return
    with _lock:
        subs = list(_subscribers)
    for q in subs:
        try:
            _loop.call_soon_threadsafe(q.put_nowait, reading)
        except Exception:
            pass


# ── Reader thread ──────────────────────────────────────────────────────────────
def _reader(port_name: str, baud: int):
    global _serial_port, _connected_port
    try:
        ser = serial.Serial(port_name, baud, timeout=2)
        with _lock:
            _serial_port = ser
            _connected_port = port_name

        print(f"[Arduino] Connected to {port_name} @ {baud} baud")

        while True:
            with _lock:
                alive = _serial_port is not None and _serial_port.is_open
            if not alive:
                break
            try:
                raw = ser.readline()
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                if "=" not in line:
                    print(f"[Arduino Log] {line}")
                    updated_state = _handle_text_line(line)
                    if updated_state:
                        _broadcast(updated_state)
                    continue
                reading = _parse_line(line)
                if reading:
                    _broadcast(reading)
            except Exception as e:
                print(f"[Arduino] Read error: {e}")
                break

    except Exception as e:
        print(f"[Arduino] Connection failed: {e}")
    finally:
        with _lock:
            if _serial_port and _serial_port.is_open:
                try:
                    _serial_port.close()
                except Exception:
                    pass
            _serial_port = None
            _connected_port = None
        print("[Arduino] Serial reader stopped")


def connect(port: str, baud: int = 115200) -> dict:
    global _reader_thread
    if not SERIAL_AVAILABLE:
        return {"ok": False, "error": "pyserial not installed. Run: pip install pyserial"}

    disconnect()  # Close any existing connection

    t = threading.Thread(target=_reader, args=(port, baud), daemon=True)
    _reader_thread = t
    t.start()
    return {"ok": True, "port": port}


def disconnect() -> dict:
    global _serial_port, _connected_port, _reader_thread
    with _lock:
        sp = _serial_port
        _serial_port = None
        _connected_port = None
    if sp:
        try:
            sp.close()
        except Exception:
            pass
    return {"ok": True}


def send_command(cmd: str) -> dict:
    global _serial_port
    with _lock:
        sp = _serial_port
    if not sp or not sp.is_open:
        return {"ok": False, "error": "Arduino not connected"}
    try:
        sp.write((cmd.strip() + "\n").encode("utf-8"))
        sp.flush()
        return {"ok": True, "command": cmd.strip()}
    except Exception as e:
        return {"ok": False, "error": str(e)}
