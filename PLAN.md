# D3: {Garden of Bits}

Game Design Vision: A map-based crafting game where players walk around patches of soil (grid cells), collecting and combining seeds into larger plants. Seeds upgrade along the chain: 1 → 2 → 4 → 8 → 16 → 32 → 64 → 128 → 256.
When a player grows a 256-value, the game is won.

Technologies:

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Assemble a Leaflet map UI and render grid cells with visible plant-token contents
Key gameplay challenge: Enable picking up, combining, and crafting seeds up to the win threshold.

### Steps

- [x] put a basic leaflet map on the screen
- [x] Define grid cell dimensions (0.0001°)
- [x] Implement deterministic hash to assign seed presence/value
- [x] Display token value using plant emoji directly in the cell
- [x] Add click handler for cell interaction
- [x] Add inventory: hold 0 or 1 seed
- [x] Update UI to show held seed value
- [x] Implement “pick up seed” action
- [x] Implement “combine if equal → grow doubled seed” action
- [x] Win detection when hand contains value ≥ 256
- [x] Fix holding plants
- [x] Popup messages
- [x] Show a message when the plant is far
