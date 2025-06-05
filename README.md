# Kontext Engine

A minimal AI-powered image transformation app with a Teenage Engineering-inspired interface. Upload a photo and generate creative transformations or romantic partner images using AI.

## Features

- **AI Image Analysis**: Uses Google Gemini 2.5 Flash to analyze uploaded images
- **Image Generation**: Powered by Black Forest Labs (BFL) Flux models
- **Two Modes**:
  - **Style Mode**: Creative transformations (Victorian inventor, watercolor painting, etc.)
  - **Dating Mode**: Generate romantic partner images with diverse AI-generated partners
- **Smart Compression**: Progressive image optimization for mobile compatibility
- **Minimal UI**: Clean, technical interface inspired by Teenage Engineering design
- **Mobile Optimized**: Touch-friendly buttons and responsive layout

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- API keys for:
  - [OpenRouter](https://openrouter.ai/) (for Google Gemini access)
  - [Black Forest Labs](https://api.bfl.ml/) (for image generation)

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/anjneymidha/kontexted.git
   cd kontexted
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   BFL_API_KEY=your_bfl_api_key_here
   PORT=3000
   ```

   **Getting API Keys:**
   
   - **OpenRouter**: Sign up at [openrouter.ai](https://openrouter.ai/), add credits, and copy your API key
   - **Black Forest Labs**: Sign up at [api.bfl.ml](https://api.bfl.ml/), add credits, and copy your API key

4. **Run the application**
   ```bash
   npm start
   ```

5. **Open in browser**
   
   Navigate to `http://localhost:3000`

## Usage

1. **Upload a photo** by clicking the upload button or camera icon
2. **Choose your mode** with the dating mode toggle
3. **Swipe or use buttons** to skip/love generated images
4. **Save images** you like with the download button
5. **View your liked images** in the top bar queue

## API Costs

- **OpenRouter (Gemini)**: ~$0.001-0.002 per image analysis
- **Black Forest Labs**: ~$0.04-0.12 per image generation
- **Total per image**: ~$0.05-0.15 depending on model and settings

## Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript, CSS, HTML
- **Backend**: Express.js server
- **APIs**: OpenRouter (Gemini) + Black Forest Labs (Flux)
- **Deployment**: Vercel-ready with serverless functions

### Image Processing
- Progressive compression (2MB → 800px → 512px → 400px)
- Smart quality reduction (50% → 30% → 20%)
- Mobile-optimized for large iPhone photos

### Security
- API keys stored server-side only
- CORS protection
- Request size limits (100MB max)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The app will be available at http://localhost:3000
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Other Platforms

The app works on any Node.js hosting platform:
- Railway
- Render
- Heroku
- DigitalOcean App Platform

Just ensure you set the environment variables and the platform supports Express.js.

## File Structure

```
├── index.html          # Main app interface
├── style.css           # Teenage Engineering-inspired styles
├── script.js           # Frontend logic and API calls
├── server.js           # Express server and API proxies
├── package.json        # Dependencies and scripts
├── vercel.json         # Vercel deployment config
└── .env               # API keys (create this)
```

## Troubleshooting

**"Payload too large" errors:**
- The app automatically compresses images, but very large files may still fail
- Try using smaller source images (< 50MB)

**API errors:**
- Check that your API keys are valid and have sufficient credits
- OpenRouter requires credits for Gemini access
- BFL requires credits for Flux image generation

**Server won't start:**
- Ensure all environment variables are set
- Check that the port (default 3000) isn't already in use
- Verify Node.js version is 14+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Credits

- Built with love for creative AI exploration
- Inspired by Teenage Engineering's minimal design philosophy
- Powered by cutting-edge AI models from Google and Black Forest Labs