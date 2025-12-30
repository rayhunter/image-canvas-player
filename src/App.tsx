import React, { useEffect, useRef, useState } from "react";

type ImageEntry = {
  url: string;
  img: HTMLImageElement;
};

const MIN_SCALE_FACTOR = 0.85;
const MAX_SCALE_FACTOR = 1.15;

function mapSpeedToDuration(speed: number): number {
  // speed 0–100 → duration 4000–600 ms
  const min = 600;
  const max = 4000;
  return max - (speed / 100) * (max - min);
}

function mapDelayToMs(delay: number): number {
  // delay 0–100 → 500–6000 ms between images
  const min = 500;
  const max = 6000;
  return min + (delay / 100) * (max - min);
}

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [images, setImages] = useState<ImageEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [speed, setSpeed] = useState(60); // animation duration slider
  const [delay, setDelay] = useState(40); // delay between images slider
  const [shade, setShade] = useState(20); // shade overlay 0–100
  const [volume, setVolume] = useState(50); // audio volume 0–100

  // -------- Image upload --------
  const handleImageUpload: React.ChangeEventHandler<HTMLInputElement> = (
    event
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newEntries: ImageEntry[] = [];
    let loadedCount = 0;

    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        loadedCount += 1;
        if (loadedCount === files.length) {
          // All finished; update in one go to avoid flicker
          setImages((prev) => [...prev, ...newEntries]);
          if (!isPlaying) setIsPlaying(true);
        }
      };
      img.src = url;
      newEntries.push({ url, img });
    });
  };

  // -------- Audio upload --------
  const handleAudioUpload: React.ChangeEventHandler<HTMLInputElement> = (
    event
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.loop = true;
      audioRef.current.play().catch(() => {
        // autoplay might be blocked; user can hit play button
      });
    }
  };

  const handleToggleAudio = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  };

  // -------- Update audio volume --------
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // -------- Canvas resize --------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // -------- Animation when currentIndex changes --------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || images.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const entry = images[currentIndex];
    const img = entry.img;

    const duration = mapSpeedToDuration(speed);
    const start = performance.now();

    // ensure size variance not > 15% of a normalized base
    const baseScale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );
    const jitterFactor =
      MIN_SCALE_FACTOR +
      Math.random() * (MAX_SCALE_FACTOR - MIN_SCALE_FACTOR);
    const scale = baseScale * jitterFactor;

    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // small random rotation for creative feel
    const maxAngleDeg = 5;
    const angleRad =
      ((Math.random() * 2 - 1) * maxAngleDeg * Math.PI) / 180.0;

    let frameId: number;

    const render = (time: number) => {
      const t = Math.min(1, (time - start) / duration);
      const alpha = t; // simple fade-in

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // background
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angleRad);
      ctx.globalAlpha = alpha;

      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      ctx.restore();

      // shade overlay (0–100 → 0–0.65 alpha)
      if (shade > 0) {
        const shadeAlpha = (shade / 100) * 0.65;
        ctx.save();
        ctx.globalAlpha = shadeAlpha;
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      if (t < 1) {
        frameId = requestAnimationFrame(render);
      }
    };

    frameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(frameId);
  }, [currentIndex, images, speed, shade]);

  // -------- Cycle images in random order with delay --------
  useEffect(() => {
    if (!isPlaying || images.length <= 1) return;

    const delayMs = mapDelayToMs(delay);

    const timeoutId = window.setTimeout(() => {
      setCurrentIndex((prev) => {
        if (images.length <= 1) return prev;
        let next = prev;
        while (next === prev) {
          next = Math.floor(Math.random() * images.length);
        }
        return next;
      });
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [isPlaying, images.length, delay, currentIndex]);

  // -------- Optional: simple carousel preview (minimal expectation) --------
  const currentImageUrl = images[currentIndex]?.url;

  return (
    <div className="app-root">
      <aside className="sidebar">
        <h1 className="app-title">Image Flux Player</h1>

        <section className="sidebar-section">
          <h2>Images</h2>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
          />
          <p className="hint">
            Select multiple images from your folder to load the player.
          </p>
          <button
            className="btn"
            disabled={images.length === 0}
            onClick={() => setIsPlaying((prev) => !prev)}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        </section>

        <section className="sidebar-section">
          <h2>Motion</h2>
          <label className="slider-label">
            <span>Speed</span>
            <input
              type="range"
              min={0}
              max={100}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
          </label>
          <label className="slider-label">
            <span>Delay between images</span>
            <input
              type="range"
              min={0}
              max={100}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
            />
          </label>
        </section>

        <section className="sidebar-section">
          <h2>Shade filter</h2>
          <label className="slider-label">
            <span>Intensity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={shade}
              onChange={(e) => setShade(Number(e.target.value))}
            />
          </label>
        </section>

        <section className="sidebar-section">
          <h2>Soundtrack</h2>
          <input
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
          />
          <button className="btn" onClick={handleToggleAudio}>
            Play / Pause Audio
          </button>
          <label className="slider-label">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </label>
          <audio ref={audioRef} />
        </section>

        <section className="sidebar-section">
          <h2>Minimal Carousel</h2>
          {currentImageUrl ? (
            <div className="carousel-thumb">
              <img src={currentImageUrl} alt="current" />
            </div>
          ) : (
            <p className="hint">No images loaded yet.</p>
          )}
        </section>
      </aside>

      <main className="canvas-container">
        <canvas ref={canvasRef} className="canvas" />
        {images.length === 0 && (
          <div className="empty-state">
            <p>Upload a group of images to begin.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;


/* import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
*/
