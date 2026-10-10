# Bill of Materials (BOM)
**FUNAAB Smart Irrigation & Hydroponics System**

Here is the comprehensive list of hardware components, updated to include the solar power system, GSM communications, greenhouse structural materials, and the hydroponics subsystem.

## 1. Processing, UI & Communications
| Item | Qty | Notes |
| :--- | :---: | :--- |
| **ESP32 Development Board** | 1 | Must be the **Type-C USB** variant. Acts as the brain of the system. |
| **GSM Module** | 1 | e.g., SIM800L or SIM7000. Provides cellular data connection where Wi-Fi is unavailable. |
| **SIM Card** | 1 | Active SIM card with a data plan for the GSM module. |
| **Real-Time Clock (RTC) Module** | 1 | e.g., DS3231. Keeps exact time for timers even if the ESP32 loses internet/power. |
| **OLED Display** | 1 | 0.96" I2C OLED to show local status directly on the control box. |

## 2. Power System (Solar & Battery)
| Item | Qty | Notes |
| :--- | :---: | :--- |
| **Solar Panel** | 1 | A compact solar panel (e.g., 12V 10W - 30W) to charge the system off-grid. |
| **Lead-Acid Battery** | 1 | 12V sealed lead-acid battery (e.g., 7Ah or 12Ah) for long run-time during nights/cloudy days. |
| **12V DC Power Cable** | 1 | For connecting/testing main power delivery. |
| **DC Jack Connectors** | 1 Set | Includes both Male and Female DC barrel jacks for clean power routing. |

## 3. Circuitry & PCB Components
| Item | Qty | Notes |
| :--- | :---: | :--- |
| **PCB Board** | 1 | For permanently soldering the components instead of using a breadboard. |
| **Voltage Regulators** | 10 | To step down 12V from the battery to 5V (for relays/sensors) and 3.3V (for ESP32/GSM). |
| **Capacitors** | 10 | Essential for smoothing power, especially for the GSM module which draws heavy current spikes. |
| **Resistors** | 10 | Assorted values (e.g., 220Ω for LEDs, 4.7kΩ for pull-ups). |
| **LEDs** | 5 | For physical status indication on the control box. |

## 4. Sensors
| Item | Qty | Notes |
| :--- | :---: | :--- |
| **DHT Sensor** | 2 | DHT22 recommended for temperature and humidity. |
| **Capacitive Soil Moisture Sensor** | 1 | For reading soil water levels. |
| **Float Switch** | 1 | To monitor if the water tank is empty or full. |
| **Water Flow Meter** | 1 | In-line Hall Effect sensor (e.g., YF-S201) to measure water volume. |

## 5. Relays & Actuators
| Item | Qty | Notes |
| :--- | :---: | :--- |
| **Relay Module (5-Channels used)**| 1 | Needs to handle **High Voltage (220V AC)**. Recommend an 8-Channel 5V Relay board to cover the 5 required triggers. |
| **Solenoid Valve** | 1 | Electronic valve to release water into the greenhouse. |
| **DC Water Pump** | 1 | Used for **demonstration purposes** (pumping water into the tank/system). |

## 6. Wiring & Cables
| Item | Qty | Notes |
| :--- | :---: | :--- |
| **Digital Wire** | 19 Yards| Lightweight cable for extending sensor data communication lines. |
| **DC Power Wire** | 19 Yards| Thicker gauge cable to carry power safely over long distances to valves/pumps. |
| **Jumper Wires (M-to-M)** | 1 Pack | Male-to-Male Dupont wires. |
| **Jumper Wires (M-to-F)** | 1 Pack | Male-to-Female Dupont wires. |

## 7. Greenhouse Structure & Ventilation (4x4m Base, 8m Height)
| Item | Qty/Amount | Notes |
| :--- | :---: | :--- |
| **Ventilation Fans** | 2 | 1 Intake fan (blowing air in) + 1 Exhaust fan (blowing air out) for climate control. |
| **Anti-Pest Netting** | ~130 sq meters | *Calculation:* For a 4x4m base, the perimeter is 16m. Assuming the net wraps around the 4 sides up to the full 8m height, $16m \times 8m = 128m^2$. Rounded up to 130 square meters to allow for overlaps and door framing. |
| **Polythene Nylon Sheet** | ~45 sq meters | *Calculation:* To cover the dome roof over a 4x4 base. An arc over a 4m span is roughly 6.28m long. Multiplying by the 4m depth = 25m². Adding the front and back dome faces (~12m²), the total is ~37m². Rounded up to 45-50 square meters for securing edges. |

## 8. Hydroponics Subsystem
| Item | Qty | Notes |
| :--- | :---: | :--- |
| **Large PVC Pipes** | 7 meters per run | 4-inch to 6-inch diameter pipes (bucket bottom size) for NFT/DWC hydroponics. *Note: Standard PVC comes in 3m or 6m lengths, so you will need a pipe coupler/joiner to reach exactly 7 meters.* |
| **Hydroponic Net Cups** | ~25 per pipe | Plastic slotted cups for holding plants. Placed into holes drilled along the PVC pipe (approx. every 30cm). |
