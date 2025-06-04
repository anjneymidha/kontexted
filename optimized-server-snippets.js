// SERVER-SIDE OPTIMIZATIONS FOR KOMFY
// Add these to server.js for backend performance improvements

const compression = require('compression');
const NodeCache = require('node-cache');

// 1. ENABLE GZIP COMPRESSION
app.use(compression());

// 2. IMPLEMENT CACHING
const apiCache = new NodeCache({ stdTTL: 600 }); // 10 minute cache

// 3. BATCH GENERATION ENDPOINT
app.post('/api/batch-generate', async (req, res) => {
    try {
        const { base64Image, count = 5 } = req.body;
        
        // Check cache first
        const cacheKey = `batch_${base64Image.substring(0, 50)}_${count}`;
        const cached = apiCache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        
        // Generate multiple Gemini prompts in parallel
        const promptPromises = Array(count).fill().map(async (_, index) => {
            const variation = getPromptVariation(index);
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash-preview',
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: variation
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }],
                    max_tokens: 100
                })
            });
            
            const data = await response.json();
            const fullResponse = data.choices[0].message.content.trim();
            const match = fullResponse.match(/\$(.*?)\$/);
            
            return match ? match[1].trim() : null;
        });
        
        const prompts = (await Promise.all(promptPromises)).filter(Boolean);
        
        // Start all BFL generations in parallel
        const generationPromises = prompts.map(async (prompt) => {
            const response = await fetch('https://api.us1.bfl.ai/v1/flux-kontext-pro-raw', {
                method: 'POST',
                headers: {
                    'x-key': BFL_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    input_image: base64Image,
                    output_format: 'jpeg'
                })
            });
            
            const data = await response.json();
            
            return {
                prompt: prompt,
                pollingUrl: data.polling_url || null,
                result: data.result || null
            };
        });
        
        const generations = await Promise.all(generationPromises);
        
        // Cache the result
        apiCache.set(cacheKey, { generations });
        
        res.json({ generations });
        
    } catch (error) {
        console.error('Batch generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 4. WEBSOCKET FOR REAL-TIME UPDATES
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const pollingClients = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const { action, pollingUrl, clientId } = JSON.parse(message);
        
        if (action === 'subscribe') {
            pollingClients.set(clientId, { ws, pollingUrl });
            startPollingForClient(clientId);
        }
    });
    
    ws.on('close', () => {
        // Clean up client subscriptions
        for (const [clientId, client] of pollingClients.entries()) {
            if (client.ws === ws) {
                pollingClients.delete(clientId);
            }
        }
    });
});

async function startPollingForClient(clientId) {
    const client = pollingClients.get(clientId);
    if (!client) return;
    
    const { ws, pollingUrl } = client;
    let attempts = 0;
    
    while (attempts < 30 && ws.readyState === WebSocket.OPEN) {
        try {
            const response = await fetch(pollingUrl, {
                headers: { 'x-key': BFL_API_KEY }
            });
            
            const data = await response.json();
            
            if (data.status === 'Ready' && data.result) {
                ws.send(JSON.stringify({
                    status: 'complete',
                    result: data.result.sample
                }));
                pollingClients.delete(clientId);
                return;
            } else if (data.status === 'Error') {
                ws.send(JSON.stringify({
                    status: 'error',
                    error: data.error
                }));
                pollingClients.delete(clientId);
                return;
            }
            
            // Exponential backoff
            const delay = Math.min(500 * Math.pow(1.5, attempts), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempts++;
            
        } catch (error) {
            ws.send(JSON.stringify({
                status: 'error',
                error: error.message
            }));
            pollingClients.delete(clientId);
            return;
        }
    }
}

// 5. OPTIMIZE STATIC FILE SERVING
app.use(express.static(__dirname, {
    maxAge: '1d', // Cache static files for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        if (path.endsWith('.jpg') || path.endsWith('.png')) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week
        }
    }
}));

// 6. HEALTH CHECK ENDPOINT
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// 7. RATE LIMITING
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', apiLimiter);

// 8. PROMPT VARIATIONS FOR DIVERSITY
function getPromptVariation(index) {
    const variations = [
        'Generate a unique, creative transformation for this image. Avoid superhero themes. Be original and diverse. Format your response exactly like this: $transformation description here$.',
        'Transform this image into something unexpected and artistic. Think outside the box. Format: $your creative description$.',
        'Reimagine this subject in a completely different context or era. Be imaginative. Format: $transformation idea$.',
        'Apply an artistic style or cultural theme to transform this image. Format: $style transformation$.',
        'Create a whimsical or fantastical version of this image. Let your creativity flow. Format: $fantasy transformation$.'
    ];
    
    return variations[index % variations.length];
}

// 9. ERROR HANDLING MIDDLEWARE
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 10. CLUSTER MODE FOR MULTI-CORE USAGE
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork(); // Replace dead workers
    });
} else {
    // Workers can share any TCP connection
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} started on port ${PORT}`);
    });
}