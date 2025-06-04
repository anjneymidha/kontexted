# Gemini API Configuration for Kontext Engine

## Current Setup
- **Model**: `google/gemini-2.5-flash-preview`  
- **Provider**: OpenRouter
- **API Key**: Configured in `.env` and `server.js`

## Working Configuration
The Gemini 2.5 Flash Preview model supports:
- ✅ Text generation
- ✅ Multimodal (vision) capabilities  
- ✅ $ delimiter formatting
- ✅ Creative prompt generation

## API Request Format
```javascript
{
  "model": "google/gemini-2.5-flash-preview",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text", 
          "text": "Describe a creative transformation for this image in one sentence. Format your response exactly like this: $transformation description here$. For example: $The person becomes a medieval knight$"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,..."
          }
        }
      ]
    }
  ],
  "max_tokens": 2000
}
```

## Response Processing
- Extract text between $ delimiters using regex: `/\$(.*?)\$/`
- If no delimiters found, log error and throw exception (no fallbacks)
- Pass extracted prompt to BFL Kontext API for image generation

## Testing Status
- ✅ Text-only requests work correctly
- ✅ Image+text multimodal requests work perfectly
- ✅ $ delimiter extraction working
- ✅ Creative prompt generation successful

## Test Results
**Sample Response**: `"$The darkness blossoms into a vibrant nebula teeming with stars$"`
- Model correctly analyzes images
- Follows $ delimiter format precisely  
- Generates creative, specific transformation prompts
- Token usage: ~292 prompt + ~12 completion tokens

## Integration Status
- ✅ OpenRouter API integration working
- ✅ Gemini model responding correctly
- ✅ $ delimiter extraction implemented  
- ✅ Ready for end-to-end testing in app