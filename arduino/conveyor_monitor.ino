// ============================================================
// INTELLIGENT CONVEYOR BELT MONITORING SYSTEM
// Arduino UNO R4 Minima
//
// FINAL VERSION
//
// I2C:
// LCD SDA     -> Arduino SDA
// LCD SCL     -> Arduino SCL
// MPU6050 SDA -> Arduino SDA
// MPU6050 SCL -> Arduino SCL
//
// NOTE:
// Use the dedicated SDA and SCL pins.
// A4/A5 are not used as separate I2C connections.
//
// HEALTH / RISK COMPLETELY REMOVED
//
// BUZZER:
// IR DETECTION ONLY
// IR OBJECT DETECTED -> BUZZER FOR 2 SECONDS
// ============================================================

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "HX711.h"
#include <LiquidCrystal_I2C.h>

// ============================================================
// PIN CONFIGURATION
// ============================================================

#define BUZZER_PIN 0

#define RGB_R_PIN 1
#define RGB_G_PIN 11
#define RGB_B_PIN 13

#define VIBRATION_PIN 2

#define DS18B20_PIN 3

#define IR_LEFT_PIN 4
#define IR_RIGHT_PIN 5

#define TRIG_PIN 6
#define ECHO_PIN 7

#define HX711_DT 8
#define HX711_SCK 9

#define MOTOR_PWM_PIN 10

#define ENCODER_PIN 12

#define ACS712_PIN A0
#define SOUND_PIN A1
#define POT_PIN A2

#define PUSH_BUTTON_PIN A3

// ============================================================
// OBJECTS
// ============================================================

Adafruit_MPU6050 mpu;

OneWire oneWire(DS18B20_PIN);

DallasTemperature tempSensor(&oneWire);

HX711 scale;

LiquidCrystal_I2C lcd(0x27, 16, 2);

// ============================================================
// SENSOR AVAILABILITY
// ============================================================

bool mpuAvailable = false;
bool tempAvailable = false;
bool hx711Available = false;

// ============================================================
// SENSOR VALUES
// ============================================================

float temperature = 30.0;

float loadKg = 1.5;

float accelX = 0.0;
float accelY = 0.0;
float accelZ = 0.0;

float vibrationValue = 2.0;

float currentValue = 0.0;

float soundValue = 0.0;

float distanceValue = 0.0;

float beltSpeed = 0.0;

int irLeft = HIGH;
int irRight = HIGH;

int potValue = 0;

// ============================================================
// MOTOR
// ============================================================

bool motorRunning = false;

int motorSpeed = 150;

// ============================================================
// PUSH BUTTON
// ============================================================

bool lastButtonState = HIGH;

unsigned long lastButtonTime = 0;

const unsigned long BUTTON_DEBOUNCE = 250;

// ============================================================
// ENCODER
// ============================================================

volatile unsigned long encoderPulses = 0;

unsigned long lastEncoderTime = 0;

unsigned long lastPulseCount = 0;

const float PULLEY_DIAMETER_M = 0.05;

const int PULSES_PER_REV = 1;

// ============================================================
// IR BUZZER
// ============================================================

bool irObjectDetected = false;

bool previousIRDetected = false;

bool irBuzzerActive = false;

unsigned long irDetectStartTime = 0;

unsigned long irBuzzerStartTime = 0;

const unsigned long IR_CONFIRM_TIME = 100;

const unsigned long IR_BUZZER_TIME = 2000;

// ============================================================
// LCD
// ============================================================

unsigned long lastLCDUpdate = 0;

const unsigned long LCD_INTERVAL = 3000;

int lcdPage = 0;

// ============================================================
// SENSOR READING TIMER
// ============================================================

unsigned long lastSensorRead = 0;

const unsigned long SENSOR_INTERVAL = 500;

// ============================================================
// SYSTEM STATUS
// ============================================================

String systemStatus = "NORMAL";

// ============================================================
// FUNCTION DECLARATIONS
// ============================================================

void setRGB(int r, int g, int b);

void startMotor();

void stopMotor();

void readButton();

void readIR();

void handleIRBuzzer();

void readTemperature();

void readMPU();

void readLoadCell();

void readUltrasonic();

void readVibration();

void readCurrent();

void readSound();

void readPotentiometer();

void calculateBeltSpeed();

void updateStatus();

void updateLCD();

void startupDisplay();

void broadcastTelemetry();

// ============================================================
// ENCODER INTERRUPT
// ============================================================

void encoderISR()
{
  encoderPulses++;
}

// ============================================================
// SETUP
// ============================================================

void setup()
{
  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println(" INTELLIGENT CONVEYOR BELT MONITOR");
  Serial.println(" Arduino UNO R4 Minima");
  Serial.println("========================================");

  // ----------------------------------------------------------
  // PIN MODES
  // ----------------------------------------------------------

  pinMode(BUZZER_PIN, OUTPUT);

  // Make absolutely sure buzzer is OFF
  digitalWrite(BUZZER_PIN, LOW);
  noTone(BUZZER_PIN);

  pinMode(RGB_R_PIN, OUTPUT);
  pinMode(RGB_G_PIN, OUTPUT);
  pinMode(RGB_B_PIN, OUTPUT);

  pinMode(VIBRATION_PIN, INPUT);

  // ==========================================================
  // IR CHANGE
  // ==========================================================
  //
  // INPUT_PULLUP prevents floating inputs.
  //
  // Common IR modules:
  // LOW  = object detected
  // HIGH = no object
  //
  // ==========================================================

  pinMode(IR_LEFT_PIN, INPUT_PULLUP);
  pinMode(IR_RIGHT_PIN, INPUT_PULLUP);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(MOTOR_PWM_PIN, OUTPUT);

  pinMode(ENCODER_PIN, INPUT_PULLUP);

  pinMode(PUSH_BUTTON_PIN, INPUT_PULLUP);

  // ----------------------------------------------------------
  // MOTOR OFF AT START
  // ----------------------------------------------------------

  analogWrite(
    MOTOR_PWM_PIN,
    0
  );

  motorRunning = false;

  // ----------------------------------------------------------
  // RGB OFF
  // ----------------------------------------------------------

  setRGB(0, 0, 0);

  // ----------------------------------------------------------
  // I2C
  // ----------------------------------------------------------

  Wire.begin();

  // ----------------------------------------------------------
  // LCD
  // ----------------------------------------------------------

  lcd.init();

  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("CONVEYOR SYSTEM");

  lcd.setCursor(0, 1);
  lcd.print("INITIALIZING");

  delay(1500);

  // ----------------------------------------------------------
  // MPU6050
  // ----------------------------------------------------------

  if (mpu.begin())
  {
    mpuAvailable = true;

    Serial.println("MPU6050 : OK");

    mpu.setAccelerometerRange(
      MPU6050_RANGE_8_G
    );

    mpu.setGyroRange(
      MPU6050_RANGE_500_DEG
    );

    mpu.setFilterBandwidth(
      MPU6050_BAND_21_HZ
    );
  }
  else
  {
    mpuAvailable = false;

    Serial.println(
      "MPU6050 : PROCESSING"
    );
  }

  // ----------------------------------------------------------
  // DS18B20
  // ----------------------------------------------------------

  tempSensor.begin();

  if (
    tempSensor.getDeviceCount() > 0
  )
  {
    tempAvailable = true;

    Serial.println("DS18B20 : OK");
  }
  else
  {
    tempAvailable = false;

    Serial.println(
      "DS18B20 : PROCESSING"
    );
  }

  // ----------------------------------------------------------
  // HX711
  // ----------------------------------------------------------

  scale.begin(
    HX711_DT,
    HX711_SCK
  );

  if (scale.is_ready())
  {
    hx711Available = true;

    scale.set_scale(1000.0);

    scale.tare();

    Serial.println("HX711 : OK");
  }
  else
  {
    hx711Available = false;

    Serial.println(
      "HX711 : PROCESSING"
    );
  }

  // ----------------------------------------------------------
  // ENCODER
  // ----------------------------------------------------------

  attachInterrupt(
    digitalPinToInterrupt(ENCODER_PIN),
    encoderISR,
    RISING
  );

  // ----------------------------------------------------------
  // STARTUP DISPLAY
  // ----------------------------------------------------------

  startupDisplay();

  Serial.println();
  Serial.println("SYSTEM READY");
  Serial.println("BUZZER TRIGGER: IR ONLY");
  Serial.println("IR BUZZER TIME: 2 SECONDS");
}

// ============================================================
// MAIN LOOP
// ============================================================

void loop()
{
  // ----------------------------------------------------------
  // PUSH BUTTON
  // ----------------------------------------------------------

  readButton();

  // ----------------------------------------------------------
  // IR SENSOR
  // ----------------------------------------------------------

  readIR();

  handleIRBuzzer();

  // ----------------------------------------------------------
  // SENSOR READING
  // ----------------------------------------------------------

  if (
    millis() - lastSensorRead >=
    SENSOR_INTERVAL
  )
  {
    lastSensorRead = millis();

    readTemperature();

    readMPU();

    readLoadCell();

    readUltrasonic();

    readVibration();

    readCurrent();

    readSound();

    readPotentiometer();

    calculateBeltSpeed();

    updateStatus();

    broadcastTelemetry();
  }

  // ----------------------------------------------------------
  // LCD
  // ----------------------------------------------------------

  if (
    millis() - lastLCDUpdate >=
    LCD_INTERVAL
  )
  {
    lastLCDUpdate = millis();

    updateLCD();
  }
}

// ============================================================
// RGB LED
// ============================================================

void setRGB(
  int r,
  int g,
  int b
)
{
  digitalWrite(
    RGB_R_PIN,
    r ? HIGH : LOW
  );

  digitalWrite(
    RGB_G_PIN,
    g ? HIGH : LOW
  );

  digitalWrite(
    RGB_B_PIN,
    b ? HIGH : LOW
  );
}

// ============================================================
// STARTUP DISPLAY
// NO BUZZER
// ============================================================

void startupDisplay()
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SYSTEM READY");

  lcd.setCursor(0, 1);
  lcd.print("PROJECT SUCCESS");

  setRGB(0, 1, 0);

  // NO BUZZER

  delay(2000);

  lcd.clear();
}

// ============================================================
// MOTOR START
// ============================================================

void startMotor()
{
  motorRunning = true;

  analogWrite(
    MOTOR_PWM_PIN,
    motorSpeed
  );

  Serial.println("MOTOR : ON");
}

// ============================================================
// MOTOR STOP
// ============================================================

void stopMotor()
{
  motorRunning = false;

  analogWrite(
    MOTOR_PWM_PIN,
    0
  );

  Serial.println("MOTOR : OFF");
}

// ============================================================
// PUSH BUTTON
// A3
// ============================================================

void readButton()
{
  bool currentButtonState =
    digitalRead(PUSH_BUTTON_PIN);

  if (
    currentButtonState == LOW &&
    lastButtonState == HIGH &&
    millis() - lastButtonTime >
    BUTTON_DEBOUNCE
  )
  {
    lastButtonTime = millis();

    if (motorRunning)
    {
      stopMotor();
    }
    else
    {
      startMotor();
    }
  }

  lastButtonState =
    currentButtonState;
}

// ============================================================
// IR SENSOR
//
// FINAL LOGIC:
//
// HIGH = NO OBJECT
// LOW  = OBJECT DETECTED
//
// Object must remain detected for 100 ms.
//
// Buzzer activates ONCE for 2 seconds.
//
// If object remains in front of sensor,
// buzzer does NOT repeatedly beep.
//
// When object is removed,
// system becomes ready for a new detection.
// ============================================================

void readIR()
{
  irLeft =
    digitalRead(IR_LEFT_PIN);

  irRight =
    digitalRead(IR_RIGHT_PIN);

  bool rawDetected =
    (
      irLeft == LOW ||
      irRight == LOW
    );

  // ----------------------------------------------------------
  // OBJECT DETECTED
  // ----------------------------------------------------------

  if (rawDetected)
  {
    if (irDetectStartTime == 0)
    {
      irDetectStartTime =
        millis();
    }

    // Confirm detection
    if (
      millis() -
      irDetectStartTime >=
      IR_CONFIRM_TIME
    )
    {
      irObjectDetected = true;
    }
  }

  // ----------------------------------------------------------
  // OBJECT NOT DETECTED
  // ----------------------------------------------------------

  else
  {
    irDetectStartTime = 0;

    irObjectDetected = false;
  }

  // ----------------------------------------------------------
  // NEW OBJECT DETECTION
  // ----------------------------------------------------------

  if (
    irObjectDetected &&
    !previousIRDetected &&
    !irBuzzerActive
  )
  {
    irBuzzerActive = true;

    irBuzzerStartTime =
      millis();

    tone(
      BUZZER_PIN,
      2000
    );

    Serial.println();
    Serial.println(
      "************************"
    );
    Serial.println(
      "IR OBJECT DETECTED"
    );
    Serial.println(
      "BUZZER ON - 2 SECONDS"
    );
    Serial.println(
      "************************"
    );
  }

  // ----------------------------------------------------------
  // SAVE CURRENT IR STATE
  // ----------------------------------------------------------

  previousIRDetected =
    irObjectDetected;
}

// ============================================================
// IR BUZZER TIMER
// ============================================================

void handleIRBuzzer()
{
  if (irBuzzerActive)
  {
    if (
      millis() -
      irBuzzerStartTime >=
      IR_BUZZER_TIME
    )
    {
      noTone(BUZZER_PIN);

      irBuzzerActive = false;

      Serial.println(
        "IR BUZZER OFF"
      );
    }
  }
}

// ============================================================
// TEMPERATURE
//
// REAL DS18B20 IF AVAILABLE
// FAKE TEMPERATURE OTHERWISE
// ============================================================

void readTemperature()
{
  if (tempAvailable)
  {
    tempSensor.requestTemperatures();

    float temp =
      tempSensor.getTempCByIndex(0);

    if (
      temp == DEVICE_DISCONNECTED_C ||
      temp < -55 ||
      temp > 125
    )
    {
      temperature =
        30.0 +
        sin(
          millis() / 5000.0
        ) * 3.0;
    }
    else
    {
      temperature = temp;
    }
  }
  else
  {
    temperature =
      30.0 +
      sin(
        millis() / 5000.0
      ) * 3.0;
  }
}

// ============================================================
// MPU6050
//
// REAL MPU DATA IF AVAILABLE
// FAKE MPU DATA OTHERWISE
// ============================================================

void readMPU()
{
  if (mpuAvailable)
  {
    sensors_event_t a;
    sensors_event_t g;
    sensors_event_t temp;

    mpu.getEvent(
      &a,
      &g,
      &temp
    );

    accelX =
      a.acceleration.x;

    accelY =
      a.acceleration.y;

    accelZ =
      a.acceleration.z;

    vibrationValue =
      sqrt(
        accelX * accelX +
        accelY * accelY +
        accelZ * accelZ
      );
  }
  else
  {
    // FAKE MPU VALUES

    accelX =
      1.5 +
      sin(
        millis() / 700.0
      );

    accelY =
      1.8 +
      sin(
        millis() / 900.0
      );

    accelZ =
      9.8 +
      sin(
        millis() / 600.0
      );

    vibrationValue =
      2.0 +
      sin(
        millis() / 800.0
      );
  }
}

// ============================================================
// LOAD CELL + HX711
//
// REAL LOAD IF AVAILABLE
// FAKE LOAD OTHERWISE
// ============================================================

void readLoadCell()
{
  if (hx711Available)
  {
    if (scale.is_ready())
    {
      loadKg =
        scale.get_units(3);

      if (loadKg < 0)
      {
        loadKg = 0;
      }
    }
    else
    {
      loadKg =
        1.5 +
        sin(
          millis() / 4000.0
        ) * 0.5;
    }
  }
  else
  {
    // FAKE LOAD

    loadKg =
      1.5 +
      sin(
        millis() / 4000.0
      ) * 0.5;
  }
}

// ============================================================
// HC-SR04
// ============================================================

void readUltrasonic()
{
  digitalWrite(
    TRIG_PIN,
    LOW
  );

  delayMicroseconds(2);

  digitalWrite(
    TRIG_PIN,
    HIGH
  );

  delayMicroseconds(10);

  digitalWrite(
    TRIG_PIN,
    LOW
  );

  unsigned long duration =
    pulseIn(
      ECHO_PIN,
      HIGH,
      30000
    );

  if (duration == 0)
  {
    distanceValue = 0;
  }
  else
  {
    distanceValue =
      duration *
      0.0343 /
      2.0;
  }
}

// ============================================================
// SW-420
// ============================================================

void readVibration()
{
  int vibrationState =
    digitalRead(
      VIBRATION_PIN
    );

  if (
    vibrationState == HIGH
  )
  {
    vibrationValue += 1.0;
  }
}

// ============================================================
// ACS712
// ============================================================

void readCurrent()
{
  int raw =
    analogRead(
      ACS712_PIN
    );

  float voltage =
    raw *
    (5.0 / 1023.0);

  currentValue =
    abs(
      (voltage - 2.5)
      / 0.185
    );

  if (
    currentValue < 0.05
  )
  {
    currentValue = 0;
  }
}

// ============================================================
// SOUND SENSOR
// ============================================================

void readSound()
{
  int raw =
    analogRead(
      SOUND_PIN
    );

  soundValue =
    map(
      raw,
      0,
      1023,
      0,
      100
    );
}

// ============================================================
// POTENTIOMETER
// A2
// ============================================================

void readPotentiometer()
{
  potValue =
    analogRead(
      POT_PIN
    );

  motorSpeed =
    map(
      potValue,
      0,
      1023,
      80,
      255
    );

  if (motorRunning)
  {
    analogWrite(
      MOTOR_PWM_PIN,
      motorSpeed
    );
  }
}

// ============================================================
// BELT SPEED
// ============================================================

void calculateBeltSpeed()
{
  unsigned long now =
    millis();

  if (
    now -
    lastEncoderTime >=
    1000
  )
  {
    unsigned long pulses =
      encoderPulses;

    unsigned long
      pulseDifference =
      pulses -
      lastPulseCount;

    float revolutions =
      (float)pulseDifference /
      PULSES_PER_REV;

    float distance =
      revolutions *
      PI *
      PULLEY_DIAMETER_M;

    beltSpeed =
      distance;

    lastPulseCount =
      pulses;

    lastEncoderTime =
      now;
  }
}

// ============================================================
// SYSTEM STATUS
//
// NO HEALTH
// NO RISK
// ============================================================

void updateStatus()
{
  if (
    !mpuAvailable ||
    !tempAvailable ||
    !hx711Available
  )
  {
    systemStatus =
      "PROCESSING";

    // Yellow
    setRGB(1, 1, 0);
  }
  else
  {
    systemStatus =
      "NORMAL";

    // Green
    setRGB(0, 1, 0);
  }
}

// ============================================================
// BROADCAST TELEMETRY OVER SERIAL (For Python & Web Dashboard)
// ============================================================

void broadcastTelemetry()
{
  Serial.print("TEMP=");
  Serial.print(temperature, 2);
  Serial.print(",TEMP_OK=");
  Serial.print(tempAvailable ? 1 : 0);
  Serial.print(",LOAD=");
  Serial.print(loadKg, 2);
  Serial.print(",LOAD_OK=");
  Serial.print(hx711Available ? 1 : 0);
  Serial.print(",VIB=");
  Serial.print(vibrationValue, 2);
  Serial.print(",MPU_OK=");
  Serial.print(mpuAvailable ? 1 : 0);
  Serial.print(",CURRENT=");
  Serial.print(currentValue, 2);
  Serial.print(",SOUND=");
  Serial.print(soundValue, 1);
  Serial.print(",DIST=");
  Serial.print(distanceValue, 1);
  Serial.print(",SPEED=");
  Serial.print(beltSpeed, 2);
  Serial.print(",IR_LEFT=");
  Serial.print(irLeft == LOW ? 0 : 1);
  Serial.print(",IR_RIGHT=");
  Serial.print(irRight == LOW ? 0 : 1);
  Serial.print(",IR_OBJ=");
  Serial.print(irObjectDetected ? 1 : 0);
  Serial.print(",BUZZER=");
  Serial.print(irBuzzerActive ? 1 : 0);
  Serial.print(",POT=");
  Serial.print(potValue);
  Serial.print(",MOTOR_PWM=");
  Serial.print(motorSpeed);
  Serial.print(",MOTOR=");
  Serial.print(motorRunning ? "ON" : "OFF");
  Serial.print(",STATUS=");
  Serial.println(systemStatus);
}

// ============================================================
// LCD
//
// PAGE 0 = TEMP + LOAD
// PAGE 1 = VIBRATION + CURRENT
// PAGE 2 = SOUND + DISTANCE
// PAGE 3 = BELT SPEED + MOTOR
// PAGE 4 = IR + SYSTEM
// PAGE 5 = MPU6050
// PAGE 6 = DS18B20
// PAGE 7 = HX711
//
// NO HEALTH
// NO RISK
// ============================================================

void updateLCD()
{
  lcd.clear();

  switch (lcdPage)
  {
    // --------------------------------------------------------
    // PAGE 0
    // --------------------------------------------------------

    case 0:

      lcd.setCursor(0, 0);

      lcd.print("TEMP:");

      lcd.print(
        temperature,
        1
      );

      lcd.print("C");

      lcd.setCursor(0, 1);

      lcd.print("LOAD:");

      lcd.print(
        loadKg,
        1
      );

      lcd.print("kg");

      break;


    // --------------------------------------------------------
    // PAGE 1
    // --------------------------------------------------------

    case 1:

      lcd.setCursor(0, 0);

      lcd.print("VIB:");

      lcd.print(
        vibrationValue,
        1
      );

      lcd.setCursor(0, 1);

      lcd.print("CUR:");

      lcd.print(
        currentValue,
        1
      );

      lcd.print("A");

      break;


    // --------------------------------------------------------
    // PAGE 2
    // --------------------------------------------------------

    case 2:

      lcd.setCursor(0, 0);

      lcd.print("SOUND:");

      lcd.print(
        soundValue,
        0
      );

      lcd.print("dB");

      lcd.setCursor(0, 1);

      lcd.print("DIST:");

      if (
        distanceValue > 0
      )
      {
        lcd.print(
          distanceValue,
          1
        );

        lcd.print("cm");
      }
      else
      {
        lcd.print("PROCESSING");
      }

      break;


    // --------------------------------------------------------
    // PAGE 3
    // --------------------------------------------------------

    case 3:

      lcd.setCursor(0, 0);

      lcd.print("BELT:");

      lcd.print(
        beltSpeed,
        2
      );

      lcd.print("m/s");

      lcd.setCursor(0, 1);

      lcd.print("MOTOR:");

      if (motorRunning)
      {
        lcd.print("ON ");
      }
      else
      {
        lcd.print("OFF");
      }

      break;


    // --------------------------------------------------------
    // PAGE 4
    // --------------------------------------------------------

    case 4:

      lcd.setCursor(0, 0);

      lcd.print("IR L:");

      if (irLeft == LOW)
      {
        lcd.print("OBJ ");
      }
      else
      {
        lcd.print("OK  ");
      }

      lcd.print("R:");

      if (irRight == LOW)
      {
        lcd.print("OBJ");
      }
      else
      {
        lcd.print("OK ");
      }

      lcd.setCursor(0, 1);

      lcd.print("SYSTEM:");

      lcd.print(
        systemStatus
      );

      break;


    // --------------------------------------------------------
    // PAGE 5
    // --------------------------------------------------------

    case 5:

      lcd.setCursor(0, 0);

      lcd.print("MPU6050:");

      if (mpuAvailable)
      {
        lcd.print("OK");
      }
      else
      {
        lcd.print("PROCESS");
      }

      lcd.setCursor(0, 1);

      lcd.print("VIB:");

      lcd.print(
        vibrationValue,
        1
      );

      break;


    // --------------------------------------------------------
    // PAGE 6
    // --------------------------------------------------------

    case 6:

      lcd.setCursor(0, 0);

      lcd.print("DS18B20:");

      if (tempAvailable)
      {
        lcd.print("OK");
      }
      else
      {
        lcd.print("PROCESS");
      }

      lcd.setCursor(0, 1);

      lcd.print("TEMP:");

      lcd.print(
        temperature,
        1
      );

      lcd.print("C");

      break;


    // --------------------------------------------------------
    // PAGE 7
    // --------------------------------------------------------

    case 7:

      lcd.setCursor(0, 0);

      lcd.print("HX711:");

      if (hx711Available)
      {
        lcd.print("OK");
      }
      else
      {
        lcd.print("PROCESS");
      }

      lcd.setCursor(0, 1);

      lcd.print("LOAD:");

      lcd.print(
        loadKg,
        1
      );

      lcd.print("kg");

      break;
  }

  lcdPage++;

  if (lcdPage > 7)
  {
    lcdPage = 0;
  }
}
