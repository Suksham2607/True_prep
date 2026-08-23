// Pure, framework-free math for turning MediaPipe Face Landmarker output
// into the three Milestone 4 features: blink rate, an eye-contact estimate,
// and a facial engagement score. Kept separate from the React page/camera
// code on purpose - these are plain functions you can feed fake data into
// and check the numbers, without needing a browser or a webcam at all.
//
// Honesty note (also shown on the page itself): these are simple, explainable
// heuristics built directly from MediaPipe's landmark/blendshape numbers -
// not a trained or validated psychological measure of attention or emotion.
// That's intentional: the project's rule-based scoring engine (Milestone 7)
// needs transparent, explainable inputs, not another black-box model.

// --- Blink tracking --------------------------------------------------------
//
// MediaPipe's face blendshapes include "eyeBlinkLeft" and "eyeBlinkRight",
// each a 0-1 score where higher means "more closed". A single blink shows
// up as several consecutive frames with a high score, so counting a blink
// per closed *frame* would wildly overcount. Instead this tracks open/closed
// as a two-state machine and only counts the open -> closed transition
// (the moment the eyes start closing), which corresponds to one blink.

const BLINK_CLOSE_THRESHOLD = 0.5;

export function createBlinkTracker() {
  let eyesClosed = false;
  let blinkCount = 0;
  let firstTimestampMs = null;
  let lastTimestampMs = null;

  return {
    // Call once per detected frame with that frame's blendshape list (the
    // `categories` array MediaPipe returns) and the frame's timestamp.
    update(blendshapeCategories, timestampMs) {
      if (firstTimestampMs === null) firstTimestampMs = timestampMs;
      lastTimestampMs = timestampMs;

      const score = (name) =>
        blendshapeCategories.find((c) => c.categoryName === name)?.score ?? 0;

      const closedNow =
        (score("eyeBlinkLeft") + score("eyeBlinkRight")) / 2 > BLINK_CLOSE_THRESHOLD;

      if (closedNow && !eyesClosed) {
        blinkCount += 1;
      }
      eyesClosed = closedNow;
    },

    getBlinkCount() {
      return blinkCount;
    },

    // Blinks per minute, scaled from however long we've actually been
    // watching. Returns null until we've observed at least a little time,
    // so the UI can show "warming up..." instead of a misleading number.
    getBlinkRatePerMinute() {
      if (firstTimestampMs === null || lastTimestampMs === firstTimestampMs) return null;
      const elapsedMinutes = (lastTimestampMs - firstTimestampMs) / 1000 / 60;
      if (elapsedMinutes <= 0) return null;
      return blinkCount / elapsedMinutes;
    },

    reset() {
      eyesClosed = false;
      blinkCount = 0;
      firstTimestampMs = null;
      lastTimestampMs = null;
    },
  };
}

// --- Gaze / eye-contact estimate -------------------------------------------
//
// The face landmark model outputs iris landmarks alongside the main face
// mesh. For each eye, comparing the iris center's position to that eye's
// left/right/top/bottom corners gives a rough 0-1 ratio of where the iris
// sits inside the eye socket (~0.5 both ways = looking roughly straight
// ahead, i.e. at the camera). This is a simplification - it doesn't account
// for head pose - but it's transparent and good enough for a "were you
// generally looking at the camera" signal.

// MediaPipe FaceLandmarker's 478-point mesh: indices 468-472 are the right
// iris (from the camera's point of view) and 473-477 are the left iris.
const RIGHT_IRIS = [468, 469, 470, 471, 472];
const LEFT_IRIS = [473, 474, 475, 476, 477];
// Eye corner + top/bottom landmarks used to build each eye's bounding box.
const RIGHT_EYE_CORNERS = { left: 33, right: 133, top: 159, bottom: 145 };
const LEFT_EYE_CORNERS = { left: 362, right: 263, top: 386, bottom: 374 };

function irisRatioForEye(landmarks, irisIndices, corners) {
  const iris = irisIndices.map((i) => landmarks[i]);
  const irisCenter = {
    x: iris.reduce((sum, p) => sum + p.x, 0) / iris.length,
    y: iris.reduce((sum, p) => sum + p.y, 0) / iris.length,
  };

  const left = landmarks[corners.left];
  const right = landmarks[corners.right];
  const top = landmarks[corners.top];
  const bottom = landmarks[corners.bottom];

  const width = right.x - left.x;
  const height = bottom.y - top.y;
  if (width === 0 || height === 0) return null;

  return {
    x: (irisCenter.x - left.x) / width,
    y: (irisCenter.y - top.y) / height,
  };
}

// How far from dead-center (0.5, 0.5) the iris can sit and still count as
// "looking at the camera". Loose enough to tolerate landmark jitter and
// natural micro-movements without flagging every frame as "looking away".
const GAZE_CENTER_TOLERANCE = 0.18;

export function isLookingAtCamera(landmarks) {
  const right = irisRatioForEye(landmarks, RIGHT_IRIS, RIGHT_EYE_CORNERS);
  const left = irisRatioForEye(landmarks, LEFT_IRIS, LEFT_EYE_CORNERS);
  if (!right || !left) return null;

  const avgX = (right.x + left.x) / 2;
  const avgY = (right.y + left.y) / 2;

  return (
    Math.abs(avgX - 0.5) <= GAZE_CENTER_TOLERANCE && Math.abs(avgY - 0.5) <= GAZE_CENTER_TOLERANCE
  );
}

export function createGazeTracker() {
  let centeredFrames = 0;
  let totalFrames = 0;

  return {
    update(landmarks) {
      const centered = isLookingAtCamera(landmarks);
      if (centered === null) return; // couldn't measure this frame, skip it
      totalFrames += 1;
      if (centered) centeredFrames += 1;
    },

    // Percentage of measured frames spent roughly looking at the camera.
    // Null until we have at least one usable frame.
    getEyeContactPercent() {
      if (totalFrames === 0) return null;
      return (centeredFrames / totalFrames) * 100;
    },

    reset() {
      centeredFrames = 0;
      totalFrames = 0;
    },
  };
}

// --- Facial engagement -------------------------------------------------
//
// A simple proxy for "how expressive/animated is the face right now":
// average of a handful of expression-related blendshapes (brow raise,
// smile, jaw opening). Not a measure of any specific emotion - just how
// much the face is moving away from a flat, neutral expression.

const ENGAGEMENT_BLENDSHAPES = [
  "browInnerUp",
  "mouthSmileLeft",
  "mouthSmileRight",
  "jawOpen",
];

export function computeEngagementScore(blendshapeCategories) {
  const scores = ENGAGEMENT_BLENDSHAPES.map(
    (name) => blendshapeCategories.find((c) => c.categoryName === name)?.score ?? 0
  );
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return average * 100;
}

export function createEngagementTracker() {
  let total = 0;
  let count = 0;

  return {
    update(blendshapeCategories) {
      total += computeEngagementScore(blendshapeCategories);
      count += 1;
    },

    getAverageEngagement() {
      if (count === 0) return null;
      return total / count;
    },

    reset() {
      total = 0;
      count = 0;
    },
  };
}
