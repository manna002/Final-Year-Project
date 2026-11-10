# FUNAAB Smart Farm System
## Updated Bill of Materials & Final Budget Estimates (NGN)

**Key Architectural Changes:**
* **DC Water Pump Removed:** The water pump has been completely eliminated from the architecture. The farm is now operated on a gravity-fed tank or direct municipal tap water line.
* **Heavy-Duty Brass Solenoid Valve Upgraded (Item 11):** Upgraded to a 1/2-inch Brass 12V DC Solenoid Valve, providing industrial resilience against high water pressure and temperature without the risk of cracking inherent in plastic valves.
* **Soil NPK Sensor Module Added (Item 22):** Dedicated multi-element nutrient sensor for Nitrogen, Phosphorus, and Potassium.

---

### Final Component Price Estimates (Nigerian Naira - ₦)

| S/N | Item Description | Estimated Unit/Pack Price (₦) |
| :---: | :--- | :---: |
| 1 | ESP32 Dev Board (Type-C) | ₦17,000 – ₦22,000 |
| 2 | GSM Module (e.g., SIM800L) | ₦13,500 – ₦18,500 |
| 3 | SIM Card + Initial Data Pack | ₦1,500 – ₦3,000 |
| 4 | DS3231 RTC Module | ₦4,500 – ₦6,500 |
| 5 | 0.96 inch OLED Display | ₦6,000 – ₦9,000 |
| 6 | DHT22 Temperature & Humidity Sensor | ₦5,500 – ₦8,000 |
| 7 | Capacitive Soil Moisture Sensor | ₦3,500 – ₦5,500 |
| 8 | Float Switch (Water Level) | ₦4,000 – ₦7,000 |
| 9 | Water Flow Meter (e.g., YF-S201) | ₦8,500 – ₦12,500 |
| 10 | 8-Channel 5V Relay Module | ₦12,000 – ₦16,500 |
| 11 | 12V Brass Solenoid Valve (1/2 inch, Heavy Duty) | ₦18,000 – ₦26,000 |
| 12 | 12V 7Ah Lead-Acid Battery | ₦20,000 – ₦26,000 |
| 13 | Basic PCB Board (Prototyping/Dot matrix) | ₦2,500 – ₦5,000 |
| 14 | Regulators, Resistors, LEDs (Assorted pack) | ₦4,000 – ₦7,500 |
| 15 | Wires (4yd Digital + 19yd DC hooks) | ₦4,500 – ₦8,500 |
| 16 | Jumper Wires (3 Ribbon Packs: M-M, M-F, F-F) | ₦7,500 – ₦11,000 |
| 17 | Ventilation Fans (Intake/Exhaust 12V pairs) | ₦8,000 – ₦15,000 |
| 18 | Normal Net (Standard 130 sqm general mesh) | ₦25,000 – ₦38,000 |
| 19 | Polythene Nylon Sheet (4 yards of thick DPC / 10x12ft) | ₦3,200 – ₦6,000 |
| 20 | 4-inch PVC Pipes (For 70m total / ~12 lengths) | ₦96,000 – ₦130,000 |
| 21 | Hydroponic Net Cups (Pack of 50-100) | ₦12,000 – ₦20,000 |
| 22 | Standard/Normal Soil NPK Sensor Module (UART/Serial) | ₦35,000 – ₦55,000 |
| 23 | Miscellaneous (Tape, PVC glue, project box casing) | ₦15,000 – ₦22,000 |
| **Total** | **Adjusted Project Grand Total** | **₦325,200 – ₦471,000** |

---

### Plumbing, Actuation & Circuit Protection Notes

* **Valve Price Counterbalance:** Upgrading to a heavy-duty brass valve increased row 11's price (₦18,000 – ₦26,000), but removing the DC water pump entirely counterbalanced the cost, keeping the overall hardware budget steady.
* **Flyback Diode Protection (1N4007):** Brass solenoid valves utilize a heavy copper electromagnetic coil. When the relay opens the circuit, the collapsing magnetic field produces an inductive voltage spike (back-EMF) reaching up to 200V. A **1N4007 rectifier diode** must be connected in reverse-bias across the solenoid terminals (Cathode/Silver band to +12V, Anode to Switched Ground) to safely dissipate this spike and protect relay contacts and the ESP32.
