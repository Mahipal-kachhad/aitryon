"use client";

import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    let faceLandmarker: FaceLandmarker;
    let requestRef: number;
    let lastVideoTime = -1;

    let setupVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };

    let setupAi = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        if (active) setIsLoaded(true);
      } catch (err) {
        console.error("Error setting up MediaPipe:", err);
      }
    };

    const renderLoop = () => {
      if (!active) return;
      if (videoRef.current && canvasRef.current && faceLandmarker && videoRef.current.readyState >= 2) {
        let startTimeMs = performance.now();
        if (lastVideoTime !== videoRef.current.currentTime) {
          lastVideoTime = videoRef.current.currentTime;
          try {
            const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);

            if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
              const categories = results.faceBlendshapes[0].categories;
              const met: Record<string, number> = {};
              categories.forEach(cat => {
                met[cat.categoryName] = cat.score;
              });
              setMetrics(met);
            }

            const ctx = canvasRef.current.getContext("2d");
            if (ctx && results.faceLandmarks && results.faceLandmarks.length > 0) {
              if (canvasRef.current.width !== videoRef.current.videoWidth) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }

              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              const drawingUtils = new DrawingUtils(ctx);
              for (const landmarks of results.faceLandmarks) {
                // Remove the TESSELATION mesh by commenting it out or deleting the line
                // drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });

                // Add lineWidth: 1 to all remaining connectors to make them sharp
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030", lineWidth: 1 });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030", lineWidth: 1 });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30", lineWidth: 1 });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30", lineWidth: 1 });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0", lineWidth: 1 });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0", lineWidth: 1 });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030", lineWidth: 1 });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30", lineWidth: 1 });
              }
            } else if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
      if (active) {
        requestRef = requestAnimationFrame(renderLoop);
      }
    };

    setupVideo();
    setupAi().then(() => {
      if (active) {
        requestRef = requestAnimationFrame(renderLoop);
      }
    });

    return () => {
      active = false;
      cancelAnimationFrame(requestRef);
      if (faceLandmarker) {
        faceLandmarker.close();
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
            Real-time Face Metrics
          </h1>
          <p className="text-slate-500 text-lg">Powered by MediaPipe Face Landmarker</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="relative w-full lg:w-3/5 aspect-video bg-white rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-200">
            {!isLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-20">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                <p className="text-emerald-600 font-medium">Loading AI Model...</p>
              </div>
            )}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
            />
          </div>

          <div className="w-full lg:w-2/5 bg-white/80 backdrop-blur border border-slate-200 p-6 rounded-2xl shadow-xl flex flex-col h-[600px]">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Blendshape Metrics
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {Object.keys(metrics).length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 italic">
                  Waiting for face detection...
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-y-4">
                  {Object.entries(metrics)
                    .filter(([_, value]) => value > 0.00) // Filter out noise
                    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                    .map(([key, value]) => (
                      <div key={key} className="flex flex-col group">
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-slate-600 font-medium group-hover:text-emerald-600 transition-colors uppercase text-xs tracking-wider">{key.replace(/_/g, ' ')}</span>
                          <span className="text-emerald-700 font-mono text-xs bg-emerald-100 px-2 py-0.5 rounded">
                            {(value as number).toFixed(3)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-full rounded-full transition-all duration-75"
                            style={{ width: `${(value as number) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.4);
        }
      `}} />
    </div>
  );
}
