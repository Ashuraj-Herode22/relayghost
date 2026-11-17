# Specification: Stamping Press Temporal Interlock

## 1. System Intent & Scope
This specification defines the formal temporal safety invariants required to prevent mechanical collisions between the Hydraulic Stamping Press (%QX0.0) and the Robotic Transfer Arm (%QX0.1) during automated stamping cycles.

## 2. Formal Requirements (Rolls-Royce EARS Notation)

### 2.1 Mutual Exclusion Invariant
- WHILE Transfer Arm (%QX0.1) is latched or extended in die zone
- THE SYSTEM SHALL inhibit Press Extend Coil (%QX0.0).

### 2.2 Reverse Interlock Invariant
- WHILE Hydraulic Press (%QX0.0) is extended or stroking downward
- THE SYSTEM SHALL inhibit Transfer Arm Latch (%QX0.1).

### 2.3 Sensor Glitch & Timer Tolerance
- WHEN Retraction Limit Switch (%IX0.2) bounces or delays
- THE SYSTEM SHALL hold Press Descent Timer (T4:1) in reset until arm retraction is confirmed.

### 2.4 Emergency Stop Override
- WHEN Emergency Stop (%IX0.4) is de-energized
- THE SYSTEM SHALL unlatch all motion coils and reset timer accumulators within 0 scan cycles.
