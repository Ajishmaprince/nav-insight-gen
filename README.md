# Route Genie

Got it — here's the updated version using frontend-only tech (HTML/CSS/JavaScript), with the ML/GenAI logic adapted to run client-side or via direct API calls instead of a Python backend:

Module 1 – Core AI Model (Frontend-Adapted) "Using a traffic dataset (e.g., UCI Metro Interstate Traffic Volume or a synthetic dataset with timestamp, location, weather, day-of-week, holiday, traffic volume), train a congestion prediction model in Python/Colab (Random Forest or XGBoost), then export it to run in the browser using TensorFlow.js (or convert the trained logic into a simplified JavaScript scoring function if a full model export isn't feasible for a mini project). Alternatively, precompute predictions for common route/time combinations and store them as a static JSON file (e.g., traffic_data.json) that the website reads client-side. Include the training/export script separately, but the final deliverable for the website is a JSON/JS-loadable model or dataset."

Module 2 – Generative AI Integration "On the frontend, use JavaScript fetch() to call the Claude API (or another LLM API) directly from the browser (or via a lightweight serverless function if direct browser calls aren't allowed, e.g., a Cloudflare Worker/Vercel edge function — still no traditional backend server). Given congestion scores for 2–3 alternate routes, send them to the LLM and get back a JSON response with a plain-language summary, the recommended route, and reasoning. Parse the response with JavaScript and render it dynamically in the UI. Add a try/catch fallback that picks the lowest-congestion route using plain JS logic if the API call fails."

Module 3 – Improve System Intelligence "In JavaScript, implement a Low/Medium/High congestion classifier using threshold logic on the predicted/stored values. Add input validation (valid time, valid origin/destination) with inline error messages on the form. Add a 'feedback' feature where users can mark whether actual traffic matched the prediction, storing this in localStorage (or a JSON file if simulating persistence) for later analysis. Use JS array/object methods (map, filter, reduce) to compute simple drift indicators, like comparing recent logged predictions to historical averages."

Module 4 – Website Deployment (Frontend Only) "Build a fully static website using HTML, CSS, and JavaScript (no backend server):

An input form for origin, destination, and travel time.

A results section showing predicted congestion level per route (color-coded: green/yellow/red), the recommended optimal route with the LLM-generated explanation, and a simple visual (e.g., a Leaflet.js map showing routes, or a Chart.js bar chart of congestion scores per route).

Clean file structure: index.html, style.css, script.js, traffic_data.json (precomputed predictions).

Responsive, well-organized UI (use frontend-design best practices — clear typography, spacing, color-coded congestion states).

Deployable directly on GitHub Pages/Netlify/Vercel since it's fully static. Ensure the site works end-to-end in the browser: user submits a query, JS looks up/predicts congestion, calls the LLM for recommendation, and renders the full result — no server required."

Want me to save this as a file, or is inline fine?

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nav-insight-gen.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8ae9a511-f2f0-480e-b050-2e90c4b8f6ad).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
