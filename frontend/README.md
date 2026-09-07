# Conveyor Guardian

Continue developing the existing ConveyorGuard AI application.

IMPORTANT: This is NOT a request to redesign the application from scratch. Inspect the existing project first, identify what has already been implemented, preserve all working UI/components/styles, and implement the missing functionality listed below.

The application is a single-page frontend-only interface for ONE iron ore conveyor belt.

Tell me what hasn't been done after the credits end

Do NOT introduce:

Multiple conveyors

Conveyor selection

Site selection

Conveyor network monitoring

Drone inspection

Digital twin

Analytics

Reports

Historical analytics

Backend

APIs

Databases

Supabase

Lovable Cloud

Firebase

Authentication

Server-side functionality

Everything must remain frontend-only.

==================================================
CURRENT TASK

The following features have NOT yet been completed. Implement ALL of them and integrate them properly into the existing application.

Do not stop after implementing only the visual UI. Make the interactions functional using React state/context.

==================================================

LIVE CONVEYOR MONITORING VISUALIZATION
==================================================

Create/complete the main live conveyor monitoring visualization.

It must visually represent ONE conveyor in this exact conceptual order:

MOTOR
→
DRIVE PULLEY
→
CONVEYOR BELT
→
ROLLERS
→
JOINT 01
→
JOINT 02
→
JOINT 03
→
JOINT 04
→
JOINT 05
→
TAIL PULLEY

The conveyor should look like an industrial conveyor system rather than a generic diagram.

Requirements:

Clearly show motor

Clearly show drive pulley

Show moving conveyor belt

Show rollers beneath the belt

Show exactly 5 belt joints

Show tail pulley

Make all 5 joints clickable

Give each joint a visible condition indicator

Use Normal / Warning / Critical / Unknown states

Visually distinguish the selected joint

Add subtle animation to the moving belt/rollers

Do not make the animation excessive

When a user clicks a joint:

Set it as the selected joint.

Highlight it visually.

Update the Selected Joint Condition panel.

Update the relevant sensor information.

Update AI inspection information where applicable.

Update predictive-maintenance information.

Update the relevant alert/recommendation state if applicable.

All of this must happen on the SAME PAGE.

Do NOT create another route/page for joint details.

==================================================
2. SELECTED JOINT CONDITION PANEL

Create/complete the panel:

"SELECTED JOINT CONDITION"

It must react to the currently selected joint.

Display:

Joint identifier

Condition

Health score

Failure probability

Remaining Useful Life

Risk level

Detected issues

Inspection status

AI recommendation

If no joint has been selected:

"Select a belt joint to inspect its condition."

Make the panel visually prominent because joint rupture prevention is the core problem being solved.

The panel must update whenever another joint is clicked.

==================================================
3. BELT CONDITION SECTION

Create/complete:

"BELT CONDITION"

This section represents the condition of the ONE conveyor belt.

Display condition indicators for:

Overall belt health

Belt alignment

Belt wear

Edge condition

Surface condition

Splice/joint condition

Use clear states:

NORMAL
WARNING
CRITICAL
UNKNOWN

Do not create separate belt-condition pages.

Keep this section inside the main dashboard.

==================================================
4. LIVE SENSOR TELEMETRY

Create/complete:

"LIVE SENSOR TELEMETRY"

Create cards for:

Vibration

Temperature

Belt Tension

Load

Belt Speed

Acoustic Condition

Alignment

Each card must contain:

Sensor icon

Sensor name

Current reading

Unit

Status

Live indicator

Small sparkline/trend visualization where appropriate

The interface must NOT permanently hardcode operational readings.

Implement the existing frontend simulation state/context so values can change dynamically.

If the project currently has a Simulation Mode, use it.

If there is no active simulated data:

Show:

"Awaiting live data"

Do not present fake static values as actual measurements.

==================================================
5. REAL-TIME SENSOR MONITOR CHART

Create/complete:

"REAL-TIME SENSOR MONITOR"

Add tabs:

Vibration

Temperature

Tension

Load

Speed

Acoustic

Alignment

Add time controls:

Live

1 Min

5 Min

15 Min

The selected tab must change the chart.

The selected time range must change the displayed visualization.

The chart should visually behave like a live monitoring chart rather than a static analytics chart.

When simulation is active:

Generate/update readings dynamically using frontend state.

Animate/update the chart smoothly.

When no readings are available:
Show:

"No live sensor data"

Do not use a fixed historical analytics dataset.

==================================================
6. AI VISION INSPECTION

Create/complete:

"AI VISION INSPECTION"

Build a large professional industrial camera-monitoring panel.

The camera area should visually resemble a camera pointed at a conveyor belt.

Include:

LIVE CAMERA indicator

Camera frame

Belt surface

Joint/splice area

AI detection overlays

Support detection overlays for:

Crack

Tear

Edge Damage

Belt Wear

Splice Degradation

Belt Rupture

Misalignment

Foreign Object

When a simulated defect is active:

Draw a bounding box around the affected area.

Display defect label.

Display severity.

Display confidence.

Associate the defect with the relevant joint where applicable.

If there is no active detection:

"Awaiting AI inspection"

When Simulation Mode is active, clearly indicate:

"SIMULATED AI DETECTION"

Do not make simulated detections look like genuine live camera data.

==================================================
7. AI DETECTION DETAILS

Create/complete:

"AI DETECTION DETAILS"

Display detected conditions in a clean list.

Each detection should show:

Defect type

Confidence

Severity

Belt location

Joint

Detection time

Make each detection clickable.

When clicked:

Highlight the detection overlay in the camera panel.

Highlight the associated joint.

Update Selected Joint Condition.

Update AI Predictive Maintenance.

Update AI Recommendation.

All interactions must remain on the same page.

==================================================
8. AI PREDICTIVE MAINTENANCE

Create/complete:

"AI PREDICTIVE MAINTENANCE"

Display:

Belt Health

Selected Joint Health

Failure Probability

Remaining Useful Life

Risk Level

Prediction Status

Use strong visual hierarchy.

The default empty state should be:

"Awaiting sufficient sensor and inspection data."

When Simulation Mode is active, values should dynamically reflect the selected simulation condition.

For example:

NORMAL:

Healthy condition

Low failure risk

WARNING:

Degraded condition

Increased risk

CRITICAL:

Severe condition

High failure risk

Reduced RUL

Do not use permanently hardcoded prediction numbers.

==================================================
9. CURRENT DEGRADATION CHART

Create/complete:

"CURRENT DEGRADATION"

Use a clean line chart showing:

CURRENT CONDITION
→
SHORT-TERM PREDICTED CONDITION

Clearly distinguish the current state and predicted state.

This is NOT a historical analytics chart.

Do not show months/years of historical performance.

The visualization should communicate:

"Is the current condition getting worse and what is likely to happen next?"

When no prediction is available:

"Awaiting prediction data"

==================================================
10. AI EXPLANATION

Create/complete:

"WHY IS THE SYSTEM PREDICTING FAILURE?"

Display contributing factors.

Possible factors:

Abnormal vibration

High belt tension

Temperature rise

Splice wear

Edge damage

Misalignment

Acoustic anomaly

Use clean contribution bars/indicators.

These must react to the simulated condition.

For example:

NORMAL:
No major contributing factors.

WARNING:
Moderate vibration/tension/wear contribution.

CRITICAL:
Strong vibration/tension/splice-damage contribution.

Default state:

"AI explanation unavailable — awaiting inspection data."

==================================================
11. AI RECOMMENDATION

Create/complete:

"AI RECOMMENDATION"

This section should dynamically respond to the current belt/joint condition.

Examples of frontend simulation behavior:

NORMAL:
"Continue normal monitoring."

WARNING:
"Inspect the affected belt joint and monitor vibration and tension."

CRITICAL:
"Immediate inspection and maintenance of the affected joint is recommended."

Do not permanently hardcode one recommendation.

Add:

[ CREATE MAINTENANCE WORK ORDER ]

This button must open the Work Order modal described below.

==================================================
12. ACTIVE ALERTS

Create/complete:

"ACTIVE ALERTS"

Display alerts generated by the current simulated monitoring state.

Each alert should contain:

Severity

Affected joint

Condition

Timestamp

Status

Possible states:

Critical

Warning

Attention

Resolved

When there are no alerts:

"NO ACTIVE ALERTS"

When the simulation is switched to WARNING or CRITICAL, alerts should appear dynamically.

Clicking an alert must:

Select the affected joint

Highlight the joint on the conveyor

Highlight related sensor information

Highlight relevant AI detection

Scroll/focus the appropriate dashboard section if useful

==================================================
13. MAINTENANCE ACTIONS

Create/complete:

"MAINTENANCE ACTIONS"

Display maintenance tasks created through the UI.

Each task should contain:

Affected Joint

Issue

Priority

Assigned Technician

Scheduled Time

Status

Possible statuses:

Pending

Assigned

In Progress

Completed

Initial empty state:

"NO ACTIVE MAINTENANCE TASKS"

When a work order is created, it must appear here immediately using React state.

Clearly mark simulated/demo tasks if they are generated automatically.

==================================================
14. WORK ORDER MODAL

Create/complete the:

"CREATE MAINTENANCE WORK ORDER"

modal.

When the user clicks:

[ CREATE MAINTENANCE WORK ORDER ]

open a polished modal.

Fields:

Affected Joint
Detected Issue
Priority
Recommended Action
Assigned Technician
Scheduled Date
Scheduled Time
Notes

If the user opened the modal from a selected joint or AI recommendation:

Automatically populate relevant fields from the current UI state.

The user should be able to edit the fields.

Buttons:

[ Cancel ]
[ Create Work Order ]

Validation:

Required fields should be validated.

Show clear inline validation messages.

Do not allow invalid submission.

On successful creation:

Close the modal.

Add the work order to Maintenance Actions.

Show a success toast.

Reset the form.

Preserve the selected joint.

Update the maintenance task state.

==================================================
15. SONNER TOAST + ROOT TOASTER

Use Sonner for notifications.

Make sure the project has a mounted:

<Toaster />

inside:

__root.tsx

If Sonner is not currently configured:

Add/import the appropriate Sonner component.

Mount <Toaster /> in __root.tsx.

Ensure it is mounted globally and does not get duplicated.

Use toast notifications for:

Work order created successfully

Work order creation error/validation

Alert acknowledged

Simulation state changed

Any other meaningful UI confirmation

Do not create a custom toast system if Sonner is already available.

==================================================
16. CONVEYOR PROVIDER

Use the existing or create a frontend-only:

ConveyorProvider

The provider should manage the state required by the entire dashboard.

It should provide state/actions for things such as:

Selected joint

Joint conditions

Sensor values

Sensor chart state

AI detections

Prediction state

Alerts

Maintenance tasks

Simulation mode

Simulation severity/state

Do not create a backend.

Do not create API calls.

The provider should simply coordinate frontend state and interactions.

Avoid prop-drilling the same monitoring state through many components.

==================================================
17. src/routes/index.tsx

The current:

src/routes/index.tsx

is still using the template placeholder.

Replace the placeholder with the actual ConveyorGuard AI single-page dashboard.

The route should:

Render the complete dashboard.

Wrap the dashboard with ConveyorProvider.

Ensure all child components can access shared conveyor state.

Preserve the existing router architecture.

Do not create additional routes.

Conceptually:

ConveyorProvider
↓
ConveyorGuard Dashboard
├── Header
├── System Status
├── Conveyor Health
├── Live Conveyor Monitor
├── Joint Condition
├── Belt Condition
├── Sensor Telemetry
├── Sensor Chart
├── AI Vision
├── AI Detection Details
├── Predictive Maintenance
├── Current Degradation
├── AI Explanation
├── AI Recommendation
├── Active Alerts
└── Maintenance Actions

==================================================
18. ROUTE HEAD METADATA

Add/complete the route head() metadata.

Use an appropriate page title such as:

"ConveyorGuard AI — Conveyor Health Monitoring"

Add an appropriate description:

"Real-time conveyor belt joint health monitoring, AI vision inspection and predictive maintenance."

Ensure the metadata is properly defined using the routing framework already present in the project.

Do not add unnecessary SEO/marketing content.

==================================================
19. SIMULATION BEHAVIOR

Ensure the existing Simulation Mode works across ALL sections.

Provide:

LIVE
SIMULATION

and simulation conditions:

NORMAL
WARNING
CRITICAL

When NORMAL is selected:

Conveyor joints appear healthy

Sensors remain within normal ranges

AI vision shows no critical defect

Prediction shows low risk

No critical alerts

Maintenance recommendation is normal monitoring

When WARNING is selected:

One or more joints show warning state

Sensor readings become abnormal

AI vision shows an early-stage defect

Prediction risk increases

Warning alert appears

Maintenance recommendation appears

When CRITICAL is selected:

One joint becomes critical

Sensor readings become significantly abnormal

AI vision detects serious belt/joint damage

Failure probability increases

RUL decreases

Critical alert appears

AI explanation identifies contributing factors

AI recommendation becomes urgent

Create Maintenance Work Order becomes prominent

The entire dashboard must remain synchronized.

==================================================
20. RESPONSIVE DESIGN

Ensure all newly implemented sections work on:

Desktop

Laptop

Tablet

Mobile

Desktop:
Use the full control-room layout.

Tablet:
Use responsive two-column layouts.

Mobile:
Stack sections vertically.

The conveyor visualization must remain usable on mobile.

Joint markers must remain clickable.

Charts must remain readable.

The Work Order modal must fit smaller screens.

Prevent horizontal page overflow.

==================================================
21. INTERACTION BETWEEN SECTIONS

This is extremely important.

All sections must feel like one connected system.

Example:

User clicks:

JOINT 04

↓

Selected Joint Condition updates

↓

Sensor telemetry highlights abnormal sensors

↓

AI Vision focuses on Joint 04

↓

AI Detection Details highlights the corresponding defect

↓

Predictive Maintenance updates

↓

AI Explanation updates

↓

AI Recommendation updates

↓

Relevant Alert is highlighted

↓

User clicks Create Maintenance Work Order

↓

Work Order modal opens with Joint 04 information prefilled

↓

User submits

↓

Maintenance Actions updates

↓

Sonner success toast appears

This complete flow must work.

==================================================
22. DESIGN CONSISTENCY

Do not redesign already-completed sections unless necessary.

Reuse:

Existing color palette

Existing typography

Existing spacing system

Existing card styles

Existing buttons

Existing icons

Existing responsive behavior

New components must visually match the current application.

Avoid introducing unrelated design patterns.

==================================================
23. NO EXTRA FEATURES

Do not add:

Multiple conveyor support

Site management

User management

Analytics

Reports

Historical dashboards

Digital twin

Drone inspection

Backend

Database

API

Authentication

Cloud services

Production management

Inventory management

Financial metrics

Only implement the missing features listed in this prompt.

==================================================
24. FINAL RESPONSIVE / BUILD CHECK

After implementing everything:

Check all TypeScript errors.

Check all imports.

Check all component references.

Check that ConveyorProvider is correctly wired.

Check that src/routes/index.tsx no longer contains the template placeholder.

Check that head() metadata works.

Check that <Toaster /> is mounted exactly once in __root.tsx.

Check that Sonner toasts work.

Check that all 5 joints are clickable.

Check that selecting a joint updates the dependent sections.

Check Simulation Mode.

Check NORMAL / WARNING / CRITICAL states.

Check the Work Order modal.

Check that creating a work order updates Maintenance Actions.

Check responsive behavior.

Check for horizontal overflow.

Check that no console errors remain.

Check that the application builds successfully.

Fix any errors you encounter rather than leaving TODOs or broken placeholders.

==================================================
25. DEFINITION OF DONE

The task is complete ONLY when:

✓ One conveyor visualization is functional

✓ Motor → Drive Pulley → Belt → Rollers → 5 clickable Joints → Tail Pulley is visible

✓ All 5 joints are clickable

✓ Selected Joint Condition reacts to selection

✓ Belt Condition section works

✓ Sensor telemetry cards work

✓ Sensor chart tabs work

✓ Live / 1 / 5 / 15 minute controls work

✓ AI Vision Inspection is implemented

✓ AI detection overlays work

✓ AI Detection Details works

✓ AI Predictive Maintenance works

✓ Current Degradation visualization works

✓ AI Explanation works

✓ AI Recommendation works

✓ Active Alerts works

✓ Maintenance Actions works

✓ Work Order modal works

✓ Work orders update the UI

✓ Sonner toast notifications work

✓ <Toaster /> is mounted in __root.tsx

✓ ConveyorProvider is correctly integrated

✓ src/routes/index.tsx contains the actual dashboard instead of the template placeholder

✓ Route head() metadata is implemented

✓ Simulation states synchronize across the dashboard

✓ Responsive layout works

✓ No additional pages are created

✓ No backend functionality is introduced

✓ No analytics functionality is introduced

✓ No multiple-conveyor functionality is introduced

✓ No unresolved TODOs or placeholder sections remain

✓ The project builds successfully

Finally, after implementation, inspect the entire application once more as a user would and fix any obvious UI/UX inconsistencies, broken interactions, overflow issues or incomplete sections.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d65dd15f-23e4-494d-b1e8-e873f20dc3f1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
