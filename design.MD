You are a senior UI/UX designer tasked with scaffolding the initial design system 
and key screens for a healthcare appointment booking platform called "Dokita" 
targeting Madagascar. The platform is inspired by Doctolib but adapted for the 
Malagasy market (mobile-first, low-bandwidth, bilingual French/Malagasy).

═══════════════════════════════════════════
PRODUCT CONTEXT
═══════════════════════════════════════════

Platform name: Dokita (from "Dokotera" = Doctor in Malagasy)
Primary language: French (UI), with Malagasy labels on key CTAs
Secondary language: Malagasy
Target devices: Android mobile (primary), iOS, Desktop (secondary)
Connectivity: Design for 3G-first. No heavy animations, no auto-play video.
Users: 
  - Patients (urban + rural Madagascar, ages 18–65, varying digital literacy)
  - Doctors / Healthcare professionals (private clinics, hospitals)
Currency: Ariary (Ar) — e.g., "25 000 Ar"
Date format: DD/MM/YYYY
Time format: 24h (e.g., 14h30)

═══════════════════════════════════════════
DESIGN SYSTEM
═══════════════════════════════════════════

Design style:
- Clean, trustworthy, medical-grade but warm and approachable
- NOT sterile/cold hospital white — use warmth to build trust in a market 
  with low digital healthcare adoption
- Inspired by: Doctolib (structure), Alan (warmth), Qonto (clarity)

Color palette:
- Primary:       #1B6CA8  (deep trustworthy blue)
- Primary light: #E8F4FD  (blue tint for backgrounds)
- Secondary:     #27AE60  (green = availability, confirmation, health)
- Accent:        #F39C12  (amber = warnings, pending states)
- Danger:        #E74C3C  (red = cancellation, errors)
- Neutral 900:   #1A1A2E  (primary text)
- Neutral 600:   #6B7280  (secondary text)
- Neutral 200:   #E5E7EB  (borders, dividers)
- Neutral 50:    #F9FAFB  (page backgrounds)
- White:         #FFFFFF  (card backgrounds)

Typography:
- Font family: Inter (fallback: system-ui)
- Heading 1: 28px / 700 weight / line-height 1.3
- Heading 2: 22px / 600 weight / line-height 1.4
- Heading 3: 18px / 600 weight / line-height 1.4
- Body:      16px / 400 weight / line-height 1.6
- Small:     14px / 400 weight / line-height 1.5
- Caption:   12px / 400 weight / line-height 1.4

Spacing scale (8px base):
- 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px

Border radius:
- Cards: 12px
- Buttons: 8px
- Inputs: 8px
- Badges/chips: 999px (pill)
- Avatars: 50%

Shadows:
- Card shadow: 0 2px 8px rgba(0,0,0,0.08)
- Modal shadow: 0 8px 32px rgba(0,0,0,0.16)

Iconography: Use Lucide Icons (stroke style, 20px default size)

Touch targets: Minimum 48x48px for all interactive elements (mobile)

═══════════════════════════════════════════
COMPONENT LIBRARY — DEFINE THESE FIRST
═══════════════════════════════════════════

Build these base components before screens:

1. BUTTONS
   - Primary: bg=#1B6CA8, text=white, hover darken 10%, 
     full-width on mobile
   - Secondary: border=#1B6CA8, text=#1B6CA8, bg=transparent
   - Danger: bg=#E74C3C, text=white
   - Ghost: no border, text=#1B6CA8
   - Disabled: bg=#E5E7EB, text=#9CA3AF, cursor not-allowed
   - Loading state: spinner inside button, text hidden
   - Sizes: sm (36px height), md (44px), lg (52px)

2. FORM INPUTS
   - Default: border=#E5E7EB, bg=white, radius=8px, height=48px
   - Focus: border=#1B6CA8, box-shadow 0 0 0 3px #E8F4FD
   - Error: border=#E74C3C, error message in red below
   - With icon: left-padding 44px, icon at 16px from left
   - Phone input: flag + country code prefix (+261 🇲🇬)
   - Search input: magnifier icon left, clear X button right

3. CARDS
   - Doctor card (list view): horizontal layout, avatar left,
     name + specialty + rating + next slot right, chevron far right
   - Doctor card (grid view): vertical, avatar top, info below
   - Appointment card: colored left border by status, 
     doctor name, date/time, location, action buttons

4. BADGES / STATUS CHIPS
   - Disponible (Available): bg=#E8F6F0, text=#27AE60
   - Confirmé (Confirmed): bg=#E8F4FD, text=#1B6CA8  
   - En attente (Pending): bg=#FEF3CD, text=#F39C12
   - Annulé (Cancelled): bg=#FDECEA, text=#E74C3C
   - Terminé (Completed): bg=#F3F4F6, text=#6B7280
   - Urgence (Emergency): bg=#E74C3C, text=white

5. AVATAR COMPONENT
   - Sizes: sm (32px), md (48px), lg (64px), xl (96px)
   - States: photo, initials fallback (white text on #1B6CA8 bg), 
     loading skeleton
   - Doctor variant: add small verified badge (✓) bottom-right

6. RATING COMPONENT
   - Stars: filled=#F39C12, empty=#E5E7EB
   - Show numeric rating + review count: "4.8 (127 avis)"

7. TIME SLOT SELECTOR
   - Grid of pill buttons: available=outlined blue, 
     selected=filled blue, unavailable=gray strikethrough
   - Group by morning (Matin), afternoon (Après-midi), 
     evening (Soir) with collapsible sections

8. BOTTOM NAVIGATION BAR (mobile)
   - 4 tabs: Accueil (home), Recherche (search), 
     Rendez-vous (calendar), Profil (user)
   - Active: filled icon + label in #1B6CA8
   - Inactive: stroke icon + label in #6B7280
   - Badge on Rendez-vous tab for upcoming count

9. SKELETON LOADERS
   - Doctor card skeleton: gray animated shimmer
   - Match exact dimensions of real content
   - Use for all async data loading states

10. EMPTY STATES
    - Illustration + heading + subtext + CTA button
    - Variants: no search results, no appointments, 
      no notifications, no internet connection

═══════════════════════════════════════════
SCREENS TO SCAFFOLD — PATIENT FLOW
═══════════════════════════════════════════

--- SCREEN 1: ONBOARDING / SPLASH ---
- App logo (Dokita wordmark + stethoscope icon)
- Tagline in French: "Votre santé, simplifiée"
  Tagline in Malagasy: "Ny fahasalamanao, azo atao mora"
- 3 onboarding slides (swipeable):
  Slide 1: "Trouvez un médecin" + doctor search illustration
  Slide 2: "Réservez en 3 clics" + calendar illustration  
  Slide 3: "Consultez à distance" + video call illustration
- Progress dots indicator
- "Commencer" CTA button (primary, full-width)
- "J'ai déjà un compte" text link below

--- SCREEN 2: PHONE AUTHENTICATION ---
- Back arrow top left
- Title: "Connexion / Inscription"
- Subtitle: "Entrez votre numéro pour continuer"
- Phone number input with +261 🇲🇬 prefix
  Placeholder: "034 00 000 00"
- NOTE: Madagascar operators are 032 (Orange), 033 (Airtel), 
  034 (Telma) — show operator logo when prefix typed
- "Recevoir le code SMS" primary button
- Small text: "Un code à 6 chiffres vous sera envoyé"
- Divider "ou"
- "Continuer avec Google" secondary button

--- SCREEN 3: OTP VERIFICATION ---
- Back arrow
- Title: "Code de vérification"
- Subtitle: "Code envoyé au +261 34 XX XXX XX"
  with "Modifier" link inline
- 6 individual digit input boxes (large, centered)
  Active box: blue border + cursor
  Filled box: dark text, light blue bg
- Auto-advance on digit entry
- Countdown timer: "Renvoyer le code dans 00:45"
  After 0: "Renvoyer le code" clickable link in blue
- Error state: boxes turn red + "Code incorrect" message

--- SCREEN 4: HOME / DASHBOARD (Patient) ---
Layout: Scrollable feed, sticky top bar

TOP BAR:
- Left: "Bonjour, [Prénom] 👋" greeting
- Right: notification bell icon (with red dot if unread)
         + avatar (32px)

LOCATION BANNER:
- Map pin icon + "Antananarivo, Analamanga"
- Small "Changer" link in blue

SEARCH BAR (prominent, not full search):
- Placeholder: "Médecin, spécialité, clinique..."
- Magnifier icon left
- Tappable — navigates to Search screen

QUICK SPECIALTY GRID (horizontal scroll, 2 rows):
- Icon chips for top 8 specialties:
  🩺 Généraliste | 🫀 Cardiologue | 👶 Pédiatre
  🦷 Dentiste | 👁 Ophtalmologue | 🧠 Neurologue  
  🤰 Gynécologue | 🦴 Orthopédiste
- Each chip: icon + label, pill shape, outlined

UPCOMING APPOINTMENT CARD:
- Title: "Prochain rendez-vous"
- Card: doctor avatar, name, specialty, date/time formatted as
  "Demain à 10h30" or "Mar. 20 Fév. à 14h00"
- Location / "Vidéo" badge
- Two buttons: "Annuler" (ghost) and "Voir détails" (primary)
- If no appointment: empty state card with 
  "Aucun rendez-vous à venir" + "Prendre un RDV" button

NEARBY DOCTORS SECTION:
- Title: "Médecins près de vous" + "Voir tout" link right
- Horizontal scroll of Doctor Cards (list variant)
- Show distance badge: "1.2 km"

RECENT DOCTORS SECTION:
- Title: "Vos médecins" (recently seen)
- Horizontal scroll of avatar + name + specialty

BOTTOM NAV BAR (sticky)

--- SCREEN 5: SEARCH RESULTS ---
Layout: Filter bar + results list

TOP BAR:
- Back arrow
- Search input (pre-filled, editable)
- Filter icon button (shows active filter count badge)

FILTER CHIPS ROW (horizontal scroll, below search bar):
- "Aujourd'hui" | "Cette semaine" | "Vidéo" | "< 5 km" 
  | "Moins de 20 000 Ar"
- Active filters: filled blue chip with X to remove
- Inactive: outlined gray chip

RESULTS HEADER:
- "47 médecins trouvés" in gray
- Sort dropdown: "Pertinence ▾" 
  Options: Pertinence, Distance, Disponibilité, Note

RESULTS LIST:
- Doctor cards (list view), each showing:
  - Avatar with verified badge
  - Full name + specialty
  - Star rating + review count
  - Distance from user
  - Consultation fee: "25 000 Ar"
  - Next available slot badge: "Disponible demain 14h00"
    colored green if today/tomorrow, blue if later
  - "Prendre RDV" button (small, right-aligned)
- Separator between cards

FILTER BOTTOM SHEET (triggered by filter icon):
- Drag handle at top
- Sections with clear headers:
  SPÉCIALITÉ: multi-select chips
  DISPONIBILITÉ: radio (Aujourd'hui / Cette semaine / 
    Cette semaine / Choisir une date + date picker)
  TYPE DE CONSULTATION: 
    checkboxes (Présentiel / Vidéo / Domicile)
  DISTANCE: slider 1km–50km, current value shown
  TARIF MAX: slider 0–100 000 Ar
  LANGUE: checkboxes (Français / Malgache / Anglais)
  GENRE MÉDECIN: radio (Tous / Homme / Femme)
- Sticky bottom: "Réinitialiser" ghost + 
  "Voir 47 résultats" primary button

--- SCREEN 6: DOCTOR PROFILE ---
Layout: Collapsible header + tabbed content

HEADER (collapsible on scroll):
- Full-width doctor photo (200px height) with gradient overlay
- Overlaid on bottom of photo: name, specialty, rating
- Verified badge inline with name
- Back arrow top-left (always visible)
- Share icon top-right

STICKY QUICK INFO BAR (appears when header collapses):
- Small avatar + name + "Prendre RDV" button

PROFILE BODY:

INFO SECTION:
- Consultation fee: "25 000 Ar / consultation"
- Languages: 🇫🇷 Français · 🇲🇬 Malgache
- Experience: "12 ans d'expérience"
- Accepts new patients: green dot + "Accepte nouveaux patients"
- Consultation types: icon row 
  (🏥 Présentiel · 📹 Vidéo · 🏠 Domicile)

TABS: Infos | Disponibilités | Avis

TAB — INFOS:
- About section (expandable text, "Lire plus" if > 3 lines)
- Education: timeline list (degree, institution, year)
- Certifications: tag chips
- Facilities: card(s) with clinic name, address, map preview,
  hours per day of week
  
TAB — DISPONIBILITÉS:
- Week selector: horizontal scroll of day pills
  Format: "Lun 18" / "Mar 19" etc.
  Today underlined, selected = filled blue
- Time slot grid grouped by:
  🌅 Matin (8h–12h)
  ☀️ Après-midi (12h–18h)  
  🌙 Soir (18h–20h)
- Each slot: pill button, available=outlined blue, 
  taken=gray strikethrough text
- "Aucune disponibilité ce jour" with next available date link
- "Voir plus de créneaux" expandable

TAB — AVIS:
- Average rating large display: "4.8 ★" 
- Rating breakdown bars (5★ to 1★, percentage fill)
- Total: "sur 127 avis vérifiés"
- Individual reviews: avatar, name (anonymized: "Patient A."),
  stars, date, comment text (expandable)
- "Charger plus d'avis" button

STICKY BOTTOM CTA:
- "Prendre un rendez-vous" primary button full-width

--- SCREEN 7: BOOKING FLOW (3-step) ---

STEP 1/3 — SELECT SLOT:
- Progress bar: 3 dots, step 1 filled
- Title: "Choisissez un créneau"
- Doctor mini-card at top (non-interactive summary)
- Consultation type toggle: 
  [🏥 Présentiel] [📹 Vidéo] [🏠 Domicile]
- Calendar month view:
  - Dates with availability: regular blue text
  - Dates fully booked: gray, not tappable
  - Selected date: filled blue circle
  - Today: underlined
- Time slot grid for selected date (as described above)
- "Suivant →" primary button (disabled until slot selected)

STEP 2/3 — PATIENT DETAILS:
- Progress bar: step 2 filled
- Title: "Informations patient"
- If logged in: pre-filled form with edit capability
- Fields (all 48px height inputs):
  - Prénom * 
  - Nom *
  - Date de naissance * (date picker, DD/MM/YYYY)
  - Téléphone * (pre-filled if logged in)
  - Email (optionnel)
  - Motif de consultation * (dropdown:
    Consultation générale / Suivi / Urgence / 
    Résultats d'analyses / Autre)
  - Première visite ? toggle switch
  - Notes pour le médecin (textarea, 150 chars max,
    placeholder: "Symptômes, questions, allergies connues...")
- "← Retour" ghost + "Suivant →" primary 

STEP 3/3 — CONFIRMATION:
- Progress bar: step 3 filled
- Title: "Confirmation"
- Summary card (read-only, bordered):
  - Doctor: avatar + name + specialty
  - Date & heure: formatted full date
  - Type: icon + label
  - Lieu: clinic name + address (or "Vidéo" with link)
  - Durée: "30 minutes"
  - Tarif: "25 000 Ar" + "(à régler sur place)" note
- Patient summary: name, phone, motif
- Checkbox: "J'accepte les conditions d'utilisation 
  et la politique de confidentialité" (required)
- Reminder info box (blue bg): 
  ℹ️ "Vous recevrez un rappel SMS 24h et 2h avant votre RDV"
- "Confirmer le rendez-vous" primary button full-width
- "← Modifier" ghost button

--- SCREEN 8: BOOKING SUCCESS ---
- Large animated checkmark (green circle, checkmark draws in)
  Keep animation under 600ms, CSS only (no heavy library)
- "Rendez-vous confirmé !" heading
- Reference number: "Réf: DKT-2026-00847" 
  (monospace font, copyable with tap)
- Summary recap (compact): doctor, date, location
- Two action buttons stacked:
  Primary: "Ajouter au calendrier"
  Secondary: "Voir mes rendez-vous"
- Text link: "Retour à l'accueil"
- SMS notice: "📱 Un SMS de confirmation a été envoyé 
  au +261 34 XX XXX XX"

═══════════════════════════════════════════
SCREENS TO SCAFFOLD — DOCTOR FLOW
═══════════════════════════════════════════

--- SCREEN 9: DOCTOR DASHBOARD ---
Layout: Desktop-first (doctors manage on desktop/tablet)
        but must be responsive to mobile

TOP NAV (desktop):
- Logo left
- Nav links: Agenda | Patients | Analytique | Paramètres
- Right: notification bell + "Dr. [Nom]" avatar dropdown

TODAY'S SUMMARY BAR (full-width):
- 4 stat cards in a row:
  "8 RDV aujourd'hui" | "2 à confirmer" | 
  "1 absence" | "4.8 ★ Note"
  Each with relevant icon and color coding

TODAY'S AGENDA (main content, left 65%):
- Date header: "Mercredi 18 Février 2026" with nav arrows
- Timeline view (hourly rows 8h–20h):
  - Booked slots: colored cards with 
    patient name, motif, type badge (Présentiel/Vidéo)
  - Available slots: light dashed border, 
    "+ Créneau libre" ghost text, clickable
  - Current time: red horizontal line across timeline
  - Blocked time: gray diagonal stripe pattern

UPCOMING APPOINTMENTS SIDEBAR (right 35%):
- "Prochain patient" card:
  Patient avatar, name, age, motif, 
  "Dans 25 minutes" countdown, 
  "Démarrer la consultation" primary button
- List of remaining day's appointments (compact)
- "Voir l'agenda complet" link

QUICK ACTIONS FLOATING BUTTON (bottom right):
- "+" FAB, expands to:
  "Bloquer un créneau" | "RDV d'urgence" | 
  "Envoyer un rappel"

--- SCREEN 10: CALENDAR MANAGEMENT ---
- Full calendar view (month/week/day toggle top right)
- Color legend:
  🟢 Disponible  🔵 Réservé  🟡 En attente  ⬜ Bloqué
- Week view default:
  - Columns per day, rows per hour
  - Drag-to-create availability slots
  - Click existing slot to edit/delete
- Availability setup modal (triggered by clicking empty slot):
  - Start time / End time pickers
  - Repeat: Jamais / Chaque semaine / Personnalisé
  - Type: Présentiel / Vidéo / Les deux
  - Max patients per slot: number input
  - "Sauvegarder" + "Annuler"
- Bulk block modal:
  - Date range picker
  - Reason: Vacances / Formation / Maladie / Autre
  - "Bloquer ces dates"

═══════════════════════════════════════════
SCREENS TO SCAFFOLD — VIDEO CONSULTATION
═══════════════════════════════════════════

--- SCREEN 11: WAITING ROOM (Patient) ---
- Clean centered layout, white bg
- Doctor avatar (96px) + name + "en ligne / hors ligne" dot
- Status message: "Dr. Martin va vous rejoindre dans quelques 
  instants..." with subtle pulsing animation
- Patient's own video preview (small, bottom-right corner)
  rounded 12px, 160x120px
- "Tester mon audio et ma vidéo" link
- Connection quality indicator: 3 bars (green/yellow/red)
- "Quitter la salle d'attente" danger ghost button
- Top banner: appointment details (doctor, time, motif)

--- SCREEN 12: ACTIVE VIDEO CALL ---
- Full-screen video (doctor's feed, dark bg)
- Patient self-view: small overlay bottom-right, draggable
- Top bar (semi-transparent, auto-hide):
  - Patient name left
  - Duration timer center: "00:12:34"
  - Connection quality right
- Bottom control bar (always visible):
  [🎤 Micro] [📷 Caméra] [💬 Chat] [📎 Fichier] [⋮ Plus]
  Center: [🔴 Terminer] (red, larger)
  Each button: circular, 56px, bg=rgba(255,255,255,0.15)
  Active/off state clearly differentiated
- Chat side panel (slides in from right when chat tapped):
  Message bubbles + text input
- "Connexion faible" toast: amber banner slides from top
  "Basculer en audio seulement ?" with [Oui] button

═══════════════════════════════════════════
RESPONSIVE BREAKPOINTS
═══════════════════════════════════════════

Mobile:  320px – 767px   → Stack everything, full-width CTAs
Tablet:  768px – 1023px  → 2-column where appropriate
Desktop: 1024px+         → Full layouts, sidebars visible

Mobile-specific rules:
- Bottom nav always visible (60px height, safe area inset)
- No hover states (touch-first interactions)
- Modals become bottom sheets (drag handle + snap points)
- Filters open as bottom sheets, not dropdowns
- Tables become cards (no horizontal scroll)

═══════════════════════════════════════════
ACCESSIBILITY REQUIREMENTS
═══════════════════════════════════════════

- All text must meet WCAG AA contrast ratio (4.5:1 minimum)
- Focus states: visible blue outline on all interactive elements
- Tap targets minimum 48x48px
- Error messages paired with icons (not color alone)
- Loading states must have aria-label text equivalents
- Form labels always visible (no placeholder-only labels)

═══════════════════════════════════════════
WHAT NOT TO DO
═══════════════════════════════════════════

❌ No complex animations or parallax (3G users)
❌ No auto-playing media
❌ No infinite scroll (use pagination or "Charger plus" button)
❌ No data tables on mobile (use cards)
❌ No tooltips as the only information source (touch = no hover)
❌ No pure icon buttons without labels on mobile
❌ No white text on light backgrounds.
❌ No more than 2 font weights per screen
❌ No generic stock medical imagery (sterile/Western aesthetic)
❌ No pop-up modals that can't be dismissed with back button

═══════════════════════════════════════════
DELIVERABLE PRIORITY ORDER
═══════════════════════════════════════════

Scaffold in this sequence:

1. Design tokens & component library (buttons, inputs, cards)
2. Screen 4  — Home Dashboard (Patient) — highest traffic
3. Screen 5  — Search Results + Filter sheet
4. Screen 6  — Doctor Profile + availability tab
5. Screen 7  — Booking flow (3 steps)
6. Screen 8  — Booking success
7. Screen 2  — Phone authentication
8. Screen 3  — OTP verification
9. Screen 9  — Doctor dashboard
10. Screen 10 — Calendar management
11. Screen 11 — Waiting room
12. Screen 12 — Active video call
13. Screen 1  — Onboarding slides


DB pass: roman-foyer-team-shine

// conduct a thorough architectural review and then write the revised spec back to Notion.
Keep What's solid, fix inconsistencies and problem
