import { formatPercent } from "@/lib/utils";
import type { PlannerDecision } from "@/lib/shot-planner/types";
import type { FaceTrack } from "@/lib/vision/types";

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawCompositionGrid(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save();
  context.strokeStyle = "rgba(255,255,255,0.12)";
  context.lineWidth = 1;
  context.setLineDash([8, 10]);

  context.beginPath();
  context.moveTo(width / 3, 0);
  context.lineTo(width / 3, height);
  context.moveTo((width / 3) * 2, 0);
  context.lineTo((width / 3) * 2, height);
  context.moveTo(0, height / 3);
  context.lineTo(width, height / 3);
  context.moveTo(0, (height / 3) * 2);
  context.lineTo(width, (height / 3) * 2);
  context.stroke();

  context.setLineDash([]);
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.strokeRect(width * 0.08, height * 0.08, width * 0.84, height * 0.84);
  context.restore();
}

function drawSubjectGuide(context: CanvasRenderingContext2D, track: FaceTrack, isActive: boolean) {
  const guideBox = {
    x: track.box.x - track.box.width * (isActive ? 0.78 : 0.55),
    y: track.box.y - track.box.height * (isActive ? 0.95 : 0.7),
    width: track.box.width * (isActive ? 2.56 : 2.05),
    height: track.box.height * (isActive ? 3.1 : 2.5)
  };

  context.save();
  context.strokeStyle = isActive ? "rgba(45, 212, 191, 0.76)" : "rgba(226, 232, 240, 0.28)";
  context.lineWidth = isActive ? 3 : 1.5;
  context.setLineDash(isActive ? [10, 8] : [6, 8]);
  context.strokeRect(guideBox.x, guideBox.y, guideBox.width, guideBox.height);
  context.setLineDash([]);

  context.fillStyle = isActive ? "rgba(6, 182, 212, 0.9)" : "rgba(148, 163, 184, 0.75)";
  context.fillRect(guideBox.x, guideBox.y - 20, isActive ? 128 : 108, 18);
  context.fillStyle = "#e2e8f0";
  context.font = "600 11px Space Grotesk, sans-serif";
  context.fillText(isActive ? "ACTIVE SUBJECT" : "SUBJECT FRAME", guideBox.x + 8, guideBox.y - 7);
  context.restore();
}

export function drawGuideFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  tracks: FaceTrack[],
  decision: PlannerDecision,
  options: {
    showFaceBoxes: boolean;
  }
) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  resizeCanvas(canvas, width, height);

  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, width, height);
  context.drawImage(video, 0, 0, width, height);
  drawCompositionGrid(context, width, height);

  for (const track of tracks) {
    if (!track.visible) continue;
    drawSubjectGuide(context, track, track.id === decision.targetTrackId);
  }

  if (options.showFaceBoxes) {
    for (const track of tracks) {
      if (!track.visible) continue;

      context.strokeStyle = track.id === decision.targetTrackId ? "rgba(125, 211, 252, 0.92)" : "rgba(255,255,255,0.35)";
      context.lineWidth = track.id === decision.targetTrackId ? 4 : 2;
      context.strokeRect(track.box.x, track.box.y, track.box.width, track.box.height);
    }
  }

  context.strokeStyle = "rgba(45, 212, 191, 0.92)";
  context.lineWidth = 4;
  context.setLineDash([14, 10]);
  context.strokeRect(
    decision.cropBox.x * width,
    decision.cropBox.y * height,
    decision.cropBox.width * width,
    decision.cropBox.height * height
  );
  context.setLineDash([]);

  context.fillStyle = "rgba(5, 8, 22, 0.72)";
  context.fillRect(18, 18, 290, 98);
  context.fillStyle = "#eef2ff";
  context.font = "600 22px Space Grotesk, sans-serif";
  context.fillText(`${decision.shotType.toUpperCase()} SHOT`, 30, 48);
  context.font = "400 18px Space Grotesk, sans-serif";
  context.fillStyle = "#b8c2d9";
  context.fillText(`confidence ${formatPercent(decision.confidence)}`, 30, 74);
  context.font = "400 15px Space Grotesk, sans-serif";
  context.fillText(decision.targetTrackId ? "subject-led composition" : "scene-led composition", 30, 96);
}

export function drawDirectorPreview(video: HTMLVideoElement, canvas: HTMLCanvasElement, cropBox: PlannerDecision["cropBox"]) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const outputWidth = 1080;
  const outputHeight = 607;
  resizeCanvas(canvas, outputWidth, outputHeight);

  const sourceX = cropBox.x * video.videoWidth;
  const sourceY = cropBox.y * video.videoHeight;
  const sourceWidth = cropBox.width * video.videoWidth;
  const sourceHeight = cropBox.height * video.videoHeight;

  context.clearRect(0, 0, outputWidth, outputHeight);
  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
}
