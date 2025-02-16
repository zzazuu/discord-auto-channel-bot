const { createCanvas } = require('canvas');
const fs = require('fs');

// Create a canvas
const size = 512;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Colors
const discordBlue = '#7289DA';
const white = '#FFFFFF';

// Clear canvas with transparent background
ctx.clearRect(0, 0, size, size);

// Draw main circle
ctx.beginPath();
ctx.arc(size/2, size/2, size/2.2, 0, Math.PI * 2);
ctx.fillStyle = discordBlue;
ctx.fill();

// Draw microphone
ctx.fillStyle = white;
ctx.beginPath();
// Microphone head
ctx.roundRect(size/2 - 40, size/2 - 80, 80, 100, 20);
ctx.fill();
// Microphone stand
ctx.fillRect(size/2 - 10, size/2 + 20, 20, 40);
// Microphone base
ctx.beginPath();
ctx.arc(size/2, size/2 + 60, 30, 0, Math.PI, false);
ctx.fill();

// Add plus symbol
ctx.strokeStyle = white;
ctx.lineWidth = 15;
ctx.beginPath();
// Horizontal line
ctx.moveTo(size - 120, size - 120);
ctx.lineTo(size - 60, size - 120);
// Vertical line
ctx.moveTo(size - 90, size - 150);
ctx.lineTo(size - 90, size - 90);
ctx.stroke();

// Save the image
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('generated-icon.png', buffer);

console.log('Icon generated successfully!');
