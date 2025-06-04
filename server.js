require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

// API Keys from environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BFL_API_KEY = process.env.BFL_API_KEY;

// Validate required environment variables
if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY is required');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('API')));
    process.exit(1);
}
if (!BFL_API_KEY) {
    console.error('❌ BFL_API_KEY is required');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('API')));
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Log API keys on startup
console.log('🚀 Server starting...');
console.log('🔑 OPENROUTER_API_KEY:', OPENROUTER_API_KEY.substring(0, 20) + '...');
console.log('🔑 BFL_API_KEY:', BFL_API_KEY.substring(0, 20) + '...');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files BEFORE API routes
app.use(express.static(__dirname));

// Explicit route for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ensure static files are served with correct MIME types
app.get('/style.css', (req, res) => {
    res.type('text/css');
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/script.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/anj.jpg', (req, res) => {
    res.type('image/jpeg');
    res.sendFile(path.join(__dirname, 'anj.jpg'));
});

// Proxy for OpenRouter API
app.post('/api/openrouter', async (req, res) => {
    try {
        console.log('🔍 OpenRouter request data:', JSON.stringify(req.body.data, null, 2));
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Kontext Engine'
            },
            body: JSON.stringify(req.body.data)
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proxy for BFL API
app.post('/api/bfl', async (req, res) => {
    try {
        console.log('BFL API request:', req.body.data);
        const response = await fetch('https://api.us1.bfl.ai/v1/flux-kontext-pro-raw', {
            method: 'POST',
            headers: {
                'x-key': BFL_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body.data)
        });

        const data = await response.json();
        console.log('BFL API response:', data);
        res.json(data);
    } catch (error) {
        console.error('BFL API error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy for BFL polling
app.post('/api/bfl-poll', async (req, res) => {
    try {
        const response = await fetch(req.body.pollingUrl, {
            method: 'GET',
            headers: {
                'x-key': BFL_API_KEY,
            }
        });

        const data = await response.json();
        console.log('BFL polling response:', data);
        res.json(data);
    } catch (error) {
        console.error('BFL polling error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Export for Vercel serverless functions
module.exports = app;