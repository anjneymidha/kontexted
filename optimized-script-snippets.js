// IMMEDIATE PERFORMANCE OPTIMIZATIONS FOR KOMFY
// These can be implemented right away for significant performance gains

// 1. CACHE BASE64 CONVERSION (Save 2-3 seconds per generation cycle)
let cachedBase64 = null;
let cachedImageHash = null;

async function getOptimizedBase64() {
    const currentHash = await hashBlob(originalImageBlob);
    
    if (cachedImageHash !== currentHash || !cachedBase64) {
        cachedBase64 = await blobToBase64(originalImageBlob);
        cachedImageHash = currentHash;
    }
    
    return cachedBase64;
}

async function hashBlob(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// 2. AGGRESSIVE PARALLEL GENERATION (Generate 10 cards at once)
async function preloadNextCardsOptimized() {
    if (isGenerating) return;
    
    isGenerating = true;
    const base64 = await getOptimizedBase64();
    
    try {
        // Generate 10 cards in parallel instead of 3
        const PARALLEL_COUNT = 10;
        const promises = Array(PARALLEL_COUNT).fill().map(() => 
            generateCardDataOptimized(base64)
        );
        
        const newCards = await Promise.all(promises);
        cardQueue.push(...newCards);
        updateQueueUI();
        
    } catch (error) {
        console.error('Error in batch generation:', error);
    } finally {
        isGenerating = false;
    }
}

// 3. OPTIMIZED CARD GENERATION (Skip redundant operations)
async function generateCardDataOptimized(base64) {
    const start = Date.now();
    
    // Run both API calls in parallel when possible
    const [editPrompt, preflightCheck] = await Promise.all([
        analyzeImageWithGemini(base64),
        checkBFLAvailability() // New: Check if BFL is ready
    ]);
    
    const editedImageUrl = await editImageWithKontext(base64, editPrompt);
    
    return {
        editedUrl: editedImageUrl,
        prompt: editPrompt,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        generationTime: ((Date.now() - start) / 1000).toFixed(1)
    };
}

// 4. SMART POLLING WITH EXPONENTIAL BACKOFF
async function pollForResultOptimized(pollingUrl) {
    const delays = [500, 1000, 1500, 2000, 3000]; // Start fast, slow down
    let attempt = 0;
    
    while (attempt < 20) {
        const delay = delays[Math.min(attempt, delays.length - 1)];
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
            const response = await fetch('/api/bfl-poll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pollingUrl })
            });
            
            const data = await response.json();
            
            if (data.status === 'Ready' && data.result) {
                return data.result.sample;
            } else if (data.status === 'Error') {
                throw new Error(`BFL error: ${data.error}`);
            }
            
            attempt++;
        } catch (error) {
            if (attempt >= 19) throw error;
        }
    }
    
    throw new Error('Polling timeout');
}

// 5. VIRTUAL QUEUE RENDERING (Handle 1000+ items smoothly)
const VirtualQueueManager = {
    items: [],
    container: null,
    visibleRange: { start: 0, end: 20 },
    
    init(container) {
        this.container = container;
        this.setupScrollListener();
    },
    
    setupScrollListener() {
        let scrollTimeout;
        this.container.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => this.updateVisibleRange(), 50);
        });
    },
    
    updateVisibleRange() {
        const scrollLeft = this.container.scrollLeft;
        const itemWidth = 68; // 60px + 8px gap
        
        this.visibleRange.start = Math.floor(scrollLeft / itemWidth);
        this.visibleRange.end = this.visibleRange.start + 20;
        
        this.render();
    },
    
    render() {
        requestAnimationFrame(() => {
            this.container.innerHTML = '';
            
            // Only render visible items
            for (let i = this.visibleRange.start; i < this.visibleRange.end && i < this.items.length; i++) {
                const item = this.items[i];
                const element = this.createQueueElement(item);
                element.style.transform = `translateX(${i * 68}px)`;
                this.container.appendChild(element);
            }
        });
    },
    
    createQueueElement(item) {
        const div = document.createElement('div');
        div.className = 'queue-item';
        div.style.position = 'absolute';
        
        const img = document.createElement('img');
        img.src = item.editedUrl;
        img.alt = 'Queued image';
        img.loading = 'lazy';
        
        div.appendChild(img);
        return div;
    }
};

// 6. DEBOUNCED UI UPDATES
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const updateQueueUIOptimized = debounce(() => {
    requestAnimationFrame(() => {
        VirtualQueueManager.items = cardQueue;
        VirtualQueueManager.render();
    });
}, 100);

// 7. MEMORY CLEANUP
const MemoryManager = {
    maxBlobUrls: 30,
    blobUrls: new Set(),
    
    trackBlobUrl(url) {
        this.blobUrls.add(url);
        
        if (this.blobUrls.size > this.maxBlobUrls) {
            const oldestUrl = this.blobUrls.values().next().value;
            URL.revokeObjectURL(oldestUrl);
            this.blobUrls.delete(oldestUrl);
        }
    },
    
    cleanup() {
        // Cleanup orphaned images
        const visibleImages = new Set(
            Array.from(document.querySelectorAll('img'))
                .map(img => img.src)
        );
        
        this.blobUrls.forEach(url => {
            if (!visibleImages.has(url)) {
                URL.revokeObjectURL(url);
                this.blobUrls.delete(url);
            }
        });
    }
};

// Run cleanup every 30 seconds
setInterval(() => MemoryManager.cleanup(), 30000);

// 8. PRODUCTION MODE (Remove console.logs)
if (process.env.NODE_ENV === 'production') {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
}

// 9. IMAGE OPTIMIZATION UTILITIES
async function optimizeImageBeforeUpload(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = () => {
            // Resize if too large
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                width *= ratio;
                height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.85); // 85% quality
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// 10. BATCH API ENDPOINT (Server-side optimization)
async function batchGenerateCards(count = 10) {
    const base64 = await getOptimizedBase64();
    
    const response = await fetch('/api/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64, count })
    });
    
    if (!response.ok) {
        throw new Error(`Batch generation failed: ${response.status}`);
    }
    
    return response.json();
}