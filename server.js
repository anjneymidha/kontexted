const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

// API Keys from environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const BFL_API_KEY = process.env.BFL_API_KEY || '6249d98f-d557-4499-98b9-4355cc3f4a42';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Proxy for OpenRouter API
app.post('/api/openrouter', async (req, res) => {
    try {
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

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});