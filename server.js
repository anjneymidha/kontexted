require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

// API Keys from environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const BFL_API_KEY = process.env.BFL_API_KEY || '6249d98f-d557-4499-98b9-4355cc3f4a42';

const app = express();
const PORT = 3000;

// Debug: Log API keys on startup
console.log('🚀 Server starting...');
console.log('🔑 OPENROUTER_API_KEY:', OPENROUTER_API_KEY ? OPENROUTER_API_KEY.substring(0, 20) + '...' : 'MISSING');
console.log('🔑 BFL_API_KEY:', BFL_API_KEY ? BFL_API_KEY.substring(0, 20) + '...' : 'MISSING');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files BEFORE API routes
app.use(express.static(__dirname));

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