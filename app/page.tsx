"use client";

import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Canvas } from "@react-three/fiber";
import Glasses from "@/components/glasses";
import { OrbitControls } from "@react-three/drei";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // 3D Transform State
  const [glassesTransform, setGlassesTransform] = useState<{
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    visible: boolean;
  }>({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: false
  });

  useEffect(() => {
    let active = true;
    let faceLandmarker: FaceLandmarker;
    let requestRef: number;
    let lastVideoTime = -1;

    let setupVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (active && videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };

    let setupAi = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        if (active) {
          faceLandmarker = landmarker;
          setIsLoaded(true);
        } else {
          landmarker.close();
        }
      } catch (err) {
        console.error("Error setting up MediaPipe:", err);
      }
    };

    const renderLoop = () => {
      if (!active) return;
      if (
        videoRef.current &&
        canvasRef.current &&
        faceLandmarker &&
        videoRef.current.readyState >= 2 &&
        videoRef.current.videoWidth > 0
      ) {
        let startTimeMs = performance.now();
        if (lastVideoTime !== videoRef.current.currentTime) {
          lastVideoTime = videoRef.current.currentTime;
          try {
            const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);

            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;

            // Sync 2D canvas size
            if (canvasRef.current.width !== videoWidth) {
              canvasRef.current.width = videoWidth;
              canvasRef.current.height = videoHeight;
            }

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
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

              for (const landmarks of results.faceLandmarks) {
                // 3D Glasses transformation logic
                const leftEye = landmarks[33];
                const rightEye = landmarks[263];
                const noseBridge = landmarks[168];

                const midX = (leftEye.x + rightEye.x) / 2;
                const midY = (leftEye.y + rightEye.y) / 2;
                const midZ = (leftEye.z + rightEye.z) / 2;

                const dx = (rightEye.x - leftEye.x) * videoWidth;
                const dy = (rightEye.y - leftEye.y) * videoHeight;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const roll = Math.atan2(dy, dx);
                const yaw = (noseBridge.x - midX) * 10;
                const baseScale = distance / 20;

                setGlassesTransform({
                  position: [
                    (midX - 0.5) * 7.5, // Horizontal mapping
                    -(midY - 0.5) * 5.5, // Vertical mapping
                    -midZ * 5 // Depth mapping
                  ],
                  rotation: [0, yaw, roll],
                  scale: [baseScale, baseScale, baseScale],
                  visible: true
                });
              }
            } else {
              setGlassesTransform(prev => ({ ...prev, visible: false }));
              if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          } catch (e) {
            console.error("Detection error:", e);
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
    <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30 overflow-hidden">
      <div className="fixed inset-0 w-full h-full bg-slate-900">
        {!isLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md z-50">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
            <p className="text-emerald-400 font-medium">Initializing Vision Engine...</p>
          </div>
        )}

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover grayscale-[0.2]"
          autoPlay
          playsInline
          muted
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10 opacity-50"
        />

        <div className="absolute inset-0 z-20 pointer-events-none">
          <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
            <OrbitControls />
            <axesHelper args={[5]} />
            <ambientLight intensity={1.5} />
            <directionalLight position={[0, 1, 2]} intensity={2} />

            {glassesTransform.visible && (
              <Glasses
                position={glassesTransform.position}
                rotation={glassesTransform.rotation}
                scale={glassesTransform.scale}
              />
            )}
          </Canvas>
        </div>
      </div>
    </div>
  );
}
