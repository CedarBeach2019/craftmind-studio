# Shot Types Reference

CraftMind Studio supports a variety of cinematic shot types. Each shot type maps to specific camera behavior and is selected by the Director AI based on the story beat, mood, and character action.

---

## Primary Shots

### Wide Shot (WS)
Establishes geography and spatial relationships. Shows the full environment and character placement.

- **Camera**: High, far back, 60°+ FOV equivalent
- **Best for**: Establishing shots, action sequences, transitions between locations
- **Mood impact**: Epic, isolated, grand
- **Camera path**: Typically `orbitPath` at large radius with slow movement

### Medium Shot (MS)
Frames characters from roughly the waist up. The workhorse of dialogue scenes.

- **Camera**: Moderate distance, eye-level
- **Best for**: Dialogue exchanges, character interactions, reaction shots
- **Mood impact**: Intimate, conversational, grounded
- **Camera path**: `dollyPath` with gentle lateral drift

### Close-Up (CU)
Frames the face (or object) filling most of the frame. Maximum emotional intensity.

- **Camera**: Close, slightly below eye level
- **Best for**: Emotional reactions, important dialogue, key reveals
- **Mood impact**: Intense, personal, dramatic
- **Camera path**: `dollyPath` with very slow push-in (2-3 blocks over 5+ seconds)

---

## Angle Shots

### Over-the-Shoulder (OTS)
Camera positioned behind one character, looking at the other. Creates depth and connection.

- **Camera**: Behind and to the side of a character, looking past their shoulder
- **Best for**: Dialogue between two characters, confrontations
- **Mood impact**: Connected, tense, voyeuristic
- **Camera path**: Static with slight drift, or slow `dollyPath` arc

### Low Angle
Camera below the subject, looking up. Makes subjects appear powerful, imposing, or heroic.

- **Camera**: 1-2 blocks below eye level, close
- **Best for**: Villains, heroes in triumph, dominance displays
- **Mood impact**: Powerful, menacing, heroic
- **Camera path**: `dollyPath` with slow rise, or static

### High Angle
Camera above the subject, looking down. Makes subjects appear small, vulnerable, or lost.

- **Camera**: 5-10 blocks above, angled down
- **Best for**: Establishing vulnerability, showing isolation, bird's-eye overviews
- **Mood impact**: Vulnerable, lonely, omniscient
- **Camera path**: `cranePath` (descent) or static elevated

---

## Movement Shots

### Crane Shot
Vertical camera movement (up or down) with optional lateral drift. Creates dramatic reveals.

- **Camera**: Moves vertically, tracking a subject or point of interest
- **Best for**: Reveals, transitions between scales, opening/closing shots
- **Mood impact**: Dramatic, cinematic, awe-inspiring
- **Camera path**: `cranePath` — specify rise height and look-at target
- **Example**: Rise from ground level behind a building to reveal a vast landscape

### Dolly Shot
Camera physically moves toward or away from the subject (or laterally).

- **Dolly In (Push)**: Camera moves toward subject — increases tension
- **Dolly Out (Pull)**: Camera moves away — releases tension, reveals context
- **Tracking**: Camera moves laterally alongside a moving subject
- **Best for**: Building tension, following action, revealing information
- **Mood impact**: Engaging, dynamic, propulsive
- **Camera path**: `dollyPath` — specify start, end, and look-at point

### Orbit Shot
Camera circles around a subject or point of interest.

- **Full Orbit (360°)**: Complete circle — good for showcasing environments
- **Half Orbit (180°)**: Classic reveal — starts from behind, ends facing
- **Best for**: Showcasing builds, dramatic reveals, romantic moments
- **Mood impact**: Cinematic, theatrical, dreamy
- **Camera path**: `orbitPath` — specify center, radius, height, arc angle

---

## Specialty Shots

### Match Cut
Transition where the visual composition of one shot matches the next shot.

- **Camera**: Positions coordinated between outgoing and incoming shots
- **Best for**: Time jumps, parallel storylines, thematic connections
- **Mood impact**: Clever, surprising, seamless
- **Implementation**: Set via `transition: "match-cut"` on consecutive shots

### POV (Point of View)
Camera positioned as if looking through a character's eyes.

- **Camera**: At character's position and head height, matching their look direction
- **Best for**: Immersion, horror reveals, discovery moments
- **Mood impact**: Immersive, claustrophobic, immediate
- **Implementation**: Position camera at actor's coordinates using `lookAt()`

### Tracking Shot
Camera follows a moving character, maintaining consistent framing.

- **Camera**: Moves alongside or behind a walking/running character
- **Best for**: Chases, journeys, following characters through environments
- **Mood impact**: Energetic, immersive, dynamic
- **Camera path**: Custom path following actor position per-frame

---

## Camera Easing

All camera movements support easing functions that control acceleration:

| Easing | Effect | Best For |
|--------|--------|----------|
| `linear` | Constant speed | Steadicam, documentary |
| `easeIn` | Starts slow, accelerates | Building to a reveal, building tension |
| `easeOut` | Starts fast, decelerates | Landing on a subject, settling |
| `easeInOut` | Slow start and end, fast middle | Most cinematic movements, standard dolly |

---

## Shot Selection Guide by Mood

| Mood | Recommended Shots |
|------|------------------|
| Suspenseful | Close-up, low angle, slow dolly in |
| Triumphant | Crane up, wide, orbit |
| Mysterious | Wide → dolly in, high angle, match cuts |
| Intimate | Medium, close-up, OTS |
| Epic | Wide, crane, full orbit, slow movements |
| Horror | POV, close-up, low angle, quick cuts |
| Comedic | Medium, OTS, whip-pan equivalents (fast dolly) |
| Melancholy | Wide, high angle, slow orbit, static |