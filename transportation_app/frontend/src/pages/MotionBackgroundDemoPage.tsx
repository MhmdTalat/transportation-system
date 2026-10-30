/**
 * MotionBackgroundDemoPage
 *
 * Interactive showcase of all 9 motion graphics scenes.
 * Usage: add to App.tsx routes, navigate to /motion-demo
 */

import { useState } from 'react'
import { MotionBackground, type SceneType } from '../components/motion/MotionBackground'
import './MotionBackgroundDemoPage.css'

const SCENES: Array<{ type: SceneType; title: string; description: string; duration: string }> = [
  { type: 'home', title: 'HOME', description: 'City parallax with moving cars', duration: '24s loop' },
  { type: 'searching', title: 'SEARCHING', description: 'Radar with expanding rings', duration: '4s loop' },
  { type: 'matched', title: 'MATCHED', description: 'Route draws, car arrives', duration: '2.5s' },
  { type: 'inTrip', title: 'IN TRIP', description: 'Speed streaks + road shake', duration: '1.5s loop' },
  { type: 'payment', title: 'PAYMENT', description: 'Checkmark burst + confetti', duration: '2s' },
  { type: 'login', title: 'LOGIN', description: 'Soft flow + rotating contours', duration: '60s loop' },
  { type: 'rating', title: 'RATING', description: 'Calm circles + stars', duration: '12s loop' },
  { type: 'error', title: 'ERROR', description: 'Broken route + warning pulse', duration: '3s loop' },
  { type: 'idle', title: 'IDLE', description: 'Subtle pulse, low contrast', duration: '5s loop' },
]

export function MotionBackgroundDemoPage() {
  const [selectedScene, setSelectedScene] = useState<SceneType>('home')
  const [intensity, setIntensity] = useState(0.8)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)

  const current = SCENES.find((s) => s.type === selectedScene)

  return (
    <div className="motion-demo-page">
      {/* Full-screen preview */}
      <div className="motion-demo-container">
        <MotionBackground
          scene={selectedScene}
          intensity={intensity}
          speed={speed}
          paused={paused}
        />

        {/* Content over effect */}
        <div className="motion-demo-content">
          <div className="motion-demo-header">
            <h1>{current?.title}</h1>
            <p>{current?.description}</p>
            <small>{current?.duration}</small>
          </div>

          {/* Controls */}
          <div className="motion-demo-controls">
            <div className="control-group">
              <label>
                Intensity: <strong>{intensity.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={intensity}
                onChange={(e) => setIntensity(parseFloat(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>
                Speed: <strong>{speed.toFixed(2)}</strong>x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={paused}
                  onChange={(e) => setPaused(e.target.checked)}
                />
                Paused
              </label>
            </div>
          </div>

          {/* Scene selector */}
          <div className="motion-demo-selector">
            <div className="scene-grid">
              {SCENES.map((scene) => (
                <button
                  key={scene.type}
                  className={`scene-button ${selectedScene === scene.type ? 'active' : ''}`}
                  onClick={() => setSelectedScene(scene.type)}
                >
                  {scene.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="motion-demo-info">
        <h2>Scenes (9)</h2>
        <ul>
          {SCENES.map((scene) => (
            <li key={scene.type}>
              <strong>{scene.title}</strong> – {scene.description} ({scene.duration})
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
