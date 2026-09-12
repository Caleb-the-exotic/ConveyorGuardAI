/*
==============================================================
 INTELLIGENT CONVEYOR BELT MONITORING SYSTEM
 Arduino UNO R4 Minima

 FINAL VERSION + SG90 CAMERA CLEANING SERVO
==============================================================

 SG90:
   Signal -> D13
   VCC    -> 5V
   GND    -> GND

 RGB:
   RED   -> D1
   GREEN -> D11
   BLUE  -> DISCONNECTED

 POTENTIOMETER:
   Signal -> A2

 I2C:
   SDA -> Arduino SDA
   SCL -> Arduino SCL

 SERVO:
   20° -> 160° -> 20°
   Cleaning cycle = 5 seconds
   Automatic interval = 10 seconds

 BUZZER:
   IR detection only
   Buzzer ON for 2 seconds

==============================================================
*/


// ============================================================
// LIBRARIES
// ============================================================

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "HX711.h"
#include <LiquidCrystal_I2C.h>
#include <Servo.h>


// ============================================================
// PIN DEFINITIONS
// ============================================================

#define BUZZER_PIN       0
#define RGB_R_PIN        1
#define VIBRATION_PIN    2
#define DS18B20_PIN      3

#define IR_LEFT_PIN      4
#define IR_RIGHT_PIN     5

#define TRIG_PIN         6
#define ECHO_PIN         7

#define HX711_DT         8
#define HX711_SCK        9

#define MOTOR_PIN        10

#define RGB_G_PIN        11

#define ENCODER_PIN      12

// SG90 SERVO
#define SERVO_PIN        13

#define ACS712_PIN       A0
#define SOUND_PIN        A1
#define POT_PIN          A2
#define BUTTON_PIN       A3


// ============================================================
// OBJECTS
// ============================================================

Adafruit_MPU6050 mpu;

OneWire oneWire(DS18B20_PIN);

DallasTemperature temperatureSensor(&oneWire);

HX711 scale;

LiquidCrystal_I2C lcd(0x27, 16, 2);

Servo cameraServo;


// ============================================================
// SENSOR STATUS
// ============================================================

bool mpuAvailable = false;
bool temperatureAvailable = false;
bool loadCellAvailable = false;


// ============================================================
// SENSOR VALUES
// ============================================================

float temperatureC = 0.0;

float accelX = 0.0;
float accelY = 0.0;
float accelZ = 0.0;

float gyroX = 0.0;
float gyroY = 0.0;
float gyroZ = 0.0;

float loadKg = 0.0;

float distanceCm = 0.0;

float currentA = 0.0;

int vibrationValue = 0;

int soundValue = 0;

int potValue = 0;

float beltSpeed = 0.0;


// ============================================================
// MOTOR
// ============================================================

bool motorRunning = false;

int motorSpeed = 150;


// ============================================================
// ENCODER
// ============================================================

volatile unsigned long encoderPulses = 0;

unsigned long lastEncoderTime = 0;


// ============================================================
// IR SENSOR
// ============================================================

bool irLeftDetected = false;

bool irRightDetected = false;

bool previousIRState = false;

unsigned long irDetectionStart = 0;

bool irStable = false;


// ============================================================
// BUZZER
// ============================================================

bool buzzerActive = false;

unsigned long buzzerStartTime = 0;

const unsigned long BUZZER_DURATION = 2000;


// ============================================================
// LCD
// ============================================================

unsigned long lastLCDUpdate = 0;

const unsigned long LCD_INTERVAL = 3000;

int lcdPage = 0;


// ============================================================
// SENSOR TIMING
// ============================================================

unsigned long lastSensorUpdate = 0;

const unsigned long SENSOR_INTERVAL = 500;


// ============================================================
// SG90 SERVO CLEANING
// ============================================================

// ------------------------------------------------------------
// Servo positions
// ------------------------------------------------------------

const int SERVO_HOME = 20;

const int SERVO_MIN = 20;

const int SERVO_MAX = 160;


// ------------------------------------------------------------
// Cleaning timing
// ------------------------------------------------------------

// Start cleaning every 10 seconds
const unsigned long CLEAN_INTERVAL = 10000;

// Cleaning lasts 5 seconds
const unsigned long CLEAN_DURATION = 5000;


// ------------------------------------------------------------
// Servo movement timing
// ------------------------------------------------------------

const unsigned long SERVO_STEP_INTERVAL = 80;


// ------------------------------------------------------------
// Servo variables
// ------------------------------------------------------------

bool cleaningInProgress = false;

unsigned long lastCleanTime = 0;

unsigned long cleaningStartTime = 0;

unsigned long lastServoStep = 0;

int servoPosition = SERVO_HOME;

int servoDirection = 1;


// ============================================================
// BUTTON
// ============================================================

bool lastButtonState = HIGH;

unsigned long lastButtonTime = 0;

const unsigned long BUTTON_DEBOUNCE = 250;


// ============================================================
// FUNCTION DECLARATIONS
// ============================================================

void readSensors();

void readMPU6050();

void readTemperature();

void readLoadCell();

void readUltrasonic();

void readIR();

void readCurrent();

void readVibration();

void readSound();

void readPotentiometer();

void calculateBeltSpeed();

void updateLCD();

void updateRGB();

void handleIRBuzzer();

void readButton();

void sendSensorData();

void checkLaptopCommand();

void startCleaning();

void automaticCleaning();

void updateCleaningServo();

void motorOn();

void motorOff();

void showStartup();


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
  // ----------------------------------------------------------
  // SERIAL
  // ----------------------------------------------------------

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("==============================================");
  Serial.println(" INTELLIGENT CONVEYOR BELT MONITORING SYSTEM");
  Serial.println(" Arduino UNO R4 Minima");
  Serial.println("==============================================");


  // ----------------------------------------------------------
  // PIN MODES
  // ----------------------------------------------------------

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(RGB_R_PIN, OUTPUT);

  pinMode(RGB_G_PIN, OUTPUT);

  pinMode(VIBRATION_PIN, INPUT);

  pinMode(IR_LEFT_PIN, INPUT_PULLUP);

  pinMode(IR_RIGHT_PIN, INPUT_PULLUP);

  pinMode(TRIG_PIN, OUTPUT);

  pinMode(ECHO_PIN, INPUT);

  pinMode(MOTOR_PIN, OUTPUT);

  pinMode(ENCODER_PIN, INPUT_PULLUP);

  pinMode(ACS712_PIN, INPUT);

  pinMode(SOUND_PIN, INPUT);

  pinMode(POT_PIN, INPUT);

  pinMode(BUTTON_PIN, INPUT_PULLUP);


  // ----------------------------------------------------------
  // INITIAL OUTPUTS
  // ----------------------------------------------------------

  digitalWrite(BUZZER_PIN, LOW);

  digitalWrite(RGB_R_PIN, LOW);

  digitalWrite(RGB_G_PIN, LOW);

  analogWrite(MOTOR_PIN, 0);


  // ----------------------------------------------------------
  // I2C
  // ----------------------------------------------------------

  Wire.begin();
  #if defined(ARDUINO_UNOR4_MINIMA) || defined(ARDUINO_UNOR4_WIFI) || defined(WIRE_HAS_TIMEOUT)
  Wire.setWireTimeout(25000 /* us */, true /* reset_on_timeout */);
  #endif


  // ----------------------------------------------------------
  // LCD (Safe Init)
  // ----------------------------------------------------------

  Serial.println("Initializing LCD...");
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CONVEYOR");
  lcd.setCursor(0, 1);
  lcd.print("MONITORING");
  Serial.println("LCD: Initialized");


  // ----------------------------------------------------------
  // MPU6050
  // ----------------------------------------------------------

  Serial.println("Checking MPU6050...");

  if (mpu.begin())
  {
    mpuAvailable = true;

    Serial.println("MPU6050: OK");

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

    Serial.println("MPU6050: NOT DETECTED");

    Serial.println("Using fake MPU values.");
  }


  // ----------------------------------------------------------
  // DS18B20
  // ----------------------------------------------------------

  Serial.println("Checking DS18B20...");

  temperatureSensor.begin();

  if (temperatureSensor.getDeviceCount() > 0)
  {
    temperatureAvailable = true;

    Serial.println("DS18B20: OK");
  }
  else
  {
    temperatureAvailable = false;

    Serial.println("DS18B20: NOT DETECTED");

    Serial.println("Using fake temperature.");
  }


  // ----------------------------------------------------------
  // HX711
  // ----------------------------------------------------------

  Serial.println("Checking HX711...");

  scale.begin(
    HX711_DT,
    HX711_SCK
  );

  delay(300);

  if (scale.is_ready())
  {
    loadCellAvailable = true;

    Serial.println("HX711: OK");

    scale.set_scale(2280.0);

    scale.tare();
  }
  else
  {
    loadCellAvailable = false;

    Serial.println("HX711: NOT DETECTED");

    Serial.println("Using fake load.");
  }


  // ----------------------------------------------------------
  // ENCODER
  // ----------------------------------------------------------

  attachInterrupt(
    digitalPinToInterrupt(ENCODER_PIN),
    encoderISR,
    RISING
  );


  // ==========================================================
  // SG90 SERVO
  // ==========================================================

  Serial.println("Initializing SG90...");

  cameraServo.attach(SERVO_PIN);

  delay(300);


  // Move to safe starting position

  servoPosition = SERVO_HOME;

  cameraServo.write(
    servoPosition
  );

  delay(1000);


  Serial.println("SG90 SERVO: READY");

  Serial.println("Servo pin: D13");

  Serial.println("Servo range: 20-160 degrees");

  Serial.println("Cleaning interval: 10 seconds");

  Serial.println("Cleaning duration: 5 seconds");


  // ----------------------------------------------------------
  // STARTUP
  // ----------------------------------------------------------

  showStartup();


  // Start the 10-second timer AFTER startup

  lastCleanTime = millis();


  Serial.println();
  Serial.println("SYSTEM READY");
  Serial.println("----------------------------------------------");
  Serial.println("SG90 Servo : D13");
  Serial.println("RGB Blue   : DISCONNECTED");
  Serial.println("Pot        : A2");
  Serial.println("Auto Clean : 10 seconds");
  Serial.println("Clean Time : 5 seconds");
  Serial.println("----------------------------------------------");
}


// ============================================================
// MAIN LOOP
// ============================================================

void loop()
{
  // ----------------------------------------------------------
  // LAPTOP COMMAND
  // ----------------------------------------------------------

  checkLaptopCommand();


  // ----------------------------------------------------------
  // BUTTON
  // ----------------------------------------------------------

  readButton();


  // ----------------------------------------------------------
  // IR
  // ----------------------------------------------------------

  readIR();

  handleIRBuzzer();


  // ----------------------------------------------------------
  // SENSOR UPDATE
  // ----------------------------------------------------------

  if (
    millis() - lastSensorUpdate >=
    SENSOR_INTERVAL
  )
  {
    lastSensorUpdate = millis();

    readSensors();

    sendSensorData();
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


  // ----------------------------------------------------------
  // RGB
  // ----------------------------------------------------------

  updateRGB();


  // ==========================================================
  // AUTOMATIC SERVO CLEANING
  // ==========================================================

  automaticCleaning();

  updateCleaningServo();
}


// ============================================================
// READ ALL SENSORS
// ============================================================

void readSensors()
{
  readMPU6050();

  readTemperature();

  readLoadCell();

  readUltrasonic();

  readCurrent();

  readVibration();

  readSound();

  readPotentiometer();

  calculateBeltSpeed();
}


// ============================================================
// MPU6050
// ============================================================

void readMPU6050()
{
  if (mpuAvailable)
  {
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;

    mpu.getEvent(
      &accel,
      &gyro,
      &temp
    );


    accelX =
      accel.acceleration.x;

    accelY =
      accel.acceleration.y;

    accelZ =
      accel.acceleration.z;


    gyroX =
      gyro.gyro.x;

    gyroY =
      gyro.gyro.y;

    gyroZ =
      gyro.gyro.z;
  }
  else
  {
    // Fake MPU data

    float t =
      millis() / 1000.0;


    accelX =
      0.20 +
      sin(t) * 0.05;

    accelY =
      0.15 +
      cos(t) * 0.05;

    accelZ =
      9.75 +
      sin(t * 0.5) * 0.10;


    gyroX =
      sin(t) * 0.02;

    gyroY =
      cos(t) * 0.02;

    gyroZ =
      sin(t * 0.7) * 0.02;
  }
}


// ============================================================
// TEMPERATURE
// ============================================================

void readTemperature()
{
  if (temperatureAvailable)
  {
    temperatureSensor.requestTemperatures();

    float temp =
      temperatureSensor.getTempCByIndex(0);


    if (
      temp != DEVICE_DISCONNECTED_C
    )
    {
      temperatureC = temp;
    }
    else
    {
      temperatureAvailable = false;
    }
  }


  if (!temperatureAvailable)
  {
    float t =
      millis() / 5000.0;


    temperatureC =
      35.0 +
      sin(t) * 2.0;
  }
}


// ============================================================
// LOAD CELL
// ============================================================

void readLoadCell()
{
  if (loadCellAvailable)
  {
    if (scale.is_ready())
    {
      float reading =
        scale.get_units(2);


      if (
        reading >= 0 &&
        reading < 20
      )
      {
        loadKg = reading;
      }
    }
  }


  if (!loadCellAvailable)
  {
    float t =
      millis() / 4000.0;


    loadKg =
      1.20 +
      sin(t) * 0.15;


    if (loadKg < 0)
      loadKg = 0;
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
    distanceCm = 0;
  }
  else
  {
    distanceCm =
      duration * 0.0343 / 2.0;
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
    raw * (5.0 / 1023.0);


  currentA =
    (voltage - 2.5) /
    0.185;


  if (currentA < 0)
    currentA = 0;


  if (currentA > 20)
    currentA = 20;
}


// ============================================================
// VIBRATION
// ============================================================

void readVibration()
{
  vibrationValue =
    digitalRead(
      VIBRATION_PIN
    );
}


// ============================================================
// SOUND
// ============================================================

void readSound()
{
  soundValue =
    analogRead(
      SOUND_PIN
    );
}


// ============================================================
// POTENTIOMETER
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
      220
    );


  if (motorSpeed < 0)
    motorSpeed = 0;


  if (motorSpeed > 255)
    motorSpeed = 255;


  // Update motor speed if running

  if (motorRunning)
  {
    analogWrite(
      MOTOR_PIN,
      motorSpeed
    );
  }
}


// ============================================================
// BELT SPEED
// ============================================================

void calculateBeltSpeed()
{
  unsigned long currentTime =
    millis();


  unsigned long elapsed =
    currentTime -
    lastEncoderTime;


  if (elapsed >= 1000)
  {
    noInterrupts();

    unsigned long pulses =
      encoderPulses;

    encoderPulses = 0;

    interrupts();


    const float PULSES_PER_REV =
      20.0;


    float revolutions =
      pulses /
      PULSES_PER_REV;


    float rpm =
      revolutions * 60.0;


    float circumference =
      3.14159 * 0.05;


    float revPerSecond =
      rpm / 60.0;


    beltSpeed =
      circumference *
      revPerSecond;


    if (!motorRunning)
    {
      beltSpeed = 0;
    }


    lastEncoderTime =
      currentTime;
  }
}


// ============================================================
// IR SENSOR
// ============================================================

void readIR()
{
  irLeftDetected =
    (
      digitalRead(IR_LEFT_PIN)
      == LOW
    );


  irRightDetected =
    (
      digitalRead(IR_RIGHT_PIN)
      == LOW
    );


  bool objectDetected =
    irLeftDetected ||
    irRightDetected;


  if (objectDetected)
  {
    if (!irStable)
    {
      if (irDetectionStart == 0)
      {
        irDetectionStart =
          millis();
      }


      if (
        millis() -
        irDetectionStart >=
        100
      )
      {
        irStable = true;
      }
    }
  }
  else
  {
    irDetectionStart = 0;

    irStable = false;
  }
}


// ============================================================
// IR BUZZER
// ============================================================

void handleIRBuzzer()
{
  bool objectDetected =
    irLeftDetected ||
    irRightDetected;


  if (
    objectDetected &&
    !previousIRState &&
    irStable
  )
  {
    buzzerActive = true;

    buzzerStartTime =
      millis();


    digitalWrite(
      BUZZER_PIN,
      HIGH
    );


    Serial.println(
      "IR ALERT: OBJECT DETECTED"
    );
  }


  if (buzzerActive)
  {
    if (
      millis() -
      buzzerStartTime >=
      BUZZER_DURATION
    )
    {
      buzzerActive = false;


      digitalWrite(
        BUZZER_PIN,
        LOW
      );
    }
  }


  previousIRState =
    objectDetected;
}


// ============================================================
// BUTTON
// ============================================================

void readButton()
{
  bool buttonState =
    digitalRead(
      BUTTON_PIN
    );


  if (
    buttonState == LOW &&
    lastButtonState == HIGH
  )
  {
    if (
      millis() -
      lastButtonTime >=
      BUTTON_DEBOUNCE
    )
    {
      lastButtonTime =
        millis();


      if (motorRunning)
      {
        motorOff();
      }
      else
      {
        motorOn();
      }
    }
  }


  lastButtonState =
    buttonState;
}


// ============================================================
// MOTOR ON
// ============================================================

void motorOn()
{
  motorRunning = true;


  analogWrite(
    MOTOR_PIN,
    motorSpeed
  );


  Serial.println(
    "MOTOR: ON"
  );
}


// ============================================================
// MOTOR OFF
// ============================================================

void motorOff()
{
  motorRunning = false;


  analogWrite(
    MOTOR_PIN,
    0
  );


  Serial.println(
    "MOTOR: OFF"
  );
}


// ============================================================
// RGB
// ============================================================

void updateRGB()
{
  bool warning =
    (
      temperatureC > 45.0
    ) ||
    (
      currentA > 4.0
    ) ||
    (
      vibrationValue == HIGH
    );


  bool critical =
    (
      temperatureC > 60.0
    ) ||
    (
      currentA > 5.0
    );


  if (critical)
  {
    // RED

    digitalWrite(
      RGB_R_PIN,
      HIGH
    );

    digitalWrite(
      RGB_G_PIN,
      LOW
    );
  }
  else if (warning)
  {
    // RED + GREEN

    digitalWrite(
      RGB_R_PIN,
      HIGH
    );

    digitalWrite(
      RGB_G_PIN,
      HIGH
    );
  }
  else
  {
    // GREEN

    digitalWrite(
      RGB_R_PIN,
      LOW
    );

    digitalWrite(
      RGB_G_PIN,
      HIGH
    );
  }
}


// ============================================================
// LCD
// ============================================================

void updateLCD()
{
  lcd.clear();


  switch (lcdPage)
  {
    case 0:

      lcd.setCursor(0, 0);

      lcd.print("Temp:");

      lcd.print(
        temperatureC,
        1
      );

      lcd.print(" C");


      lcd.setCursor(0, 1);

      lcd.print("Load:");

      lcd.print(
        loadKg,
        2
      );

      lcd.print(" kg");

      break;


    case 1:

      lcd.setCursor(0, 0);

      lcd.print("Vibration:");

      if (vibrationValue)
        lcd.print("HIGH");
      else
        lcd.print("OK");


      lcd.setCursor(0, 1);

      lcd.print("Current:");

      lcd.print(
        currentA,
        1
      );

      lcd.print("A");

      break;


    case 2:

      lcd.setCursor(0, 0);

      lcd.print("Sound:");

      lcd.print(
        soundValue
      );


      lcd.setCursor(0, 1);

      lcd.print("Dist:");

      lcd.print(
        distanceCm,
        1
      );

      lcd.print("cm");

      break;


    case 3:

      lcd.setCursor(0, 0);

      lcd.print("Belt:");

      lcd.print(
        beltSpeed,
        2
      );

      lcd.print("m/s");


      lcd.setCursor(0, 1);

      if (motorRunning)
        lcd.print("Motor: ON");
      else
        lcd.print("Motor: OFF");

      break;


    case 4:

      lcd.setCursor(0, 0);

      if (irLeftDetected)
        lcd.print("IR LEFT: OBJECT");
      else
        lcd.print("IR LEFT: CLEAR");


      lcd.setCursor(0, 1);

      if (irRightDetected)
        lcd.print("IR RIGHT: OBJECT");
      else
        lcd.print("IR RIGHT: CLEAR");

      break;


    case 5:

      lcd.setCursor(0, 0);

      lcd.print("MPU X:");

      lcd.print(
        accelX,
        1
      );


      lcd.setCursor(0, 1);

      lcd.print("Y:");

      lcd.print(
        accelY,
        1
      );

      lcd.print(" Z:");

      lcd.print(
        accelZ,
        1
      );

      break;


    case 6:

      lcd.setCursor(0, 0);

      lcd.print("DS18B20 TEMP");


      lcd.setCursor(0, 1);

      lcd.print(
        temperatureC,
        1
      );

      lcd.print(" C");

      break;


    case 7:

      lcd.setCursor(0, 0);

      lcd.print("LOAD CELL");


      lcd.setCursor(0, 1);

      lcd.print(
        loadKg,
        2
      );

      lcd.print(" kg");

      break;
  }


  lcdPage++;


  if (lcdPage > 7)
  {
    lcdPage = 0;
  }
}


// ============================================================
// SEND DATA TO LAPTOP
// ============================================================

void sendSensorData()
{
  Serial.print("DATA,");

  Serial.print("TEMP=");
  Serial.print(
    temperatureC,
    2
  );

  Serial.print(",LOAD=");
  Serial.print(
    loadKg,
    2
  );

  Serial.print(",ACCX=");
  Serial.print(
    accelX,
    2
  );

  Serial.print(",ACCY=");
  Serial.print(
    accelY,
    2
  );

  Serial.print(",ACCZ=");
  Serial.print(
    accelZ,
    2
  );

  Serial.print(",GYROX=");
  Serial.print(
    gyroX,
    2
  );

  Serial.print(",GYROY=");
  Serial.print(
    gyroY,
    2
  );

  Serial.print(",GYROZ=");
  Serial.print(
    gyroZ,
    2
  );

  Serial.print(",VIB=");
  Serial.print(
    vibrationValue
  );

  Serial.print(",DIST=");
  Serial.print(
    distanceCm,
    2
  );

  Serial.print(",CURRENT=");
  Serial.print(
    currentA,
    2
  );

  Serial.print(",SOUND=");
  Serial.print(
    soundValue
  );

  Serial.print(",SPEED=");
  Serial.print(
    beltSpeed,
    3
  );

  Serial.print(",IRL=");
  Serial.print(
    irLeftDetected ? 1 : 0
  );

  Serial.print(",IRR=");
  Serial.print(
    irRightDetected ? 1 : 0
  );

  Serial.print(",MOTOR=");
  Serial.print(
    motorRunning ? 1 : 0
  );

  Serial.print(",SERVO=");
  Serial.print(
    servoPosition
  );

  Serial.println();
}


// ============================================================
// LAPTOP COMMAND
// ============================================================

void checkLaptopCommand()
{
  if (Serial.available())
  {
    String command =
      Serial.readStringUntil('\n');


    command.trim();

    command.toUpperCase();


    if (command == "CLEAN")
    {
      Serial.println(
        "MANUAL CLEAN COMMAND RECEIVED"
      );

      startCleaning();
    }


    else if (command == "MOTOR_ON")
    {
      motorOn();
    }


    else if (command == "MOTOR_OFF")
    {
      motorOff();
    }
  }
}


// ============================================================
// START CLEANING
// ============================================================

void startCleaning()
{
  if (cleaningInProgress)
  {
    return;
  }


  cleaningInProgress = true;


  cleaningStartTime =
    millis();


  lastServoStep =
    millis();


  servoPosition =
    SERVO_MIN;


  servoDirection =
    1;


  cameraServo.write(
    servoPosition
  );


  Serial.println(
    "================================"
  );

  Serial.println(
    "CAMERA CLEANING STARTED"
  );

  Serial.println(
    "SERVO: 20 -> 160 -> 20"
  );

  Serial.println(
    "DURATION: 5 SECONDS"
  );

  Serial.println(
    "================================"
  );
}


// ============================================================
// AUTOMATIC CLEANING
// ============================================================

void automaticCleaning()
{
  if (!cleaningInProgress)
  {
    if (
      millis() -
      lastCleanTime >=
      CLEAN_INTERVAL
    )
    {
      lastCleanTime =
        millis();


      startCleaning();
    }
  }
}


// ============================================================
// SERVO CLEANING
// ============================================================

void updateCleaningServo()
{
  if (!cleaningInProgress)
  {
    return;
  }


  // ----------------------------------------------------------
  // CHECK 5 SECOND CLEANING TIME
  // ----------------------------------------------------------

  if (
    millis() -
    cleaningStartTime >=
    CLEAN_DURATION
  )
  {
    servoPosition =
      SERVO_HOME;


    cameraServo.write(
      servoPosition
    );


    cleaningInProgress =
      false;


    Serial.println(
      "CAMERA CLEANING COMPLETE"
    );


    return;
  }


  // ----------------------------------------------------------
  // MOVE SERVO
  // ----------------------------------------------------------

  if (
    millis() -
    lastServoStep >=
    SERVO_STEP_INTERVAL
  )
  {
    lastServoStep =
      millis();


    servoPosition +=
      servoDirection * 5;


    // --------------------------------------------------------
    // REACHED 160°
    // --------------------------------------------------------

    if (
      servoPosition >=
      SERVO_MAX
    )
    {
      servoPosition =
        SERVO_MAX;

      servoDirection =
        -1;
    }


    // --------------------------------------------------------
    // REACHED 20°
    // --------------------------------------------------------

    if (
      servoPosition <=
      SERVO_MIN
    )
    {
      servoPosition =
        SERVO_MIN;

      servoDirection =
        1;
    }


    cameraServo.write(
      servoPosition
    );
  }
}


// ============================================================
// STARTUP
// ============================================================

void showStartup()
{
  // GREEN

  digitalWrite(
    RGB_R_PIN,
    LOW
  );

  digitalWrite(
    RGB_G_PIN,
    HIGH
  );


  // Two short beeps

  digitalWrite(
    BUZZER_PIN,
    HIGH
  );

  delay(100);

  digitalWrite(
    BUZZER_PIN,
    LOW
  );

  delay(100);

  digitalWrite(
    BUZZER_PIN,
    HIGH
  );

  delay(100);

  digitalWrite(
    BUZZER_PIN,
    LOW
  );


  // LCD

  lcd.clear();

  lcd.setCursor(0, 0);

  lcd.print("SYSTEM READY");

  lcd.setCursor(0, 1);

  lcd.print("PROJECT SUCCESS");


  delay(2000);


  lcd.clear();

  lcd.setCursor(0, 0);

  lcd.print("CONVEYOR");

  lcd.setCursor(0, 1);

  lcd.print("MONITORING");


  delay(1000);
}
