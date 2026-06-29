/* ==========================================================================
   HONESTLY BIASED - "PERSPECTIVE REFRACTION LENS" SHADER
   Effect: Performance-optimized Three.js GLSL Fragment Shader
   Concept: Bends and refracts standard facts (the background visual) to expose the 
            honest bias underneath. Includes chromatic prism aberration at the bevel.
   ========================================================================== */

const PerspectiveLens = {
    container: null,
    canvas: null,
    renderer: null,
    scene: null,
    camera: null,
    material: null,
    mesh: null,
    texture: null,
    
    // Core interaction tracking
    mouse: { x: 0.5, y: 0.5 },
    mouseSmooth: { x: 0.5, y: 0.5 },
    hoverState: { val: 0.0, target: 0.38 }, // Ambient float baseline (0.38)
    hasInteracted: false,
    
    // Shader custom variables
    lensRadius: 0.18, // Screen span width fraction
    refractionStrength: 0.16, // Pronounced fact bending
    tiltOffset: { x: 0, y: 0 },

    init() {
        this.container = document.getElementById('lens-canvas-container');
        if (!this.container) return;

        const textureSrc = this.container.getAttribute('data-src') || './assets/hero-bg.png';

        // 1. Initialize WebGL Context
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);
        this.canvas = this.renderer.domElement;

        // Hide structural fallback static image
        const fallbackImg = this.container.querySelector('.hero-fallback-img');
        if (fallbackImg) fallbackImg.style.display = 'none';

        // 2. Setup camera and flat canvas scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // 3. Load featured editorial asset texture
        const loader = new THREE.TextureLoader();
        loader.load(
            textureSrc,
            (texture) => {
                this.texture = texture;
                this.texture.minFilter = THREE.LinearFilter;
                this.texture.magFilter = THREE.LinearFilter;
                this.texture.generateMipmaps = false;
                
                this.setupShaderMesh();
                this.setupInteractionListeners();
                this.animate(0);
            },
            undefined,
            (err) => {
                console.error("Three.js Texture Loader encountered a loading error: ", err);
                if (fallbackImg) fallbackImg.style.display = 'block';
            }
        );
    },

    setupShaderMesh() {
        // Vertex Shader: Standard UV forwarding
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        // Fragment Shader: Bends fact visual to expose the subjective chromatic details
        const fragmentShader = `
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform vec2 u_mouse_smooth;
            uniform sampler2D u_texture;
            uniform float u_lens_radius;
            uniform float u_refraction;
            uniform float u_hover;
            
            varying vec2 vUv;

            void main() {
                // Correct for canvas aspect ratio to preserve strict circular coordinates
                vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                vec2 pixelPos = vUv * aspect;
                vec2 mousePos = u_mouse_smooth * aspect;
                
                float d = distance(pixelPos, mousePos);
                
                vec3 finalColor;

                if (d < u_lens_radius) {
                    float r = d / u_lens_radius;
                    
                    // 1. Refractive Magnification
                    // High warp factor in center, matching the visual concept of magnifying perspectives
                    float warp = 0.78 + 0.22 * r; 
                    vec2 dir = normalize(pixelPos - mousePos);
                    vec2 refractedUV = u_mouse_smooth + (dir / aspect) * (d * warp);
                    
                    refractedUV = clamp(refractedUV, 0.001, 0.999);

                    // 2. Chromatic Aberration
                    // Splits color channels into red/blue displacements near glass perimeter bevel (r ~ 1.0)
                    float abStrength = 0.016 * (1.0 - r) * r * u_hover;
                    vec2 abOffset = (dir / aspect) * abStrength;
                    
                    float rChan = texture2D(u_texture, clamp(refractedUV - abOffset, 0.001, 0.999)).r;
                    float gChan = texture2D(u_texture, refractedUV).g;
                    float bChan = texture2D(u_texture, clamp(refractedUV + abOffset, 0.001, 0.999)).b;
                    
                    finalColor = vec3(rChan, gChan, bChan);
                    
                    // 3. Dynamic Bevel Lighting (catch-lights matching neon theme highlights)
                    float edgeWidth = 0.014;
                    float specular = smoothstep(u_lens_radius - edgeWidth, u_lens_radius, d) * 
                                     smoothstep(u_lens_radius + edgeWidth, u_lens_radius, d);
                    
                    // Add catch-light rim
                    finalColor += vec3(specular * 0.18 * u_hover);

                    // Drop inner refract shadow
                    float innerShadow = smoothstep(u_lens_radius - 0.04, u_lens_radius, d);
                    finalColor -= vec3(innerShadow * 0.08 * u_hover);

                } else {
                    // Static baseline background outside the Perspective Lens
                    finalColor = texture2D(u_texture, vUv).rgb;
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        // 4. Create Custom Shader Material with active bindings
        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                u_resolution: { value: new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_mouse_smooth: { value: new THREE.Vector2(0.5, 0.5) },
                u_texture: { value: this.texture },
                u_lens_radius: { value: this.lensRadius },
                u_refraction: { value: this.refractionStrength },
                u_hover: { value: this.hoverState.val }
            },
            depthWrite: false,
            depthTest: false
        });

        // 5. Plane geometry
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.mesh);
    },

    setupInteractionListeners() {
        const handleMouseMove = (e) => {
            this.hasInteracted = true;
            this.hoverState.target = 1.0; // High warp mode on hover

            const rect = this.container.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = 1.0 - (e.clientY - rect.top) / rect.height; // Flip y axis

            this.mouse.x = x;
            this.mouse.y = y;
        };

        const handleMouseEnter = () => {
            this.hoverState.target = 1.0;
        };

        const handleMouseLeave = () => {
            this.hoverState.target = 0.38; // Recede to ambient float baseline
        };

        this.container.addEventListener('mousemove', handleMouseMove);
        this.container.addEventListener('mouseenter', handleMouseEnter);
        this.container.addEventListener('mouseleave', handleMouseLeave);

        // Mobile Device Gyroscope Tilt Integration
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (e) => {
                if (!e.beta || !e.gamma) return;
                
                this.hasInteracted = true;
                this.hoverState.target = 0.95; // Dynamic tilt-driven hover

                const gammaNorm = e.gamma / 45.0; 
                const betaNorm = (e.beta - 45.0) / 45.0; // Offset by reading standard comfort angle (45 deg)

                const maxOffset = 0.25;
                this.tiltOffset.x = Math.max(-maxOffset, Math.min(maxOffset, gammaNorm * 0.3));
                this.tiltOffset.y = Math.max(-maxOffset, Math.min(maxOffset, betaNorm * 0.3));

                this.mouse.x = 0.5 + this.tiltOffset.x;
                this.mouse.y = 0.5 - this.tiltOffset.y;
            });
        }

        // Dynamic Resize Handler
        window.addEventListener('resize', () => this.onResize());

        // Light/Dark Mode color/contrast compensations
        window.addEventListener('themeChanged', (e) => {
            const isDark = e.detail.theme === 'dark';
            if (isDark) {
                this.refractionStrength = 0.16;
            } else {
                this.refractionStrength = 0.14; // Slightly lower displacement scale for lighter text blocks
            }
            if (this.material) {
                this.material.uniforms.u_refraction.value = this.refractionStrength;
            }
        });
    },

    onResize() {
        if (!this.renderer || !this.material) return;
        
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        
        this.renderer.setSize(w, h);
        this.material.uniforms.u_resolution.value.set(w, h);

        // Responsive scaling bounds
        if (w < 600) {
            this.lensRadius = 0.26;
        } else {
            this.lensRadius = 0.18;
        }
        this.material.uniforms.u_lens_radius.value = this.lensRadius;
    },

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));

        if (!this.renderer || !this.material) return;

        // 1. Ambient orbit loop before user interactions
        // Breathes in a slow Lissajous curve to keep the hero section alive automatically
        if (!this.hasInteracted) {
            const speed = time * 0.0005;
            this.mouse.x = 0.5 + Math.sin(speed) * 0.18;
            this.mouse.y = 0.5 + Math.cos(speed * 0.8) * 0.12;
        }

        // 2. Linear Interpolations (Lerps) for organic inertia
        const lerpFactor = 0.08;
        this.mouseSmooth.x += (this.mouse.x - this.mouseSmooth.x) * lerpFactor;
        this.mouseSmooth.y += (this.mouse.y - this.mouseSmooth.y) * lerpFactor;

        // Lerp hover/dim transitions
        this.hoverState.val += (this.hoverState.target - this.hoverState.val) * 0.05;

        // 3. Update uniform bindings
        this.material.uniforms.u_mouse.value.copy(this.mouse);
        this.material.uniforms.u_mouse_smooth.value.copy(this.mouseSmooth);
        this.material.uniforms.u_hover.value = this.hoverState.val;

        // 4. Render Scene
        this.renderer.render(this.scene, this.camera);
    }
};

// Start upon DOM readiness
document.addEventListener('DOMContentLoaded', () => {
    PerspectiveLens.init();
});
