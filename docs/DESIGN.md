# Design System Strategy: e-tady dokotera

## 1. Overview & Creative North Star: "The Healing Horizon"
The healthcare landscape in Madagascar requires a digital experience that bridges the gap between clinical authority and human accessibility. Our Creative North Star is **"The Healing Horizon."**

Unlike traditional medical portals that feel sterile and rigid, this design system utilizes an editorial, layered approach. We break the "template" look by favoring **organic breathing room** and **tonal depth** over hard lines. By utilizing the `ROUND_FULL` (9999px) philosophy across all interactive elements, we eliminate the "sharpness" of medical anxiety, replacing it with a fluid, approachable interface that feels like a premium concierge service.

---

### 2. Colors: Tonal Depth & The "No-Line" Rule
We move away from the "boxed-in" web. We use the color palette to define space, not borders.

* **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Use background shifts (e.g., a `surface-container-low` card resting on a `surface` background) to define boundaries.
* **Surface Hierarchy:**
* **Level 0 (Base):** `surface` (#f8f9ff) for the main canvas.
* **Level 1 (Sections):** `surface-container-low` (#f2f3f9) to group secondary information.
* **Level 2 (Cards/Prompts):** `surface-container-lowest` (#ffffff) to make critical patient data "pop" with natural light.
* **The Glass & Gradient Rule:** For hero sections and primary call-to-actions, use a subtle linear gradient: `primary-container` (#1b6ca8) to `primary` (#005387) at a 135° angle. This adds "soul" and professional weight that flat hex codes lack.
* **Signature Glassmorphism:** For floating navigation or modal overlays, use `surface` at 80% opacity with a `20px` backdrop-blur. This ensures the clinician never loses context of the background patient record.

---

### 3. Typography: Authoritative Softness
We use **Open Sans** exclusively, but we treat it with editorial intent. The goal is "Professionalism without the Edge."

* **Display & Headline (The Professional Voice):** Use `display-md` and `headline-lg` for welcome messages and doctor names. Ensure a `-0.02em` letter-spacing to tighten the professional feel.
* **Title (The Navigator):** `title-lg` should be used for section headers. In this system, titles are never underlined; they are given "air" (at least `spacing-8` of top margin).
* **Body (The Patient Advocate):** `body-lg` is our workhorse. We prioritize readability by using `on-surface-variant` (#414750) for long-form medical instructions to reduce eye strain compared to pure black.
* **Labels (The Detailer):** Use `label-md` in all-caps with `+0.05em` letter-spacing for metadata like "Specialty" or "Availability" to create a high-end, organized look.

---

### 4. Elevation & Depth: Tonal Layering
We reject the "drop shadow" of the 2010s. We define depth through light and stacking.

* **The Layering Principle:** To highlight a doctor’s profile, place a `surface-container-lowest` (#ffffff) container on top of a `surface-container` (#eceef3) background. The contrast is the "border."
* **Ambient Shadows:** If an element must float (like a "Book Now" FAB), use a shadow tinted with our primary color: `rgba(0, 83, 135, 0.08)` with a `32px` blur and `12px` Y-offset. This mimics natural light passing through a professional medical environment.
* **The "Ghost Border" Fallback:** If a border is required for accessibility in forms, use `outline-variant` (#c0c7d1) at **20% opacity**. It should be felt, not seen.

---

### 5. Components: Fluidity in Action

* **Buttons (The Signature Pill):** All buttons use `round-full`.
* *Primary:* `primary` background with `on-primary` text. Use the subtle gradient mentioned in Section 2.
* *Secondary:* `secondary-container` background. No border.
* **Input Fields:** Never use a bottom-line-only style. Use a `surface-container-high` (#e6e8ed) fill with `round-full` corners. Ensure the padding is generous (`spacing-4` horizontal) to feel premium.
* **Cards (No-Divider Rule):** For medical listings, do not use lines to separate "Price," "Location," and "Time." Use vertical white space (`spacing-4`) and `label-sm` typography to create clear visual buckets.
* **Chips:** Use `secondary-fixed` (#c3e8ff) for "Available Today" status. It provides a soft, "light-blue accent" that signifies calmness and hope.
* **Doctor Profile Cards:** Use an asymmetrical layout. Place the doctor’s image in a `round-full` container overlapping the edge of the card to break the grid and add a custom, high-end feel.

---

### 6. Do's and Don'ts

#### Do:
* **Do** use `spacing-12` and `spacing-16` for page margins. Luxury is defined by the space you *don't* use.
* **Do** use `ROUND_FULL` for everything—from avatars to text inputs to buttons. Consistency creates trust.
* **Do** use color shifts to guide the eye. A user’s gaze should flow from the darkest `primary` element to the lightest `surface`.

#### Don't:
* **Don't** use 1px solid grey lines. It makes the platform feel like a spreadsheet, which causes clinician burnout.
* **Don't** use "pure black" (#000000) for text. It is too harsh against the soft blues. Use `on-surface` (#191c20).
* **Don't** use sharp corners. If an image is used, it must have at least `round-lg` (2rem) or `round-full`.

---

### Director’s Final Note to Juniors
In healthcare, especially in a vibrant context like Madagascar, our design must feel as reliable as a doctor's oath but as warm as a community greeting. This system isn't about boxes; it's about **surfaces and light**. Treat every screen like a high-end editorial layout—balanced, spacious, and undeniably professional.