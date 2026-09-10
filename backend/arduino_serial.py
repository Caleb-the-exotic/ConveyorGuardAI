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
from typing import Callable, List, Optional

# pyserial is imported lazily so the app still starts if it is not installed
try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False


# ── Shared state ───────────────────────────────────────────────────────────────
_lock = threading.Lock()
_serial_port: Optional[object] = None      # serial.Serial instance
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
    Parse a CSV line like  TEMP=32.00,VIB=0,...,STATUS=SYSTEM OK
    into a typed dict.  Returns None on any parse error.
    """
    try:
        pairs = {}
        # STATUS can contain spaces and commas — split on first =, greedy right
        for token in line.strip().split(","):
            if "=" not in token:
                continue
            k, _, v = token.partition("=")
            pairs[k.strip()] = v.strip()

        def f(key, default=0.0):
            return float(pairs.get(key, default))

        def i(key, default=0):
            return int(float(pairs.get(key, default)))

        vib_raw = i("VIB")        # 0 or 1 (digital vibration sensor)
        acc     = f("ACC", 9.8)   # MPU6050 total acceleration m/s²
        ir_l    = i("IR_LEFT", 1)
        ir_r    = i("IR_RIGHT", 1)

        # Derive alignment offset in mm (0 = aligned, >0 = misaligned)
        # IR_LEFT=LOW(0) or IR_RIGHT=LOW(0) means object detected → misaligned
        alignment_mm = 0.0
        if ir_l == 0 and ir_r == 0:
            alignment_mm = 18.0   # both triggered → severely off-centre
        elif ir_l == 0 or ir_r == 0:
            alignment_mm = 8.5    # one side triggered → moderate misalignment

        # Vibration: combine digital sensor flag with MPU6050 magnitude
        # Subtract gravity baseline (≈9.8 m/s²) to get dynamic acceleration
        dynamic_acc = max(0.0, acc - 9.8)
        # Convert to mm/s² and scale roughly to mm/s RMS (heuristic)
        vibration_mms = round(dynamic_acc * 1.8 + vib_raw * 2.0, 2)

        reading = {
            # ── Mapped sensor keys ──────────────────────────
            "temperature":  round(f("TEMP"), 1),   # °C
            "vibration":    vibration_mms,          # mm/s (derived)
            "load":         round(f("LOAD"), 2),   # kg raw from HX711
            "speed":        round(f("SPEED"), 2),  # m/s
            "acoustic":     round(f("SOUND"), 1),  # 0-100 scaled dB proxy
            "tension":      round(f("DIST"), 1),   # cm ultrasonic → belt sag proxy
            "alignment":    round(alignment_mm, 1),# mm offset

            # ── Extra fields for ConveyorHealth stats ───────
            "health":       round(f("HEALTH"), 1),
            "risk":         round(f("RISK"), 1),
            "current":      round(f("CURRENT"), 2),
            "motor":        pairs.get("MOTOR", "OFF"),
            "status":       pairs.get("STATUS", "UNKNOWN"),
            "ir_left":      ir_l,
            "ir_right":     ir_r,
            "acc_raw":      round(acc, 2),
            "vib_digital":  vib_raw,
        }
        return reading
    except Exception:
        return None


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
                if not line or "=" not in line:
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
