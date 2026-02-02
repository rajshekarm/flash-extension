// Floating Panel - Stays visible on the page
import type { PlasmoCSConfig } from "plasmo";
import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "~style.css";

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.linkedin.com/*",
    "https://*.greenhouse.io/*",
    "https://*.lever.co/*",
    "https://*.myworkday.com/*",
    "https://*.myworkdayjobs.com/*",
    "https://*.indeed.com/*",
    "https://*.glassdoor.com/*"
  ]
};

// Custom mounting to create draggable floating panel
export const mount = (container: HTMLElement) => {
  const root = createRoot(container);
  root.render(<FloatingPanel />);
};

function FloatingPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [jobInfo, setJobInfo] = useState<any>(null);

  useEffect(() => {
    // Listen for messages to show/hide panel
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'TOGGLE_FLOATING_PANEL') {
        setIsOpen(!isOpen);
      }
      if (msg.type === 'SHOW_FLOATING_PANEL') {
        setIsOpen(true);
        if (msg.data) setJobInfo(msg.data);
      }
    });
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (!isOpen) {
    // Show minimized button
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 999999,
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary-600 text-white rounded-full w-14 h-14 shadow-lg hover:bg-primary-700 transition-colors flex items-center justify-center text-2xl"
        >
          ⚡
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 999999,
        width: '400px',
      }}
      className="bg-white rounded-lg shadow-2xl border border-gray-200"
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="bg-primary-600 text-white px-4 py-3 rounded-t-lg cursor-move flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="font-semibold">Flash Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-primary-700 rounded px-2 py-1"
          >
            −
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-primary-700 rounded px-2 py-1"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {jobInfo ? (
          <div>
            <h3 className="font-semibold text-lg mb-2">{jobInfo.title}</h3>
            <p className="text-gray-600 mb-4">{jobInfo.company}</p>
            
            <div className="space-y-2">
              <button className="w-full bg-primary-600 text-white py-2 rounded hover:bg-primary-700">
                Analyze Job
              </button>
              <button className="w-full border border-gray-300 py-2 rounded hover:bg-gray-50">
                Tailor Resume
              </button>
              <button className="w-full border border-gray-300 py-2 rounded hover:bg-gray-50">
                Fill Application
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Navigate to a job posting to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FloatingPanel;
