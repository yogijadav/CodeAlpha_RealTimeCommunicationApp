import React, { useRef, useState, useEffect } from 'react';

export default function Whiteboard({ onDrawEvent, incomingDrawCoordinates }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastCoords = useRef({ x: 0, y: 0 });
  const [brushColor, setBrushColor] = useState('#04d361');
  const [brushSize, setBrushSize] = useState(4);

  // 1. Process Incoming Remote Peer Drawing Tracks
  useEffect(() => {
    if (!incomingDrawCoordinates || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.strokeStyle = incomingDrawCoordinates.color;
    ctx.lineWidth = incomingDrawCoordinates.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(incomingDrawCoordinates.x1, incomingDrawCoordinates.y1);
    ctx.lineTo(incomingDrawCoordinates.x2, incomingDrawCoordinates.y2);
    ctx.stroke();
  }, [incomingDrawCoordinates]);

  // 2. Mouse Actions handlers
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    isDrawing.current = true;
    lastCoords.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastCoords.current.x, lastCoords.current.y);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    // Broadcast smooth vectors to peer data-channel pipeline
    onDrawEvent({
      x1: lastCoords.current.x,
      y1: lastCoords.current.y,
      x2: currentX,
      y2: currentY,
      color: brushColor,
      size: brushSize
    });

    lastCoords.current = { x: currentX, y: currentY };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div style={{ backgroundColor: '#1a1a1e', border: '1px solid #29292e', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: '0', color: '#fff' }}>Interactive Whiteboard</h4>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} style={{ border: 'none', background: 'none', cursor: 'pointer', width: '32px', height: '32px' }} />
          <input type="range" min="1" max="10" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} style={{ width: '80px' }} />
          <button onClick={clearCanvas} style={{ padding: '6px 12px', backgroundColor: '#29292e', border: '1px solid #323238', borderRadius: '6px', color: '#e1e1e6', cursor: 'pointer' }}>Clear</button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={300}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => isDrawing.current = false}
        onMouseLeave={() => isDrawing.current = false}
        style={{ backgroundColor: '#121214', border: '1px solid #29292e', borderRadius: '8px', cursor: 'crosshair', width: '100%', height: '100%' }}
      />
    </div>
  );
}
