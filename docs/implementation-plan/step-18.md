# Step 18 — Patient Calendar Slot Picker UI

Patient-facing slot picker from `roadmap.md` §Step 18. A patient on a doctor's profile sees a week of available slots, picks one, and advances to Step 2 of the booking flow.

Roadmap acceptance (verbatim): _"Doctor sets 'Tuesday 9:00–12:00, 30-min slots' via API (or Prisma Studio). Patient visits doctor profile and sees six green slot buttons under Tuesday."_

Current code anchors:
- `apps/web/src/components/doctor-profile/BookingCard.tsx` — already exists with `PLACEHOLDER_SLOTS`. Step 18 replaces the placeholder with real data + missing states.
- `apps/web/src/pages/BookingPage.tsx` — placeholder `<h1>Book Appointment</h1>`. May or may not be the Step 2 destination (see questions).

---

## 0. Clarifying questions — please answer before build

Each answer changes component count or placement. The **bolded** option is what §1–§5 below assume.

1. **Where does the picker live?**
   - **(a) Inline on the Doctor Profile page (`DoctorProfilePage` → `BookingCard` sticky sidebar).** Picker + Step 2 confirm happen on the same route; `BookingPage.tsx` is deprecated. _(assumed — matches existing UI; keeps single page context)_
   - (b) Standalone `BookingPage` at `/book/:doctorId`. Doctor profile has a "Prendre RDV" CTA that navigates there; picker is Step 1 inside a multi-step wizard.
   - (c) Both — compact picker on profile (preview), full picker on `/book/:doctorId` (canonical).

2. **What is "Step 2 of booking"?**
   - **(a) A drawer / dialog that opens on slot select — collects reason, appointment type (if doctor supports both), and a "Confirmer" button.** _(assumed)_
   - (b) Navigation to `/book/:doctorId/confirm` with slot encoded in route state.
   - (c) Inline expansion in the sidebar below the grid.

3. **When does the Redis slot lock get acquired?**
   - **(a) On slot selection — before Step 2 opens.** Protects against two patients picking the same slot; lock is released if the patient abandons Step 2 (navigate away, close drawer, TTL expiry). _(assumed — matches spec §2.2 intent)_
   - (b) On Step 2 "Confirmer" only. Simpler; risk: double-selection race inside the 10–60s the second patient spends on Step 2.

4. **Real-time updates (Step 18b WebSocket)**
   - **(a) In scope for Step 18 — picker subscribes to `/availability` and reacts to `slot-locked` / `slot-released` events live.** _(assumed — otherwise slots the user sees as green may be stale by seconds)_
   - (b) Deferred to Step 18b implementation; Step 18 relies on the 30s cache.

5. **Authentication to view slots**
   - **(a) Anonymous patients can view slots; auth is only required to acquire the lock / open Step 2.** _(assumed — SEO + discovery friendly)_
   - (b) Login required before the picker renders.

6. **Appointment type filter**
   - DoctorProfile templates have `appointment_type` in `{ in_person, video, both }`. When a doctor has mixed templates in one week:
   - **(a) Show a single filter (in-person / video / all) at the top of the picker; "all" is default.** _(assumed)_
   - (b) No filter — render everything; let patient choose type in Step 2.

7. **Multi-facility**
   - If a doctor has >1 `DoctorFacility`, the slot picker must scope to one facility.
   - **(a) Render a facility selector above the week grid; default = first facility alphabetically.** _(assumed for completeness; if MVP is single-facility, hide the selector when only one exists.)_
   - (b) Defer — single facility at MVP.

8. **Timezone display**
   - Slots are always GMT+3 (Indian/Antananarivo). Patient's device may be in another zone.
   - **(a) Always display in Antananarivo time; show a small "Heure d'Antananarivo" label if the browser's zone differs.** _(assumed — prevents silent +/-N-hour booking mistakes)_
   - (b) Display in the browser's local zone.

9. **"Next-available-date suggestion" in the empty state**
   - **(a) If no slots this week, the empty state shows "Prochaine disponibilité : mardi 22 avril" as a button that jumps the week strip forward and preselects that date.** _(assumed — matches roadmap bullet literally)_
   - (b) Text-only suggestion without navigation.

10. **Language**
    - **(a) French UI strings (fr-FR).** _(assumed — existing code uses French; Madagascar market)_
    - (b) i18n scaffold with keys now; FR translation default.

11. **Phase 2 multi-booking (max_bookings_per_slot)**
    - Spec allows up to 3 patients per slot in Phase 2. Step 18 UI at MVP:
    - **(a) Treat every slot as binary (available / booked). Ignore `max_bookings_per_slot` in the UI until Phase 2.** _(assumed — matches roadmap §Step 16 "MVP: first overlap removes the slot")_

---

## 1. Scope — what this screen does and does not do

**Does:**
- Render the current week's available slots for one doctor (and one facility, if multi-facility), derived from `GET /api/v1/doctors/:id/availability`.
- Let the patient move week-by-week (prev / next / today).
- Let the patient pick a slot; acquire the lock; open Step 2.
- Reflect live `slot-locked` / `slot-released` events via WebSocket.
- Handle loading, empty, and error states explicitly.

**Does not:**
- Create, confirm, pay, or cancel the appointment (Step 2 owns confirm; downstream steps own the rest).
- Edit doctor schedules (doctor admin, out of scope).
- Show patient identity of who booked a given slot (privacy).
- Support Phase 2 multi-slot booking (max 3).
- Month or day view — roadmap §18 mandates week.

---

## 2. Component tree

```
DoctorProfilePage (existing)
└─ BookingCard                       (existing — refactor, not a new file)
   └─ SlotPicker                     (new — the Step 18 concern)
      ├─ SlotPickerToolbar
      │  ├─ WeekNavigator            (← Today →, with week label "14 – 20 avril")
      │  ├─ FacilitySelector         (hidden if doctor has 1 facility)
      │  ├─ AppointmentTypeFilter    (in-person / vidéo / tous — hidden if doctor offers only one type)
      │  └─ TimezoneNotice           (only rendered if browser TZ ≠ GMT+3)
      ├─ WeekStrip                   (7 day pills; tap selects a day on mobile)
      ├─ SlotGrid                    (desktop: 7 columns; mobile: slots under the day selected in WeekStrip)
      │  └─ SlotButton × N           (green=available, grey=booked/locked, filled=selected)
      │
      ├─ SlotPickerSkeleton          (first load only)
      ├─ SlotPickerEmptyState        (with next-available-date suggestion)
      └─ SlotPickerErrorState        (retry-able)

(opens on slot select, sibling to SlotPicker)
BookingStep2Drawer                   (new — collects reason/type, confirms)
```

`SlotPicker` owns data fetching, the WebSocket, lock acquisition, and week state. Everything below it is presentational. No "god" component per CLAUDE.md.

---

## 3. Component-by-component spec

### 3.1 `SlotPicker` (container — the only stateful node)

**Role.** Data orchestrator. Nothing else.

**Responsibilities.**
- Own `currentWeekStart` (Monday in GMT+3), `selectedDay`, `selectedFacilityId`, `selectedType` filter.
- Query `GET /api/v1/doctors/:id/availability?start_date=&end_date=&facility_id=` for the visible week. Use `AbortController` on week change.
- Subscribe to Socket.io `/availability` for this doctor; apply `slot-locked` / `slot-released` mutations to the slot map. Unsubscribe on unmount or doctorId change.
- On slot select: call `POST /api/v1/appointments/slots/lock` (Step 19 endpoint). On success → open `BookingStep2Drawer` with slot payload. On 409 (slot just got locked by someone else): flash the slot to grey, toast "Ce créneau vient d'être réservé", keep picker open.
- On Step 2 close without confirm → `DELETE /api/v1/appointments/slots/lock` to release, revert slot to green locally.
- Memoize slot-state derivation (`available | booked | locked | selected | past`).

**Props.**
```ts
interface SlotPickerProps {
  doctorId: string;
  doctorFacilities: { id: string; name: string }[];      // from DoctorProfile
  doctorSupportedTypes: ('in_person' | 'video')[];       // derived from templates
  onSlotConfirmed: (appointmentDraft: AppointmentDraft) => void; // fires after Step 2 confirm
}
```

**Edge cases.**
- Anonymous user clicks an available slot → redirect to login with `returnTo` pointing back to the profile (roadmap bullet "slot selection advances to Step 2 of booking" assumes authenticated; guard enforces this).
- Clock skew: `past` derived from slot.startTime vs `Date.now()`; tolerate 60s drift (server is authoritative on past/future via its own check on lock).
- WebSocket fails to connect: keep REST-only mode; show `TimezoneNotice`-style `label-sm` chip "Mises à jour en temps réel indisponibles — actualisez si besoin"; never block the grid.
- Patient moves to a future week beyond the 4-week booking horizon (spec §3): show empty state "Réservation possible jusqu'au {date}" — derive horizon from doctor config.
- Double-click the same slot during in-flight lock request: button must disable while request pending; second click is a no-op.

---

### 3.2 `SlotPickerToolbar`

**Role.** Groups the week nav, facility, type filter, and timezone notice in a single row (wraps to two rows <640px).

No state; stateless row of children. Responsible only for spacing and responsive wrapping. No business logic.

#### 3.2.1 `WeekNavigator`
- Buttons: `←` prev, "Aujourd'hui", `→` next. All `round-full`, `icon-button` size for arrows, text button for "Aujourd'hui".
- Label between arrows: "14 – 20 avril 2026" (`title-md`).
- "Aujourd'hui" visually muted when already on this week.
- Keyboard: `PageUp`/`PageDown` when the picker area is focused.

#### 3.2.2 `FacilitySelector`
- Rendered only if `doctorFacilities.length > 1`.
- Pill-style select (`round-full`, `surface-container-high` fill, no border per DESIGN.md).
- Changing the facility refetches the current week; resets selected day to today if inside range, otherwise Monday of that week.

#### 3.2.3 `AppointmentTypeFilter`
- Segmented control with 2 or 3 pills: `Tous`, `En personne`, `Vidéo`. Only rendered if the doctor supports both.
- Filter is client-side (the availability endpoint already returns both types per Step 17). Changing filter does NOT refetch.
- Selected pill: `primary` fill, `on-primary` text. Unselected: `secondary-container`.

#### 3.2.4 `TimezoneNotice`
- Rendered only if `Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Indian/Antananarivo'`.
- Small `label-sm` chip: "Heures affichées à Antananarivo (GMT+3)".

---

### 3.3 `WeekStrip`

**Role.** Horizontal strip of 7 day pills. On mobile it is the primary day selector; on desktop it is a navigation affordance + scan aid.

**Props.**
```ts
{
  weekDays: Date[];          // 7 entries, Monday…Sunday
  selectedDay: Date;
  slotCounts: Record<string /* ISO date */, number /* available slots */>;
  onSelectDay: (d: Date) => void;
}
```

**Visual.**
- Each pill (`round-full`, 44×56px min to satisfy touch target): weekday abbr on top (`label-md` uppercase +0.05em), day-of-month number below (`title-lg`).
- Badge in bottom-right: number of available slots (`label-sm`) or "•" dot if 0.
- Today: `secondary-fixed` fill.
- Selected day: `primary` fill, `on-primary` text (takes precedence over today).
- Past days within this week (if user is viewing current week): 40% opacity, not focusable.

**Behavior.**
- `Left`/`Right` arrow keys move selection within the strip.
- Swipe left/right on mobile navigates weeks (hands off to `WeekNavigator`'s handlers).

---

### 3.4 `SlotGrid`

**Role.** Render available + booked slots.

**Two layouts, one component:**

- **Mobile (`<768px`):** single-day view — renders only the slots for `selectedDay`. Slots laid out in a 2- or 3-column grid of buttons, sorted by `startTime ASC`, grouped by morning/afternoon/evening with `label-md` dividers (no 1px lines — use `surface-container-low` band).
- **Desktop (`≥768px`):** 7-column CSS grid. Each column has a `DayColumnHeader` (weekday + date, today highlighted) and slots stacked chronologically.

**Props.**
```ts
{
  weekDays: Date[];
  slotsByDay: Record<string, Slot[]>;
  selectedDay: Date;              // used only in mobile layout
  selectedSlotKey: string | null; // startTime ISO of the currently-selected (locked-by-me) slot
  onSelect: (slot: Slot) => void;
}
```

**A11y.**
- Grid root: `role="grid" aria-label="Créneaux disponibles pour le Dr {name}"`.
- Each column: `role="rowgroup" aria-label="Mardi 15 avril, 6 créneaux disponibles"`.
- Each slot: `SlotButton` is a native `<button>` — no custom role.
- Arrow keys: Up/Down move within a column, Left/Right move across columns (skip empty columns).

---

### 3.5 `SlotButton` (atomic)

**Role.** Render one slot and emit `onSelect`.

**Props.**
```ts
{
  slot: { startTime: string; durationMinutes: number; isEmergencyOnly?: boolean; appointmentType: 'in_person' | 'video' };
  state: 'available' | 'booked' | 'locked' | 'selected' | 'past';
  onSelect: () => void;
}
```

**Visual states (all `round-full`, DESIGN.md tokens, no 1px borders):**

| State       | Background                | Text                 | Interactive | aria-label example |
|-------------|---------------------------|----------------------|-------------|--------------------|
| available   | `secondary-fixed`         | `on-secondary-fixed` | yes, button | "09:00, disponible, consultation en personne" |
| booked      | `surface-container-high`  | `on-surface-variant` strikethrough | no (`disabled`) | "09:30, indisponible" |
| locked      | `surface-container-high`  | `on-surface-variant` with subtle pulse | no (`disabled`) | "10:00, réservé par un autre patient" |
| selected    | `primary` (gradient 135°) | `on-primary`         | yes (acts as deselect / keeps Step 2 open) | "10:30, créneau sélectionné" |
| past        | transparent               | `on-surface-variant` 40% | no (`disabled`, not focusable) | skipped by screen reader |

**Contents.**
- Primary: time in 24h (`09:00`), `body-lg` weight 600.
- Secondary (only when `appointmentType` is rendered explicitly via the filter showing "Tous"): small `videocam` or `person` icon before the time so the patient can distinguish at a glance.
- If `isEmergencyOnly`: stack a `label-sm` "Urgence" chip above the time (`error-container` fill).

**Do not:**
- Show the duration inside the button (redundant with column context / filter); put it in the aria-label and in the Step 2 drawer header.
- Animate hover on all states; pulse is reserved for `locked`, gradient shimmer for `selected`.

---

### 3.6 `SlotPickerSkeleton`

**Role.** Occupy the picker footprint on first fetch only. On subsequent week changes keep the old grid visible and show a thin top-of-toolbar progress bar instead (prevents flicker).

- Renders `WeekStrip` skeleton (7 shimmer pills) and `SlotGrid` skeleton (24 shimmer slot pills arranged as a week).
- `aria-busy="true" aria-label="Chargement des créneaux"`.

---

### 3.7 `SlotPickerEmptyState`

**Role.** Handle "zero available slots" with a navigable next-step.

**Triggers (mutually exclusive).**
- Current week has 0 available slots, but the doctor has availability later this month → render a card: _"Aucun créneau disponible cette semaine. Prochaine disponibilité : mardi 22 avril à 09:00."_ with a `primary` pill "Voir cette date" that jumps to that week and preselects that day.
- Doctor has 0 availability in the next 4 weeks → render: _"Ce médecin n'a pas de créneaux disponibles pour le moment. Vous pouvez l'enregistrer pour être notifié."_ + a secondary "M'avertir" action. _(Notification-on-availability is out of scope for Step 18 — keep the button but stub the handler and flag in Phase 2.)_
- Doctor is on vacation (all 4 weeks blocked by `day_off`) → same as above.

**Data.** The "next available date" must come from the backend. If `GET /api/v1/doctors/:id/availability/next` does not exist yet, the empty state falls back to text-only until it does. Note this as a backend gap (see §6).

**Visual.** `surface-container-lowest` card centered in the grid area. No illustration at MVP (DESIGN.md "editorial, layered" direction without stock art).

---

### 3.8 `SlotPickerErrorState`

**Role.** Graceful failure with retry.

- Message: "Impossible de charger les créneaux. Vérifiez votre connexion."
- "Réessayer" button re-triggers the availability query for the current week.
- Never surface the raw error (log to Sentry in the container).
- Replaces the grid area only — toolbar + week strip remain interactive so the patient can try another week.

---

### 3.9 `BookingStep2Drawer` (opens on select; sibling to SlotPicker)

Out of this step's implementation but its props must be defined because the picker opens it.

**Props (contract only).**
```ts
{
  open: boolean;
  slot: { startTime: string; durationMinutes: number; appointmentType: 'in_person' | 'video' };
  doctor: { id: string; name: string; facilityName?: string };
  lockToken: string;                       // returned by the lock endpoint; echoed on confirm
  onConfirm: (payload: { reasonText: string; type: 'in_person' | 'video' }) => Promise<void>;
  onClose: () => void;                     // releases the lock and reverts the picker slot
}
```

The drawer itself (fields, validation, submit) is a separate step. Step 18 only commits to the prop contract and to invoking open/close + lock-release correctly.

---

## 4. Data and events

### 4.1 API calls (Step 18 introduces)

| Verb | Path | When |
|------|------|------|
| GET | `/api/v1/doctors/:id/availability?start_date&end_date&facility_id` | On mount, on week change, on facility change |
| POST | `/api/v1/appointments/slots/lock` | On slot select (Step 19 endpoint — coordinate) |
| DELETE | `/api/v1/appointments/slots/lock` | On Step 2 close without confirm, on picker unmount with active lock |
| GET | `/api/v1/doctors/:id/availability/next` _(proposed)_ | Only for the empty state suggestion — see §6 |

### 4.2 WebSocket (Step 18b contract)

- Connect to `/availability` namespace with `withCredentials: true`.
- `emit('watch-doctor', { doctorId })` on mount; `emit('unwatch-doctor', { doctorId })` on unmount.
- `on('slot-locked', { slotTime })` → set slot state to `locked`.
- `on('slot-released', { slotTime })` → set slot state back to `available` **only** if still in this week and still classified as `locked` in memory (avoid undoing a real booking).
- Reconnect with exponential backoff on disconnect; on reconnect, refetch the current week to reconcile state.

### 4.3 Lock lifecycle (critical interaction with Step 19)

1. Patient clicks a green `SlotButton`.
2. Picker calls `POST /slots/lock` → success → server returns `{ lockToken, ttlSeconds }`.
3. Picker sets slot state to `selected` locally (primary-fill pill) and opens `BookingStep2Drawer` with the lockToken.
4. If drawer closes without confirm → `DELETE /slots/lock` with the lockToken. Slot reverts to `available`.
5. If drawer confirms → `onSlotConfirmed(draft)` fires; the picker considers itself "done" (Step 2 owns the appointment creation flow, which consumes the lock).
6. If the lock TTL expires while the drawer is open → drawer surfaces "Votre créneau a expiré, reprenez une sélection" and closes; picker does NOT auto-release (already expired server-side).

### 4.4 Caching quirk (cache TTL = 30s, per §Step 17)

- The REST response may be up to 30s stale. The WebSocket bridges that window.
- When the WebSocket is unavailable, the toolbar chip surfaces the stale risk: _"Mises à jour en temps réel indisponibles — actualisez si besoin."_
- Never auto-poll — an auto-refresh every 30s thunders herd on the cache and defeats it.

---

## 5. Expected UI behaviour (acceptance-level)

1. **Roadmap acceptance (verbatim).** Doctor template "Tuesday 9:00–12:00, 30-min slots", no exceptions, no existing appointments. Patient visits `/doctors/:id`. `SlotPicker` mounts, fetches the current week, Tuesday column shows **six** green pills: `09:00`, `09:30`, `10:00`, `10:30`, `11:00`, `11:30`. Other weekdays' columns are empty.

2. **Booked slot is visibly unavailable.** Another patient has an appointment at 10:00. The 10:00 pill renders as `booked` state (grey, strikethrough, disabled, aria-label "indisponible"). Patient cannot tab to it.

3. **Loading skeleton.** On first mount the picker renders `SlotPickerSkeleton` with shimmer until the availability response arrives. On week change the skeleton does NOT re-render; a thin toolbar progress bar shows for the in-flight fetch instead.

4. **Empty state with next-available suggestion.** Doctor has 0 slots this week, 5 slots next Tuesday. The empty card reads: _"Aucun créneau disponible cette semaine. Prochaine disponibilité : mardi 22 avril à 09:00."_ with a "Voir cette date" button. Clicking the button moves the week strip forward one week and preselects Tuesday.

5. **Slot selection advances to Step 2.** Patient taps `09:30`. Picker calls `POST /slots/lock`. On 200, `09:30` pill turns `primary` (selected), `BookingStep2Drawer` opens with the slot data and lockToken. The rest of the grid remains visible (and read-only) behind the drawer.

6. **Conflict on select (409).** Patient taps `09:30` but another patient just locked it 500ms earlier. Server returns 409. Picker flashes `09:30` to `locked` state, shows a toast: _"Ce créneau vient d'être sélectionné par un autre patient. Choisissez-en un autre."_ Drawer does not open.

7. **Abandoning Step 2 releases the lock.** Patient closes the drawer. Picker calls `DELETE /slots/lock` with the lockToken; `09:30` reverts to `available` green pill. The revert is optimistic — it applies immediately client-side; if the delete fails, no user-visible action (server TTL cleans up).

8. **Lock TTL expires.** Patient lingers on Step 2 beyond the lock TTL. Drawer shows expiry message, closes, and picker reverts the pill. If in the meantime someone else locked that slot, the WebSocket will have already marked it locked — the revert becomes a no-op.

9. **Live `slot-locked` event.** Another patient, other tab, picks 11:00. Within ≤1s the 11:00 pill here turns `locked` with a subtle pulse. Hovering the pill reveals "Réservé par un autre patient".

10. **Live `slot-released` event.** The other patient abandons. 11:00 pill pulses back to `available` green within ≤1s.

11. **Appointment type filter.** Doctor offers both in-person and video. Patient toggles the filter to `Vidéo`. The grid filters to video slots only — counts on the `WeekStrip` update. No network call.

12. **Facility selector.** Doctor practices at two facilities with different hours. Changing the facility pill refetches the week; the week strip counts update; any previously selected slot is cleared (and its lock released, if held).

13. **Timezone notice.** Patient's browser is set to `Europe/Paris`. `TimezoneNotice` renders the "Heures affichées à Antananarivo (GMT+3)" chip. Patient in `Indian/Antananarivo` does not see the chip.

14. **Past slots.** A slot earlier today at 08:00 is rendered at 40% opacity, not tabbable, skipped by screen reader, non-clickable. No cursor change on hover.

15. **Emergency-only day.** Doctor has a `custom_hours` OR `emergency_only` exception on Thursday. Thursday's slots display the "Urgence" chip above the time. State is still `available` unless booked; the label is only a notice — lock + Step 2 proceed as usual.

16. **WebSocket offline.** Socket.io fails to connect. Toolbar shows the stale-risk chip. Grid still renders from REST; patient can still pick a slot. 409 conflict recovery (see #6) is the safety net.

17. **Anonymous patient taps a slot.** Not logged in. Tap triggers a redirect to `/login?returnTo=/doctors/:id`. After login, patient returns to the profile and picker restores the previously-viewed week (via query string `?week=YYYY-MM-DD`). No lock is acquired until the patient re-taps.

18. **Keyboard.**
    - Tab enters the picker at the toolbar (prev-week button).
    - Within the grid, arrow keys move between slots, `Enter`/`Space` selects.
    - `PageUp`/`PageDown` move weeks; `T` returns to today.
    - Focus ring uses `primary` outline at full contrast (DESIGN.md: `outline-variant` with 20% opacity is for static forms, not focus).

19. **Screen reader.** Mounting the grid announces "Créneaux disponibles pour le Dr Rakoto, semaine du 14 avril. Lundi 14 avril, aucun créneau. Mardi 15 avril, 6 créneaux disponibles à partir de 9 heures." Selecting a slot announces "Créneau sélectionné, 9 heures 30, ouverture du formulaire de confirmation."

20. **Responsive.**
    - `320–767px`: single-column-per-day view driven by `WeekStrip` selection; day header sticky under toolbar.
    - `768–1023px`: 7 columns, slots 2-per-column width.
    - `≥1024px`: 7 columns, slot pills comfortable, picker width fits within the existing sticky `BookingCard`.

21. **Booking horizon.** Patient tries to navigate to week N+5 when doctor horizon is 4 weeks. Empty state shows "Réservation possible jusqu'au {date}" — next/prev buttons still navigate freely; only content is empty.

22. **No flash of "no slots" on week change.** The previous grid stays on screen until the new week arrives; only the week label and progress bar update. This prevents a 200ms flash of empty state that would read as a bug.

---

## 6. Backend gaps to confirm / open

Flag these to backend before / during Step 18 build:

1. **`GET /doctors/:id/availability/next`** — required by §3.7 to show "Prochaine disponibilité : ...". If this endpoint does not yet exist, accept a text-only empty state until Phase 3 adds it, or derive client-side by fetching 4 weeks ahead (costly — prefer server endpoint).

2. **Lock endpoint contract** — §4.3 assumes `POST /appointments/slots/lock` returns `{ lockToken, ttlSeconds }` and `DELETE /appointments/slots/lock` accepts `{ lockToken }`. Confirm names match Step 19's actual signature before wiring.

3. **409 semantics** — confirm the lock endpoint returns **409** (not 400 or 422) when the slot is already locked or booked. The UI discriminates on status code.

4. **`watch-doctor` self-subscription** — confirm `/availability` gateway accepts an anonymous or authenticated patient subscribing to any doctor's room without leaking PII (it emits only `slotTime`, so by construction no PII leaks — double-check no future expansion adds patient fields to these events).

5. **Slot `appointmentType`** — the availability endpoint must return `appointmentType` on each slot so the client-side filter works without a re-fetch. Confirm the Step 17 response shape includes it.

6. **Emergency-only flag** — confirm `isEmergencyOnly` surfaces on the slot payload (Step 16 sets it in the algorithm; §17 must echo it).

7. **Booking horizon** — confirm how the client knows the doctor's booking horizon (weeks) to render the "jusqu'au X" message — either on DoctorProfile or on availability meta.

---

## 7. Design token checklist (per `DESIGN.md`)

- All slot buttons, filter pills, facility selector, nav buttons → `round-full`. No 1px borders anywhere.
- Available slots use `secondary-fixed` (soft blue), not green — DESIGN.md system color. Roadmap wording "green buttons" is illustrative; tokens win.
- Selected slot uses the `primary → primary-container` 135° gradient defined in DESIGN.md §2.
- Past slot opacity: 40%, `on-surface-variant` text — never pure grey, never strike-through (strike-through is for `booked`).
- Empty/error cards: `surface-container-lowest` floating on `surface-container-low` band. No drop shadow. "No-Line" rule.
- Headings: picker section header "Choisir un créneau" uses `title-lg` with `spacing-8` top margin.
- Labels on the week strip ("LUN") use `label-md` uppercase with `+0.05em` tracking.
- Focus ring: `primary` outline at 2px, offset 2px. Full contrast — this is the one place DESIGN.md's "ghost border" rule does not apply.

---

## 8. Out of scope for this step (intentional)

To match the user's "nothing else" instruction, the following are deferred:

- Month view; day-only view as a patient preference.
- In-picker doctor switching.
- Filtering by price or insurance.
- Waitlist sign-up (the "M'avertir" button in the empty state is stubbed).
- Prefetching adjacent weeks.
- Saved "favorite time" preferences.
- Any state inside Step 2 beyond the prop contract in §3.9.

If any of the above is actually in MVP scope, it must be added to §0 and this spec re-scoped before implementation.
