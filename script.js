// API keys are handled server-side for security

const cardStack = document.getElementById('cardStack');
const loadingCard = document.getElementById('loadingCard');
const loadingText = document.getElementById('loadingText');
const imageInput = document.getElementById('imageInput');
const uploadBtn = document.getElementById('uploadBtn');
const rejectBtn = document.getElementById('rejectBtn');
const likeBtn = document.getElementById('likeBtn');
const saveBtn = document.getElementById('saveBtn');
const matchCount = document.getElementById('matchCount');
const queueList = document.getElementById('queueList');
const currentPrompt = document.getElementById('currentPrompt');
const lovedList = document.getElementById('lovedList');
const lovedSection = document.getElementById('lovedSection');

let currentCard = null;
let isDatingMode = true;
let matches = 0;
let cardQueue = [];
let isGenerating = false;
let originalImageBlob = null;
let currentImageUrl = null;
let currentCardData = null;
let allPrompts = [];
let lovedItems = [];
let generationStartTime = null;

// Preferences tracking
let preferences = {
    liked: [],     // Cards swiped right
    rejected: [],  // Cards swiped left  
    saved: []      // Cards saved to downloads
};

// Event listeners
uploadBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', handleImageUpload);
rejectBtn.addEventListener('click', () => swipeCard('left'));
likeBtn.addEventListener('click', () => swipeCard('right'));
saveBtn.addEventListener('click', saveCurrentImage);

// Dating mode toggle
const datingModeToggle = document.getElementById('datingMode');
datingModeToggle.addEventListener('change', (e) => {
    isDatingMode = e.target.checked;
    console.log('Dating mode:', isDatingMode ? 'ON 💕' : 'OFF');
    
    // Update button labels based on mode
    updateButtonLabels();
    
    // Save preference
    localStorage.setItem('kontext-dating-mode', isDatingMode);
});

// Wait for user upload instead of auto-processing
window.addEventListener('load', () => {
    loadPreferences();
    showWelcomeMessage();
});

// Keyboard controls
document.addEventListener('keydown', handleKeyPress);

// Removed autoProcessImage - app now waits for user uploads

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        hideWelcomeMessage();
        showLoading('Processing your photo...');
        
        // Only compress if file is too large for server
        const maxServerSize = 75 * 1024 * 1024; // 75MB (conservative estimate for base64 encoding)
        let processedBlob = file;
        
        if (file.size > maxServerSize) {
            showLoading('Optimizing large image...');
            processedBlob = await compressImage(file);
            console.log(`📦 Compressed: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(processedBlob.size / 1024 / 1024).toFixed(1)}MB`);
        } else {
            console.log(`📄 Using original: ${(file.size / 1024 / 1024).toFixed(1)}MB (no compression needed)`);
        }
        
        originalImageBlob = processedBlob;
        
        // Clear existing queue and prompts
        cardQueue = [];
        allPrompts = [];
        lovedItems = [];
        updateQueueUI();
        updateLovedUI();
        
        showLoading('AI analyzing your style...');
        const firstCard = await generateCardData();
        
        showLoading('Creating your perfect match...');
        createComparisonCard(URL.createObjectURL(processedBlob), firstCard.editedUrl, firstCard.prompt);
        hideLoading();
        
        // Start preloading next cards in background (don't wait for this)
        setTimeout(() => preloadNextCards(), 100);
        
    } catch (error) {
        console.error('Error processing image:', error);
        hideLoading();
        alert('Error processing image: ' + error.message);
    }
}

function createComparisonCard(_, editedUrl, prompt) {
    const card = document.createElement('div');
    card.className = 'card';
    
    card.innerHTML = `
        <div class="card-content">
            <div class="card-image">
                <img src="${editedUrl}" alt="Edited version">
            </div>
        </div>
    `;
    
    // Store current card data for preferences tracking
    currentImageUrl = editedUrl;
    currentCardData = {
        id: Date.now() + Math.random(), // Unique ID
        prompt: prompt,
        imageUrl: editedUrl,
        timestamp: new Date().toISOString()
    };
    
    // Add to prompts list and update UI
    allPrompts.push(currentCardData);
    updateCurrentPromptUI();
    
    
    addSwipeListeners(card);
    cardStack.appendChild(card);
    currentCard = card;
    
    // Animate card entrance
    setTimeout(() => {
        card.style.transform = 'scale(1)';
        card.style.opacity = '1';
    }, 100);
}

function addSwipeListeners(card) {
    // Remove all gesture swiping - use buttons only
    // Card is now static and only responds to button clicks
    card.style.cursor = 'default';
}

function swipeCard(direction) {
    if (currentCard) {
        currentCard.classList.add(`swiped-${direction}`);
        completeSwipe(currentCard, direction);
    }
}

function completeSwipe(card, direction) {
    // Immediately hide the card to clear the view
    card.style.pointerEvents = 'none';
    card.classList.add(`swiped-${direction}`);
    
    // Clear the caption immediately
    const currentPromptEl = document.getElementById('currentPrompt');
    if (currentPromptEl) {
        currentPromptEl.textContent = '';
    }
    
    // Track preferences
    if (currentCardData) {
        if (direction === 'right') {
            preferences.liked.push(currentCardData);
            matches++;
            if (matchCount) matchCount.textContent = matches;
            
            // Add to loved items
            lovedItems.push({
                ...currentCardData,
                lovedAt: new Date().toISOString()
            });
            updateLovedUI();
            console.log('❤️ Liked:', currentCardData.prompt);
        } else {
            preferences.rejected.push(currentCardData);
            console.log('❌ Rejected:', currentCardData.prompt);
        }
        
        // Save preferences to localStorage
        savePreferences();
    }
    
    // Reset current card state immediately
    currentCard = null;
    currentCardData = null;
    
    // Show next card immediately - no delay!
    showNextCard();
    
    // Remove the old card from DOM after animation (but don't wait for it)
    setTimeout(() => {
        card.remove();
    }, 50);
}

async function generateCardData() {
    generationStartTime = Date.now();
    
    const base64Image = await blobToBase64(originalImageBlob);
    const editPrompt = await analyzeImageWithGemini(base64Image);
    const editedImageUrl = await editImageWithKontext(base64Image, editPrompt);
    
    const generationTime = ((Date.now() - generationStartTime) / 1000).toFixed(1);
    
    const cardData = {
        editedUrl: editedImageUrl,
        prompt: editPrompt,
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        generationTime: generationTime
    };
    
    return cardData;
}

async function preloadNextCards() {
    if (isGenerating) {
        console.log('Already generating cards, skipping...');
        return;
    }
    
    console.log(`Starting preload. Current queue: ${cardQueue.length}/10`);
    isGenerating = true;
    
    try {
        // Generate multiple cards in parallel for faster replenishment
        // Reduce queue size on mobile for better performance
        const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const targetQueueSize = isMobile ? 8 : 15;
        const parallelGenerations = Math.min(isMobile ? 2 : 3, targetQueueSize - cardQueue.length);
        
        const promises = [];
        for (let i = 0; i < parallelGenerations; i++) {
            promises.push(generateCardData());
        }
        
        // Wait for all parallel generations to complete
        const newCards = await Promise.all(promises);
        cardQueue.push(...newCards);
        
        console.log(`✅ Generated ${newCards.length} cards in parallel. Queue now: ${cardQueue.length}/${targetQueueSize}`);
        updateQueueUI();
        
        console.log(`🎯 Queue fully loaded with ${cardQueue.length} cards`);
        
    } catch (error) {
        console.error('❌ Error preloading cards:', error);
    } finally {
        isGenerating = false;
        console.log('🏁 Preload completed, isGenerating = false');
    }
}

function showNextCard() {
    console.log(`🎴 Showing next card. Queue has: ${cardQueue.length} cards`);
    
    if (cardQueue.length > 0) {
        // Get next card from queue
        const nextCard = cardQueue.shift();
        createComparisonCard(URL.createObjectURL(originalImageBlob), nextCard.editedUrl, nextCard.prompt);
        
        console.log(`✨ Showed card from queue. Remaining: ${cardQueue.length}`);
        
        // Update queue UI after removing item
        updateQueueUI();
        
        // Aggressively replenish queue - start generating immediately after swipe
        if (cardQueue.length < 12) {
            setTimeout(() => preloadNextCards(), 10);
        }
        
    } else {
        // Fallback if queue is empty
        console.log('⚠️ Queue empty! Using fallback...');
        showLoading('Finding your next match...');
        generateCardData().then(cardData => {
            createComparisonCard(URL.createObjectURL(originalImageBlob), cardData.editedUrl, cardData.prompt);
            hideLoading();
            // Start aggressive preloading
            setTimeout(() => preloadNextCards(), 50);
        }).catch(error => {
            console.error('❌ Error generating fallback card:', error);
            hideLoading();
        });
    }
}

function handleKeyPress(event) {
    // Ignore if user is typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch(event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            console.log('⌨️ Left arrow pressed - rejecting card');
            swipeCard('left');
            break;
        case 'ArrowRight':
            event.preventDefault();
            console.log('⌨️ Right arrow pressed - liking card');
            swipeCard('right');
            break;
        case ' ':
        case 'Spacebar':
            event.preventDefault();
            console.log('⌨️ Space pressed - saving image');
            saveCurrentImage();
            break;
        case 'u':
        case 'U':
            event.preventDefault();
            console.log('⌨️ U pressed - uploading new image');
            imageInput.click();
            break;
    }
}

async function saveCurrentImage() {
    if (!currentImageUrl) {
        alert('No image to save!');
        return;
    }
    
    try {
        // Show feedback
        saveBtn.style.transform = 'scale(1.2)';
        saveBtn.innerHTML = '<span>⏬</span>';
        
        // Use server proxy to download image (bypasses CORS)
        const response = await fetch('/api/download-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ imageUrl: currentImageUrl })
        });
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        // For mobile devices, try to share
        if (navigator.share && navigator.canShare) {
            try {
                const file = new File([blob], `kontext-edit-${Date.now()}.jpg`, { type: 'image/jpeg' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Kontext Edit',
                        text: currentCardData?.prompt || 'AI Generated Image'
                    });
                } else {
                    // Fallback to download
                    downloadImage(blob);
                }
            } catch (shareError) {
                console.log('Share failed, falling back to download:', shareError);
                downloadImage(blob);
            }
        } else {
            // Desktop or unsupported browsers - download
            downloadImage(blob);
        }
        
        // Track save preference
        if (currentCardData) {
            preferences.saved.push(currentCardData);
            savePreferences();
            console.log('💾 Saved:', currentCardData.prompt);
        }
        
        // Success feedback
        saveBtn.innerHTML = '<span>✅</span>';
        setTimeout(() => {
            saveBtn.innerHTML = '<span>💾</span>';
            saveBtn.style.transform = '';
        }, 1000);
        
    } catch (error) {
        console.error('Error saving image:', error);
        saveBtn.innerHTML = '<span>❌</span>';
        setTimeout(() => {
            saveBtn.innerHTML = '<span>💾</span>';
            saveBtn.style.transform = '';
        }, 1000);
    }
}

function downloadImage(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kontext-edit-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showLoading(text) {
    loadingText.textContent = text;
    loadingCard.style.display = 'flex';
}

function hideLoading() {
    loadingCard.style.display = 'none';
}

function showWelcomeMessage() {
    const welcomeCard = document.getElementById('welcomeCard');
    welcomeCard.style.display = 'flex';
}

function hideWelcomeMessage() {
    const welcomeCard = document.getElementById('welcomeCard');
    welcomeCard.style.display = 'none';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

async function analyzeImageWithGemini(base64Image) {
    const response = await fetch('/api/openrouter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            data: {
                model: 'google/gemini-2.5-flash-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: isDatingMode ? 
                                    'Generate a romantic image with this person and an AI-generated partner. Create diverse, attractive partners of various ethnicities and styles. Format your response exactly like this: $description here$. Examples: $The person with their charming date at a cozy coffee shop$ or $The person and their partner having a romantic picnic$ or $The person dancing with their elegant partner at a formal event$ or $The person and their adventurous partner on a scenic hike$ or $The person sharing a sunset moment with their artistic partner$.': 
                                    'Generate a unique, creative transformation for this image. Avoid superhero themes. Be original and diverse. Format your response exactly like this: $transformation description here$. Examples: $The person is now a Victorian-era inventor$ or $Transform into a watercolor painting$ or $The person is now in ancient Egypt$ or $Become a character from a Studio Ghibli film$ or $The person is now a medieval alchemist$.'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 2000
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🔍 FULL API RESPONSE:', data);
    
    if (data.error) {
        console.error('❌ API Error:', data.error);
        throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('❌ Invalid API response structure:', data);
        throw new Error('Invalid response from Gemini API');
    }
    
    const fullResponse = data.choices[0].message.content ? data.choices[0].message.content.trim() : '';
    
    // Debug: Log the full response from Gemini
    console.log('🤖 FULL GEMINI RESPONSE:', fullResponse);
    console.log('🤖 RESPONSE LENGTH:', fullResponse.length);
    
    // Extract text between $ delimiters
    const match = fullResponse.match(/\$(.*?)\$/);
    
    if (match && match[1]) {
        const extractedPrompt = match[1].trim();
        console.log('✅ Successfully extracted prompt from delimiters:', extractedPrompt);
        return extractedPrompt;
    } else {
        console.log('❌ No delimiters found in Gemini response');
        console.log('Full response was:', fullResponse);
        throw new Error('Failed to extract prompt from Gemini response - no delimiters found');
    }
}

async function pollForResult(pollingUrl) {
    const maxAttempts = 30;
    const delay = 2000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
            const response = await fetch('/api/bfl-poll', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pollingUrl: pollingUrl
                })
            });
            
            const data = await response.json();
            console.log(`Poll attempt ${attempt + 1}:`, data);
            
            if (data.status === 'Ready' && data.result) {
                return data.result.sample;
            } else if (data.status === 'Error') {
                throw new Error(`BFL processing error: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            if (attempt === maxAttempts - 1) {
                throw new Error(`Polling failed: ${error.message}`);
            }
        }
    }
    
    throw new Error('Polling timed out - image generation took too long');
}

async function editImageWithKontext(base64Image, editPrompt) {
    const response = await fetch('/api/bfl', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            data: {
                prompt: editPrompt,
                input_image: base64Image,
                output_format: 'jpeg'
            }
        })
    });

    if (!response.ok) {
        throw new Error(`BFL API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('BFL response:', data);
    
    if (data.result) {
        return data.result.sample;
    } else if (data.polling_url) {
        return await pollForResult(data.polling_url);
    } else {
        throw new Error(`No result from BFL API. Response: ${JSON.stringify(data)}`);
    }
}

// Preferences management functions
function savePreferences() {
    try {
        localStorage.setItem('kontext-preferences', JSON.stringify(preferences));
        console.log('💾 Preferences saved:', {
            liked: preferences.liked.length,
            rejected: preferences.rejected.length,
            saved: preferences.saved.length
        });
    } catch (error) {
        console.error('❌ Error saving preferences:', error);
    }
}

function loadPreferences() {
    try {
        const stored = localStorage.getItem('kontext-preferences');
        if (stored) {
            preferences = JSON.parse(stored);
            console.log('📂 Preferences loaded:', {
                liked: preferences.liked.length,
                rejected: preferences.rejected.length,
                saved: preferences.saved.length
            });
        }
        
        // Load dating mode preference
        const datingModeStored = localStorage.getItem('kontext-dating-mode');
        if (datingModeStored !== null) {
            isDatingMode = datingModeStored === 'true';
            const datingModeToggle = document.getElementById('datingMode');
            if (datingModeToggle) {
                datingModeToggle.checked = isDatingMode;
                updateButtonLabels();
                console.log('💕 Dating mode preference restored:', isDatingMode);
            }
        }
    } catch (error) {
        console.error('❌ Error loading preferences:', error);
        // Reset to default if corrupted
        preferences = {
            liked: [],
            rejected: [],
            saved: []
        };
    }
}

function getPreferencesSummary() {
    return {
        totalInteractions: preferences.liked.length + preferences.rejected.length,
        likeRate: preferences.liked.length / (preferences.liked.length + preferences.rejected.length) || 0,
        saveRate: preferences.saved.length / (preferences.liked.length + preferences.rejected.length) || 0,
        preferences: preferences
    };
}

function updateCurrentPromptUI() {
    const currentPromptEl = document.getElementById('currentPrompt');
    if (!currentPromptEl || !currentCardData) return;
    
    currentPromptEl.textContent = currentCardData.prompt;
}

function updateQueueUI() {
    const queueList = document.getElementById('queueList');
    if (!queueList) return;
    
    queueList.innerHTML = '';
    
    // Show actual generated cards
    cardQueue.forEach((cardData) => {
        const queueItem = document.createElement('div');
        queueItem.className = 'queue-item';
        
        const img = document.createElement('img');
        img.src = cardData.editedUrl;
        img.alt = 'Queued image';
        img.loading = 'lazy';
        
        queueItem.appendChild(img);
        queueList.appendChild(queueItem);
    });
    
    // Add skeleton placeholders for remaining slots
    const remainingSlots = Math.max(0, 10 - cardQueue.length);
    for (let i = 0; i < remainingSlots; i++) {
        const skeletonItem = document.createElement('div');
        skeletonItem.className = 'queue-item skeleton';
        
        const skeletonImg = document.createElement('div');
        skeletonImg.className = 'skeleton-img';
        
        skeletonItem.appendChild(skeletonImg);
        queueList.appendChild(skeletonItem);
    }
}

function updateLovedUI() {
    const lovedList = document.getElementById('lovedList');
    const lovedSection = document.getElementById('lovedSection');
    if (!lovedList || !lovedSection) return;
    
    if (lovedItems.length === 0) {
        lovedSection.style.display = 'none';
        return;
    }
    
    lovedSection.style.display = 'block';
    lovedList.innerHTML = '';
    
    lovedItems.forEach((lovedItem) => {
        const img = document.createElement('img');
        img.className = 'loved-item';
        img.src = lovedItem.imageUrl;
        img.alt = 'Loved image';
        img.loading = 'lazy';
        img.title = lovedItem.prompt; // Show prompt on hover
        
        lovedList.appendChild(img);
    });
}

function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.85) {
    return new Promise((resolve, reject) => {
        // Check file size first
        const maxSize = 200 * 1024 * 1024; // 200MB absolute limit
        if (file.size > maxSize) {
            reject(new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please use an image smaller than 200MB.`));
            return;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
            
            // Set canvas size
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

function updateButtonLabels() {
    const rejectLabel = document.querySelector('.reject-btn .btn-label');
    const likeLabel = document.querySelector('.like-btn .btn-label');
    
    if (isDatingMode) {
        if (rejectLabel) rejectLabel.textContent = 'Pass';
        if (likeLabel) likeLabel.textContent = 'Match';
    } else {
        if (rejectLabel) rejectLabel.textContent = 'Skip';
        if (likeLabel) likeLabel.textContent = 'Love';
    }
}
