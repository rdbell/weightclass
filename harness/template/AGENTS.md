# Task

Build the 3D scene described in the user's message as a web page in this
directory. Work until you are satisfied with it; nobody will reply to
questions, so make your own decisions.

## Deliverable

- `index.html` in this directory is the entry point. It may load other files
  you create here (JavaScript modules, shaders, data). There is no build step:
  the page is opened as-is from a local web server.
- Use three.js from `vendor/three/` (read-only, version 0.187.0). Import it with
  an import map:

  ```html
  <script type="importmap">
  { "imports": {
      "three": "./vendor/three/build/three.module.js",
      "three/addons/": "./vendor/three/examples/jsm/"
  } }
  </script>
  ```

  Addons such as `three/addons/controls/OrbitControls.js` are available.
- No network access: no CDNs, fonts, textures or other files from the
  internet. Create textures and geometry in code.
- The page fills the browser window, resizes with it, and starts showing and
  animating the scene without any input. Mouse/touch interaction is welcome.
- Use seeded randomness so that two loads of the page look alike.

## Checking your work

Run `preview` in this directory to load the page in a headless browser. It
prints console errors and basic stats and saves a screenshot to
`.preview/screenshot.png`, which you can look at.
