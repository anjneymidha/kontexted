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
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
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

// Auto-process anj.jpg on page load
window.addEventListener('load', () => {
    loadPreferences();
    autoProcessImage();
});

// Keyboard controls
document.addEventListener('keydown', handleKeyPress);

async function autoProcessImage() {
    try {
        showLoading('Loading your photo...');
        
        const response = await fetch('/anj.jpg');
        originalImageBlob = await response.blob();
        
        // Clear existing data
        cardQueue = [];
        allPrompts = [];
        lovedItems = [];
        updateQueueUI();
        updateLovedUI();
        
        showLoading('AI analyzing your style...');
        // Generate first card
        const firstCard = await generateCardData();
        
        showLoading('Creating your perfect match...');
        createComparisonCard(URL.createObjectURL(originalImageBlob), firstCard.editedUrl, firstCard.prompt);
        hideLoading();
        
        // Start preloading next cards in background (don't wait for this)
        setTimeout(() => preloadNextCards(), 100);
        
    } catch (error) {
        console.error('Error auto-processing image:', error);
        hideLoading();
    }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        showLoading('Uploading your photo...');
        originalImageBlob = file;
        
        // Clear existing queue and prompts
        cardQueue = [];
        allPrompts = [];
        lovedItems = [];
        updateQueueUI();
        updateLovedUI();
        
        showLoading('AI analyzing your style...');
        const firstCard = await generateCardData();
        
        showLoading('Creating your perfect match...');
        createComparisonCard(URL.createObjectURL(file), firstCard.editedUrl, firstCard.prompt);
        hideLoading();
        
        // Start preloading next cards in background (don't wait for this)
        setTimeout(() => preloadNextCards(), 100);
        
    } catch (error) {
        console.error('Error processing image:', error);
        hideLoading();
        alert('Error processing image: ' + error.message);
    }
}

function createComparisonCard(originalUrl, editedUrl, prompt) {
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
    let startX, startY, currentX, currentY;
    
    // Mouse events
    card.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events
    card.addEventListener('touchstart', startDrag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', endDrag);
    
    function startDrag(e) {
        if (isDragging) return;
        isDragging = true;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        startX = clientX;
        startY = clientY;
        currentX = clientX;
        currentY = clientY;
        
        card.classList.add('dragging');
        e.preventDefault();
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        currentX = clientX;
        currentY = clientY;
        
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        const rotation = deltaX * 0.1;
        
        card.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
        
        // Show swipe indicators
        const opacity = Math.min(Math.abs(deltaX) / 100, 1);
        if (deltaX > 50) {
            card.classList.add('indicating-like');
            card.classList.remove('indicating-nope');
        } else if (deltaX < -50) {
            card.classList.add('indicating-nope');
            card.classList.remove('indicating-like');
        } else {
            card.classList.remove('indicating-like', 'indicating-nope');
        }
        
        e.preventDefault();
    }
    
    function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        
        const deltaX = currentX - startX;
        card.classList.remove('dragging', 'indicating-like', 'indicating-nope');
        
        if (Math.abs(deltaX) > 100) {
            // Swipe threshold reached
            const direction = deltaX > 0 ? 'right' : 'left';
            completeSwipe(card, direction);
        } else {
            // Snap back
            card.style.transform = '';
        }
    }
}

function swipeCard(direction) {
    if (currentCard) {
        completeSwipe(currentCard, direction);
    }
}

function completeSwipe(card, direction) {
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
    
    setTimeout(() => {
        card.remove();
        currentCard = null;
        currentCardData = null;
        
        // Show next card immediately from queue
        showNextCard();
    }, 300);
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
        const targetQueueSize = 15;
        const parallelGenerations = Math.min(3, targetQueueSize - cardQueue.length);
        
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
        
        // For mobile devices, try to save to camera roll
        if (navigator.share && navigator.canShare) {
            try {
                const response = await fetch(currentImageUrl);
                const blob = await response.blob();
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
                const response = await fetch(currentImageUrl);
                const blob = await response.blob();
                downloadImage(blob);
            }
        } else {
            // Desktop or unsupported browsers - download
            const response = await fetch(currentImageUrl);
            const blob = await response.blob();
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
                                text: 'Generate a unique, creative transformation for this image. Avoid superhero themes. Be original and diverse. Format your response exactly like this: $transformation description here$. Examples: $The person is now a Victorian-era inventor$ or $Transform into a watercolor painting$ or $The person is now in ancient Egypt$ or $Become a character from a Studio Ghibli film$ or $The person is now a medieval alchemist$.'
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