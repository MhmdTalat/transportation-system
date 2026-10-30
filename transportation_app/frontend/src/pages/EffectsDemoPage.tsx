/**
 * EffectsDemoPage
 *
 * Visual showcase of all background effects.
 * Use to test rendering, performance, and acceptance criteria.
 *
 * Route: /effects-demo (add to App.tsx routes for testing)
 */

import { useState } from 'react'
import { BackgroundEffect, type EffectType } from '../components/effects/BackgroundEffect'
import './EffectsDemoPage.css'

const EFFECTS: Array<{ type: EffectType; title: string; description: string }> = [
  { type: 'radarSweep', title: 'Radar Sweep', description: 'Rotating wedge for search/dispatch' },
  { type: 'skyline', title: 'Skyline', description: 'Parallax layers for home screen' },
  { type: 'speedLines', title: 'Speed Lines', description: 'Motion streaks for in-trip (TODO)' },
  { type: 'contours', title: 'Contours', description: 'Rotating rings for login (TODO)' },
  { type: 'dotWave', title: 'Dot Wave', description: 'Grid wave for loading (TODO)' },
  { type: 'rain', title: 'Rain', description: 'Falling drops for alerts (TODO)' },
  { type: 'glow', title: 'Glow', description: 'Soft glow for modals (TODO)' },
  { type: 'glass', title: 'Glass', description: 'Frosted overlay (TODO)' },
]

export function EffectsDemoPage() {
  const [selectedEffect, setSelectedEffect] = useState<EffectType>('radarSweep')
  const [intensity, setIntensity] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)

  const current = EFFECTS.find((e) => e.type === selectedEffect)

  return (
    <div className="effects-demo-page">
      {/* Full-screen demo */}
      <div className="effects-demo-container">
        <BackgroundEffect
          type={selectedEffect}
          intensity={intensity}
          speed={speed}
          paused={paused}
        />

        {/* Content over effect */}
        <div className="effects-demo-content">
          <div className="effects-demo-header">
            <h1>{current?.title}</h1>
            <p>{current?.description}</p>
          </div>

          {/* Controls */}
          <div className="effects-demo-controls">
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

          {/* Effect selector */}
          <div className="effects-demo-selector">
            <div className="effect-list">
              {EFFECTS.map((effect) => (
                <button
                  key={effect.type}
                  className={`effect-button ${selectedEffect === effect.type ? 'active' : ''}`}
                  onClick={() => setSelectedEffect(effect.type)}
                >
                  {effect.title}
                  {effect.title.includes('TODO') && <span className="badge">WIP</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Testing notes */}
      <div className="effects-demo-notes">
        <h2>Acceptance Checklist</h2>
        <ul>
          <li>[ ] Light mode: correct appearance</li>
          <li>[ ] Dark mode: correct appearance</li>
          <li>[ ] Arabic RTL: directional effects mirrored</li>
          <li>[ ] Text contrast: WCAG AA over effect</li>
          <li>[ ] Reduce motion: static frame shown</li>
          <li>[ ] Focus: pauses when screen hidden</li>
          <li>[ ] Performance: 60fps on low-end device</li>
          <li>[ ] Loop: seamless, no jump at restart</li>
          <li>[ ] Responsive: works on small/medium/large screens</li>
          <li>[ ] Tests: unit/snapshot passing</li>
        </ul>
      </div>
    </div>
  )
}
