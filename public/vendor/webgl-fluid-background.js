// @ts-nocheck
/*
MIT License

Copyright (c) 2017 Pavel Dobryakov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict';

// Adapted for Personal_Homepage opening scene. Original MIT source:
// Pavel Dobryakov WebGL Fluid Simulation, reused by SimonAKing/HomePage.
const defaultFluidConfig = {
	PIXEL_RATIO_CAP: 1.5,
	SIM_RESOLUTION: 128,
	DYE_RESOLUTION: 1024,
	CAPTURE_RESOLUTION: 512,
	DENSITY_DISSIPATION: 1,
	VELOCITY_DISSIPATION: 0.2,
	PRESSURE: 0.8,
	PRESSURE_ITERATIONS: 20,
	CURL: 30,
	SPLAT_RADIUS: 0.25,
	SPLAT_FORCE: 6000,
	SHADING: true,
	COLORFUL: true,
	COLOR_UPDATE_SPEED: 10,
	PAUSED: false,
	BACK_COLOR: { r: 0, g: 0, b: 0 },
	TRANSPARENT: false,
	BLOOM: true,
	BLOOM_ITERATIONS: 8,
	BLOOM_RESOLUTION: 256,
	BLOOM_INTENSITY: 0.4,
	BLOOM_THRESHOLD: 0.8,
	BLOOM_SOFT_KNEE: 0.7,
	SUNRAYS: true,
	SUNRAYS_RESOLUTION: 196,
	SUNRAYS_WEIGHT: 1,
	RENDER_QUALITY: 'balanced',
	RUNTIME_QUALITY_FALLBACK: null,
	RUNTIME_QUALITY_WARMUP_FRAMES: 12,
	RUNTIME_QUALITY_SAMPLE_FRAMES: 40,
	RUNTIME_QUALITY_MEDIAN_THRESHOLD_MS: 24,
	RUNTIME_QUALITY_P90_THRESHOLD_MS: 42
};
window.config = Object.assign({}, defaultFluidConfig, window.config || {});
window.switchPage = window.switchPage || { switched: false };

if (!window.visibilityChangeEvent) {
	if (typeof document.hidden !== 'undefined') {
		window.visibilityChangeEvent = 'visibilitychange';
	} else if (typeof document.msHidden !== 'undefined') {
		window.visibilityChangeEvent = 'msvisibilitychange';
	} else if (typeof document.webkitHidden !== 'undefined') {
		window.visibilityChangeEvent = 'webkitvisibilitychange';
	} else {
		window.visibilityChangeEvent = 'visibilitychange';
	}
}

const canvas = document.querySelector('[data-webgl-fluid-background]') || document.getElementById('background');
if (!canvas) {
	throw new Error('WebGL fluid background canvas missing.');
}
resizeCanvas();

function pointerPrototype() {
	this.id = -1;
	this.texcoordX = 0;
	this.texcoordY = 0;
	this.prevTexcoordX = 0;
	this.prevTexcoordY = 0;
	this.deltaX = 0;
	this.deltaY = 0;
	this.down = false;
	this.moved = false;
	this.color = [30, 0, 300];
}

let pointers = [];
let splatStack = [];
pointers.push(new pointerPrototype());

const { gl, ext } = getWebGLContext(canvas);

if (isMobile()) {
	config.DYE_RESOLUTION = Math.min(config.DYE_RESOLUTION, 512);
}
if (!ext.supportLinearFiltering) {
	config.DYE_RESOLUTION = 512;
	config.SHADING = false;
	config.BLOOM = false;
	config.SUNRAYS = false;
}

function getWebGLContext(canvas) {
	const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };

	let gl = canvas.getContext('webgl2', params);
	const isWebGL2 = !!gl;
	if (!isWebGL2)
		gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);

	let halfFloat;
	let supportLinearFiltering;
	if (isWebGL2) {
		gl.getExtension('EXT_color_buffer_float');
		supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
	} else {
		halfFloat = gl.getExtension('OES_texture_half_float');
		supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
	}

	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
	let formatRGBA;
	let formatRG;
	let formatR;

	if (isWebGL2) {
		formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
		formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
		formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
	}
	else {
		formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
		formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
		formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
	}

	return {
		gl,
		ext: {
			formatRGBA,
			formatRG,
			formatR,
			halfFloatTexType,
			supportLinearFiltering
		}
	};
}

function getSupportedFormat(gl, internalFormat, format, type) {
	if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
		switch (internalFormat) {
			case gl.R16F:
				return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
			case gl.RG16F:
				return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
			default:
				return null;
		}
	}

	return {
		internalFormat,
		format
	}
}

function supportRenderTextureFormat(gl, internalFormat, format, type) {
	let texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

	let fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	return status == gl.FRAMEBUFFER_COMPLETE;
}

function isMobile() {
	return /Mobi|Android/i.test(navigator.userAgent);
}

class Material {
	constructor(vertexShader, fragmentShaderSource) {
		this.vertexShader = vertexShader;
		this.fragmentShaderSource = fragmentShaderSource;
		this.programs = [];
		this.activeProgram = null;
		this.uniforms = [];
	}

	setKeywords(keywords) {
		let hash = 0;
		for (let i = 0; i < keywords.length; i++)
			hash += hashCode(keywords[i]);

		let program = this.programs[hash];
		if (program == null) {
			let fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
			program = createProgram(this.vertexShader, fragmentShader);
			this.programs[hash] = program;
		}

		if (program == this.activeProgram) return;

		this.uniforms = getUniforms(program);
		this.activeProgram = program;
	}

	bind() {
		gl.useProgram(this.activeProgram);
	}
}

class Program {
	constructor(vertexShader, fragmentShader) {
		this.uniforms = {};
		this.program = createProgram(vertexShader, fragmentShader);
		this.uniforms = getUniforms(this.program);
	}

	bind() {
		gl.useProgram(this.program);
	}
}

function createProgram(vertexShader, fragmentShader) {
	let program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		throw gl.getProgramInfoLog(program);

	return program;
}

function getUniforms(program) {
	let uniforms = [];
	let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	for (let i = 0; i < uniformCount; i++) {
		let uniformName = gl.getActiveUniform(program, i).name;
		uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
	}
	return uniforms;
}

function compileShader(type, source, keywords) {
	source = addKeywords(source, keywords);

	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
		throw gl.getShaderInfoLog(shader);

	return shader;
};

function addKeywords(source, keywords) {
	if (keywords == null) return source;
	let keywordsString = '';
	keywords.forEach(keyword => {
		keywordsString += '#define ' + keyword + '\n';
	});
	return keywordsString + source;
}

const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`);

const blurVertexShader = compileShader(gl.VERTEX_SHADER, `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        float offset = 1.33333333;
        vL = vUv - texelSize * offset;
        vR = vUv + texelSize * offset;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`);

const blurShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform sampler2D uTexture;

    void main () {
        vec4 sum = texture2D(uTexture, vUv) * 0.29411764;
        sum += texture2D(uTexture, vL) * 0.35294117;
        sum += texture2D(uTexture, vR) * 0.35294117;
        gl_FragColor = sum;
    }
`);

const copyShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        gl_FragColor = texture2D(uTexture, vUv);
    }
`);

const clearShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;

    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`);

const transitionVelocityShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform float aspectRatio;
    uniform float progress;
    uniform float dt;
    uniform vec2 transitionCenter;

    void main () {
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        vec2 offset = vUv - transitionCenter;
        vec2 physicalOffset = vec2(offset.x * aspectRatio, offset.y);
        float distanceToCenter = max(length(physicalOffset), 0.001);
        vec2 radial = physicalOffset / distanceToCenter;
        vec2 clockwise = vec2(radial.y, -radial.x);
        clockwise.x /= aspectRatio;
        radial.x /= aspectRatio;

        float spiralProgress = smoothstep(0.0, 0.92, progress);
        float farZone = smoothstep(0.42, 1.08, distanceToCenter);
        float centerDamping = smoothstep(0.035, 0.18, distanceToCenter);
        float captureZone = 1.0 - smoothstep(0.045, 0.16, distanceToCenter);
        float captureProgress = smoothstep(0.18, 0.88, progress);
        velocity *= 1.0 - captureZone * captureProgress * 0.06;
        float swirlStrength = mix(720.0, 300.0, spiralProgress) * mix(1.04, 0.66, farZone);
        float sinkStrength = mix(740.0, 2050.0, spiralProgress) * mix(0.94, 1.22, farZone);
        vec2 force = clockwise * swirlStrength + (-radial) * sinkStrength;
        force *= centerDamping * mix(0.92, 1.08, farZone);
        velocity += force * dt;

        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`);

const colorShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;

    uniform vec4 color;

    void main () {
        gl_FragColor = color;
    }
`);

const checkerboardShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float aspectRatio;

    #define SCALE 25.0

    void main () {
        vec2 uv = floor(vUv * SCALE * vec2(aspectRatio, 1.0));
        float v = mod(uv.x + uv.y, 2.0);
        v = v * 0.1 + 0.8;
        gl_FragColor = vec4(vec3(v), 1.0);
    }
`);

const displayShaderSource = `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform sampler2D uBloom;
    uniform sampler2D uSunrays;
    uniform sampler2D uDithering;
    uniform vec2 ditherScale;
    uniform vec2 texelSize;
    uniform float transitionActive;
    uniform float transitionProgress;
    uniform float transitionAspectRatio;
    uniform vec2 transitionCenter;
    uniform vec3 transitionBackground;

    vec3 linearToGamma (vec3 color) {
        color = max(color, vec3(0));
        return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
    }

    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;

    #ifdef SHADING
        vec3 lc = texture2D(uTexture, vL).rgb;
        vec3 rc = texture2D(uTexture, vR).rgb;
        vec3 tc = texture2D(uTexture, vT).rgb;
        vec3 bc = texture2D(uTexture, vB).rgb;

        float dx = length(rc) - length(lc);
        float dy = length(tc) - length(bc);

        vec3 n = normalize(vec3(dx, dy, length(texelSize)));
        vec3 l = vec3(0.0, 0.0, 1.0);

        float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
        c *= diffuse;
    #endif

    #ifdef BLOOM
        vec3 bloom = texture2D(uBloom, vUv).rgb;
    #endif

    #ifdef SUNRAYS
        float sunrays = texture2D(uSunrays, vUv).r;
        c *= sunrays;
    #ifdef BLOOM
        bloom *= sunrays;
    #endif
    #endif

    #ifdef BLOOM
        float noise = texture2D(uDithering, vUv * ditherScale).r;
        noise = noise * 2.0 - 1.0;
        bloom += noise / 255.0;
        bloom = linearToGamma(bloom);
        c += bloom;
    #endif

        float a = max(c.r, max(c.g, c.b));
        if (transitionActive > 0.5) {
            vec2 centered = vUv - transitionCenter;
            vec2 physical = vec2(centered.x * transitionAspectRatio, centered.y);
            float distanceToCenter = length(physical);
            float materialReveal = smoothstep(0.1, 0.42, transitionProgress);
            float densityReveal = smoothstep(0.12, 0.62, transitionProgress);
            float guidedReveal = smoothstep(0.85, 0.98, transitionProgress);
            float shrink = smoothstep(0.82, 0.99, transitionProgress);
            vec2 furthestAxis = vec2(
                max(transitionCenter.x, 1.0 - transitionCenter.x) * transitionAspectRatio,
                max(transitionCenter.y, 1.0 - transitionCenter.y)
            );
            float maximumRadius = length(furthestAxis) + 0.08;
            float radius = mix(maximumRadius, 0.0, shrink);
            float spatialMask = 1.0 - smoothstep(radius - 0.18, radius + 0.18, distanceToCenter);
            float fluidPresence = smoothstep(0.008, 0.105, a);
            float densityMask = mix(1.0, fluidPresence, densityReveal);
            float safetyEnvelope = max(spatialMask, fluidPresence * 0.55);
            float guidedMask = mix(1.0, safetyEnvelope, guidedReveal);
            float finalFade = 1.0 - smoothstep(0.95, 1.0, transitionProgress);
            float alpha = densityMask * guidedMask * finalFade;
            vec3 transitionColor = c + transitionBackground * (1.0 - materialReveal);
            gl_FragColor = vec4(transitionColor * alpha, alpha);
        }
        else {
            gl_FragColor = vec4(c, a);
        }
    }
`;

const bloomPrefilterShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec3 curve;
    uniform float threshold;

    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        float br = max(c.r, max(c.g, c.b));
        float rq = clamp(br - curve.x, 0.0, curve.y);
        rq = curve.z * rq * rq;
        c *= max(rq, br - threshold) / max(br, 0.0001);
        gl_FragColor = vec4(c, 0.0);
    }
`);

const bloomBlurShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;

    void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(uTexture, vL);
        sum += texture2D(uTexture, vR);
        sum += texture2D(uTexture, vT);
        sum += texture2D(uTexture, vB);
        sum *= 0.25;
        gl_FragColor = sum;
    }
`);

const bloomFinalShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform float intensity;

    void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(uTexture, vL);
        sum += texture2D(uTexture, vR);
        sum += texture2D(uTexture, vT);
        sum += texture2D(uTexture, vB);
        sum *= 0.25;
        gl_FragColor = sum * intensity;
    }
`);

const sunraysMaskShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        vec4 c = texture2D(uTexture, vUv);
        float br = max(c.r, max(c.g, c.b));
        c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
        gl_FragColor = c;
    }
`);

const sunraysShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float weight;

    #define ITERATIONS 16

    void main () {
        float Density = 0.3;
        float Decay = 0.95;
        float Exposure = 0.7;

        vec2 coord = vUv;
        vec2 dir = vUv - 0.5;

        dir *= 1.0 / float(ITERATIONS) * Density;
        float illuminationDecay = 1.0;

        float color = texture2D(uTexture, vUv).a;

        for (int i = 0; i < ITERATIONS; i++)
        {
            coord -= dir;
            float col = texture2D(uTexture, coord).a;
            color += col * illuminationDecay * weight;
            illuminationDecay *= Decay;
        }

        gl_FragColor = vec4(color * Exposure, 0.0, 0.0, 1.0);
    }
`);

const splatShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;

    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
    }
`);

const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;

        vec2 iuv = floor(st);
        vec2 fuv = fract(st);

        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
    #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
    #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
    }`,
	ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']
);

const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;

        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; }
        if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; }
        if (vB.y < 0.0) { B = -C.y; }

        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
`);

const curlShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
`);

const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;

    void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;

        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;

        vec2 vel = texture2D(uVelocity, vUv).xy;
        gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
    }
`);

const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`);

const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`);

const blit = (() => {
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(0);

	return (destination) => {
		gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
		gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	}
})();

let dye;
let velocity;
let divergence;
let curl;
let pressure;
let bloom;
let bloomFramebuffers = [];
let sunrays;
let sunraysTemp;

let vendorAssetBase = (() => {
	let currentScript = document.currentScript;
	let source = currentScript && currentScript.src ? currentScript.src : '/vendor/webgl-fluid-background.js';
	return source.slice(0, source.lastIndexOf('/') + 1);
})();

let ditheringTexture = createTextureAsync(`${vendorAssetBase}background.png`);

const blurProgram = new Program(blurVertexShader, blurShader);
const copyProgram = new Program(baseVertexShader, copyShader);
const clearProgram = new Program(baseVertexShader, clearShader);
const transitionVelocityProgram = new Program(baseVertexShader, transitionVelocityShader);
const colorProgram = new Program(baseVertexShader, colorShader);
const checkerboardProgram = new Program(baseVertexShader, checkerboardShader);
const bloomPrefilterProgram = new Program(baseVertexShader, bloomPrefilterShader);
const bloomBlurProgram = new Program(baseVertexShader, bloomBlurShader);
const bloomFinalProgram = new Program(baseVertexShader, bloomFinalShader);
const sunraysMaskProgram = new Program(baseVertexShader, sunraysMaskShader);
const sunraysProgram = new Program(baseVertexShader, sunraysShader);
const splatProgram = new Program(baseVertexShader, splatShader);
const advectionProgram = new Program(baseVertexShader, advectionShader);
const divergenceProgram = new Program(baseVertexShader, divergenceShader);
const curlProgram = new Program(baseVertexShader, curlShader);
const vorticityProgram = new Program(baseVertexShader, vorticityShader);
const pressureProgram = new Program(baseVertexShader, pressureShader);
const gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);

const displayMaterial = new Material(baseVertexShader, displayShaderSource);

function initFramebuffers() {
	let simRes = getResolution(config.SIM_RESOLUTION);
	let dyeRes = getResolution(config.DYE_RESOLUTION);

	const texType = ext.halfFloatTexType;
	const rgba = ext.formatRGBA;
	const rg = ext.formatRG;
	const r = ext.formatR;
	const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

	if (dye == null)
		dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
	else
		dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);

	if (velocity == null)
		velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
	else
		velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);

	divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
	curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
	pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);

	if (config.BLOOM) initBloomFramebuffers();
	if (config.SUNRAYS) initSunraysFramebuffers();
}

function initBloomFramebuffers() {
	let res = getResolution(config.BLOOM_RESOLUTION);

	const texType = ext.halfFloatTexType;
	const rgba = ext.formatRGBA;
	const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

	bloom = createFBO(res.width, res.height, rgba.internalFormat, rgba.format, texType, filtering);

	bloomFramebuffers.length = 0;
	for (let i = 0; i < config.BLOOM_ITERATIONS; i++) {
		let width = res.width >> (i + 1);
		let height = res.height >> (i + 1);

		if (width < 2 || height < 2) break;

		let fbo = createFBO(width, height, rgba.internalFormat, rgba.format, texType, filtering);
		bloomFramebuffers.push(fbo);
	}
}

function initSunraysFramebuffers() {
	let res = getResolution(config.SUNRAYS_RESOLUTION);

	const texType = ext.halfFloatTexType;
	const r = ext.formatR;
	const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

	sunrays = createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
	sunraysTemp = createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
}

function createFBO(w, h, internalFormat, format, type, param) {
	gl.activeTexture(gl.TEXTURE0);
	let texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

	let fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.viewport(0, 0, w, h);
	gl.clear(gl.COLOR_BUFFER_BIT);

	let texelSizeX = 1.0 / w;
	let texelSizeY = 1.0 / h;

	return {
		texture,
		fbo,
		width: w,
		height: h,
		texelSizeX,
		texelSizeY,
		attach(id) {
			gl.activeTexture(gl.TEXTURE0 + id);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			return id;
		}
	};
}

function createDoubleFBO(w, h, internalFormat, format, type, param) {
	let fbo1 = createFBO(w, h, internalFormat, format, type, param);
	let fbo2 = createFBO(w, h, internalFormat, format, type, param);

	return {
		width: w,
		height: h,
		texelSizeX: fbo1.texelSizeX,
		texelSizeY: fbo1.texelSizeY,
		get read() {
			return fbo1;
		},
		set read(value) {
			fbo1 = value;
		},
		get write() {
			return fbo2;
		},
		set write(value) {
			fbo2 = value;
		},
		swap() {
			let temp = fbo1;
			fbo1 = fbo2;
			fbo2 = temp;
		}
	}
}

function resizeFBO(target, w, h, internalFormat, format, type, param) {
	let newFBO = createFBO(w, h, internalFormat, format, type, param);
	copyProgram.bind();
	gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
	blit(newFBO.fbo);
	return newFBO;
}

function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
	if (target.width == w && target.height == h)
		return target;
	target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
	target.write = createFBO(w, h, internalFormat, format, type, param);
	target.width = w;
	target.height = h;
	target.texelSizeX = 1.0 / w;
	target.texelSizeY = 1.0 / h;
	return target;
}

function createTextureAsync(url) {
	let texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));

	let obj = {
		texture,
		width: 1,
		height: 1,
		attach(id) {
			gl.activeTexture(gl.TEXTURE0 + id);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			return id;
		}
	};

	let image = new Image();
	image.onload = () => {
		obj.width = image.width;
		obj.height = image.height;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
	};
	image.src = url;

	return obj;
}

function updateKeywords() {
	let displayKeywords = [];
	if (config.SHADING) displayKeywords.push("SHADING");
	if (config.BLOOM) displayKeywords.push("BLOOM");
	if (config.SUNRAYS) displayKeywords.push("SUNRAYS");
	displayMaterial.setKeywords(displayKeywords);
}

let lastUpdateTime = Date.now();
let colorUpdateTimer = 0.0;
let fluidTransition = null;
const runtimeQualityProbe = {
	downgraded: false,
	evaluated: false,
	frameCount: 0,
	lastFrameAt: null,
	samples: []
};

const defaultTransitionTimeline = {
	surgeEnd: 0.22,
	vortexEnd: 0.56,
	absorbEnd: 0.88
};

function clamp01(value) {
	return Math.min(1, Math.max(0, value));
}

function smoothProgress(value) {
	const normalized = clamp01(value);
	return normalized * normalized * (3 - 2 * normalized);
}

function normalizeTransitionSinkPoint(sinkPoint) {
	const requestedX = Number(sinkPoint?.x);
	const requestedY = Number(sinkPoint?.y);
	return {
		x: clamp01(Number.isFinite(requestedX) ? requestedX : 0.5),
		y: clamp01(Number.isFinite(requestedY) ? requestedY : 0.5)
	};
}

function updateTransitionSinkPoint(state, sinkPoint) {
	if (!state || state.completed) return;
	state.sinkPoint = normalizeTransitionSinkPoint(sinkPoint);
	canvas.dataset.fluidTransitionSinkX = state.sinkPoint.x.toFixed(4);
	canvas.dataset.fluidTransitionSinkY = state.sinkPoint.y.toFixed(4);
}

function createSeededTransitionRandom(seed) {
	let value = seed >>> 0;
	return () => {
		value = (value * 1664525 + 1013904223) >>> 0;
		return value / 4294967296;
	};
}

function resolveFluidTransitionPhase(progress, timeline) {
	if (progress >= 1) return 'done';
	if (progress >= timeline.absorbEnd) return 'reveal';
	if (progress >= timeline.vortexEnd) return 'absorb';
	if (progress >= timeline.surgeEnd) return 'vortex';
	return 'surge';
}

function getInjectedTransitionCount(progress, total, surgeEnd) {
	if (total <= 0 || progress <= 0) return 0;
	const normalized = clamp01(progress / surgeEnd);
	return Math.min(total, Math.floor(smoothProgress(normalized) * total + Number.EPSILON));
}

function invokeTransitionCallback(callback, value) {
	if (typeof callback !== 'function') return;
	try {
		callback(value);
	}
	catch (error) {
		console.error('Fluid transition callback failed.', error);
	}
}

function injectTransitionSplat(state, index) {
	const edgeCount = Math.round(state.injectionCount * 0.55);
	let x;
	let y;
	if (index < edgeCount) {
		const edge = index % 4;
		const alongEdge = 0.06 + state.random() * 0.88;
		const inset = 0.055 + state.random() * 0.065;
		if (edge === 0) {
			x = alongEdge;
			y = 1 - inset;
		}
		else if (edge === 1) {
			x = 1 - inset;
			y = alongEdge;
		}
		else if (edge === 2) {
			x = alongEdge;
			y = inset;
		}
		else {
			x = inset;
			y = alongEdge;
		}
	}
	else {
		x = 0.12 + state.random() * 0.76;
		y = 0.12 + state.random() * 0.76;
		if (Math.hypot(x - state.sinkPoint.x, y - state.sinkPoint.y) < 0.19) {
			x = x < state.sinkPoint.x
				? Math.max(0.12, state.sinkPoint.x - 0.28)
				: Math.min(0.88, state.sinkPoint.x + 0.28);
			y = y < state.sinkPoint.y
				? Math.max(0.12, state.sinkPoint.y - 0.28)
				: Math.min(0.88, state.sinkPoint.y + 0.28);
		}
	}

	const aspectRatio = canvas.width / Math.max(1, canvas.height);
	const offsetX = (x - state.sinkPoint.x) * aspectRatio;
	const offsetY = y - state.sinkPoint.y;
	const distance = Math.max(0.001, Math.hypot(offsetX, offsetY));
	const radialX = offsetX / distance;
	const radialY = offsetY / distance;
	const clockwiseX = radialY / aspectRatio;
	const clockwiseY = -radialX;
	const inwardX = -radialX / aspectRatio;
	const inwardY = -radialY;
	const farMix = clamp01((distance - 0.28) / 0.82);
	const clockwiseWeight = 0.72 - farMix * 0.26;
	const inwardWeight = 0.74 + farMix * 0.2;
	const force = 860 + state.random() * 520;
	const dx = (clockwiseX * clockwiseWeight + inwardX * inwardWeight) * force;
	const dy = (clockwiseY * clockwiseWeight + inwardY * inwardWeight) * force;
	const color = generateColor();
	const colorBoost = 6.5 + state.random() * 3.5;
	color.r *= colorBoost;
	color.g *= colorBoost;
	color.b *= colorBoost;
	splat(x, y, dx, dy, color);
}

function updateFluidTransition(now) {
	const state = fluidTransition;
	if (!state) return null;
	state.progress = clamp01((now - state.startedAt) / state.duration);
	const targetInjectedCount = getInjectedTransitionCount(
		state.progress,
		state.injectionCount,
		state.timeline.surgeEnd
	);
	while (state.injectedCount < targetInjectedCount) {
		injectTransitionSplat(state, state.injectedCount);
		state.injectedCount += 1;
	}

	const phase = resolveFluidTransitionPhase(state.progress, state.timeline);
	if (phase !== state.phase) {
		state.phase = phase;
		canvas.dataset.fluidTransitionPhase = phase;
		invokeTransitionCallback(state.onPhaseChange, phase);
	}
	canvas.dataset.fluidTransitionProgress = state.progress.toFixed(4);
	canvas.dataset.fluidTransitionInjectedCount = String(state.injectedCount);
	invokeTransitionCallback(state.onProgress, state.progress);
	return state;
}

function percentile(values, percentileValue) {
	const index = Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1);
	return values[Math.max(0, index)] || 0;
}

function applyRuntimeQualityFallback(median, p90) {
	const fallback = config.RUNTIME_QUALITY_FALLBACK;
	runtimeQualityProbe.evaluated = true;
	canvas.dataset.fluidRuntimeMedianMs = median.toFixed(1);
	canvas.dataset.fluidRuntimeP90Ms = p90.toFixed(1);
	canvas.dataset.fluidRuntimeProbeState = 'complete';
	if (!fallback || runtimeQualityProbe.downgraded) return;

	const medianThreshold = Number(config.RUNTIME_QUALITY_MEDIAN_THRESHOLD_MS) || 24;
	const p90Threshold = Number(config.RUNTIME_QUALITY_P90_THRESHOLD_MS) || 42;
	if (median <= medianThreshold && p90 <= p90Threshold) return;

	config.PRESSURE_ITERATIONS = Math.max(1, Number(fallback.PRESSURE_ITERATIONS) || config.PRESSURE_ITERATIONS);
	config.BLOOM_ITERATIONS = Math.max(2, Number(fallback.BLOOM_ITERATIONS) || config.BLOOM_ITERATIONS);
	config.SUNRAYS = fallback.SUNRAYS !== false;
	runtimeQualityProbe.downgraded = true;
	canvas.dataset.fluidEffectiveQuality = fallback.quality || 'low';
	canvas.dataset.fluidQualityDowngraded = 'true';
	updateKeywords();
}

function sampleRuntimeQuality(now) {
	if (runtimeQualityProbe.evaluated || config.PAUSED || !config.RUNTIME_QUALITY_FALLBACK) return;
	if (runtimeQualityProbe.lastFrameAt === null) {
		runtimeQualityProbe.lastFrameAt = now;
		return;
	}

	const frameDuration = now - runtimeQualityProbe.lastFrameAt;
	runtimeQualityProbe.lastFrameAt = now;
	if (fluidTransition || frameDuration <= 0 || frameDuration > 250) return;

	const warmupFrames = Math.max(0, Number(config.RUNTIME_QUALITY_WARMUP_FRAMES) || 12);
	if (runtimeQualityProbe.frameCount < warmupFrames) {
		runtimeQualityProbe.frameCount += 1;
		return;
	}

	const sampleFrames = Math.max(1, Number(config.RUNTIME_QUALITY_SAMPLE_FRAMES) || 40);
	runtimeQualityProbe.samples.push(frameDuration);
	canvas.dataset.fluidRuntimeProbeState = 'sampling';
	if (runtimeQualityProbe.samples.length < sampleFrames) return;

	const samples = runtimeQualityProbe.samples.slice(-sampleFrames).sort((left, right) => left - right);
	applyRuntimeQualityFallback(percentile(samples, 0.5), percentile(samples, 0.9));
}

function finishFluidTransition(state) {
	if (!state || fluidTransition !== state || state.completed) return;
	state.completed = true;
	canvas.dataset.fluidTransitionState = 'done';
	canvas.dataset.fluidTransitionPhase = 'done';
	canvas.dataset.fluidTransitionProgress = '1.0000';
	fluidTransition = null;
	invokeTransitionCallback(state.onPhaseChange, 'done');
	invokeTransitionCallback(state.onComplete);
}

const changeColor = () => {
	const content = document.querySelector('.content-inner');
	const shape = document.querySelector('.shape');
	if (content) content.style.background = 'unset';
	if (shape) shape.style.fill = '#1e1f21';
}

const initBackground = () => {
	if (initBackground.loaded) {
		return
	}
	initBackground.loaded = true
	if (window.switchPage?.switched) {
		stopped = true
		canvas.dataset.fluidRenderState = 'stopped'
		return
	}
	stopped = false
	canvas.dataset.fluidRenderState = 'running'
	canvas.dataset.fluidTransitionState = canvas.dataset.fluidTransitionState || 'idle'
	canvas.dataset.fluidTransitionPhase = canvas.dataset.fluidTransitionPhase || 'idle'
	canvas.dataset.fluidTransitionInjectedCount = canvas.dataset.fluidTransitionInjectedCount || '0'
	canvas.dataset.fluidEffectiveQuality = config.RENDER_QUALITY || 'balanced'
	canvas.dataset.fluidQualityDowngraded = 'false'
	canvas.dataset.fluidRuntimeProbeState = config.RUNTIME_QUALITY_FALLBACK ? 'warming' : 'disabled'
	changeColor()
	updateKeywords();
	initFramebuffers();
	multipleSplats(parseInt(Math.random() * 20) + 5);
	update(true)
}

window.addEventListener('DOMContentLoaded', initBackground)
let animationID = null
let stopped = false

if (document.readyState !== 'loading') {
	window.requestAnimationFrame(initBackground);
}

window.__stopWebglFluidBackground = () => {
	stopped = true
	if (animationID) {
		cancelAnimationFrame(animationID);
		animationID = null;
	}
	canvas.dataset.fluidRenderState = 'stopped'
};

window.__startWebglFluidTransition = (options = {}) => {
	if (!initBackground.loaded || stopped || config.PAUSED) return null;
	const duration = Math.max(600, Number(options.duration) || 2600);
	const injectionCount = Math.max(1, Math.round(Number(options.injectionCount) || 10));
	const sinkPoint = normalizeTransitionSinkPoint(options.sinkPoint);
	const timeline = Object.assign({}, defaultTransitionTimeline, options.timeline || {});
	const state = {
		startedAt: performance.now(),
		duration,
		injectionCount,
		injectedCount: 0,
		sinkPoint,
		progress: 0,
		phase: 'surge',
		completed: false,
		random: createSeededTransitionRandom((canvas.width * 73856093) ^ (canvas.height * 19349663) ^ injectionCount),
		timeline,
		onProgress: options.onProgress,
		onPhaseChange: options.onPhaseChange,
		onComplete: options.onComplete
	};
	fluidTransition = state;
	canvas.dataset.fluidTransitionState = 'running';
	canvas.dataset.fluidTransitionPhase = 'surge';
	canvas.dataset.fluidTransitionProgress = '0.0000';
	canvas.dataset.fluidTransitionInjectedCount = '0';
	canvas.dataset.fluidTransitionInjectionCount = String(injectionCount);
	canvas.dataset.fluidTransitionSinkX = sinkPoint.x.toFixed(4);
	canvas.dataset.fluidTransitionSinkY = sinkPoint.y.toFixed(4);
	invokeTransitionCallback(state.onPhaseChange, 'surge');
	return {
		duration,
		injectionCount,
		updateSinkPoint(sinkPoint) {
			if (fluidTransition !== state) return;
			updateTransitionSinkPoint(state, sinkPoint);
		},
		cancel() {
			if (fluidTransition !== state) return;
			fluidTransition = null;
			canvas.dataset.fluidTransitionState = 'idle';
			canvas.dataset.fluidTransitionPhase = 'idle';
			canvas.dataset.fluidTransitionProgress = '0.0000';
			canvas.dataset.fluidTransitionInjectedCount = '0';
		}
	};
};

document.addEventListener(visibilityChangeEvent, () => {
	if (document.hidden) {
		if (animationID) cancelAnimationFrame(animationID)
		animationID = null
		if (!stopped) canvas.dataset.fluidRenderState = 'paused'
		return
	}

	if (!stopped && initBackground.loaded && animationID === null) {
		lastUpdateTime = Date.now()
		canvas.dataset.fluidRenderState = 'running'
		animationID = requestAnimationFrame(update)
	}
})

function update(first) {
	if (stopped || document.hidden) {
		animationID = null
		return
	}
	sampleRuntimeQuality(performance.now());
	const dt = calcDeltaTime();
	if (resizeCanvas())
		initFramebuffers();
	const activeTransition = updateFluidTransition(performance.now());
	updateColors(dt);
	applyInputs();
	if (!config.PAUSED)
		step(dt, activeTransition);
	render(null);
	if (activeTransition && activeTransition.progress >= 1)
		finishFluidTransition(activeTransition);
	if (!stopped) animationID = requestAnimationFrame(update);
}

function calcDeltaTime() {
	let now = Date.now();
	let dt = (now - lastUpdateTime) / 1000;
	dt = Math.min(dt, 0.016666);
	lastUpdateTime = now;
	return dt;
}

function resizeCanvas() {
	let width = scaleByPixelRatio(canvas.clientWidth);
	let height = scaleByPixelRatio(canvas.clientHeight);
	if (canvas.width != width || canvas.height != height) {
		canvas.width = width;
		canvas.height = height;
		return true;
	}
	return false;
}

function updateColors(dt) {
	if (!config.COLORFUL) return;

	colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
	if (colorUpdateTimer >= 1) {
		colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
		pointers.forEach(p => {
			p.color = generateColor();
		});
	}
}

function applyInputs() {
	if (splatStack.length > 0)
		multipleSplats(splatStack.pop());

	pointers.forEach(p => {
		if (p.moved) {
			p.moved = false;
			splatPointer(p);
		}
	});
}

function step(dt, activeTransition) {
	gl.disable(gl.BLEND);
	gl.viewport(0, 0, velocity.width, velocity.height);

	curlProgram.bind();
	gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
	blit(curl.fbo);

	vorticityProgram.bind();
	gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
	gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
	gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
	gl.uniform1f(vorticityProgram.uniforms.dt, dt);
	blit(velocity.write.fbo);
	velocity.swap();

	divergenceProgram.bind();
	gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
	blit(divergence.fbo);

	clearProgram.bind();
	gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
	gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
	blit(pressure.write.fbo);
	pressure.swap();

	pressureProgram.bind();
	gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
	for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
		gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
		blit(pressure.write.fbo);
		pressure.swap();
	}

	gradienSubtractProgram.bind();
	gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
	gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
	blit(velocity.write.fbo);
	velocity.swap();

	if (activeTransition) {
		transitionVelocityProgram.bind();
		gl.uniform1i(transitionVelocityProgram.uniforms.uVelocity, velocity.read.attach(0));
		gl.uniform1f(transitionVelocityProgram.uniforms.aspectRatio, canvas.width / Math.max(1, canvas.height));
		gl.uniform1f(transitionVelocityProgram.uniforms.progress, activeTransition.progress);
		gl.uniform1f(transitionVelocityProgram.uniforms.dt, dt);
		gl.uniform2f(
			transitionVelocityProgram.uniforms.transitionCenter,
			activeTransition.sinkPoint.x,
			activeTransition.sinkPoint.y
		);
		blit(velocity.write.fbo);
		velocity.swap();
	}

	advectionProgram.bind();
	gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	if (!ext.supportLinearFiltering)
		gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
	let velocityId = velocity.read.attach(0);
	gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
	gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
	gl.uniform1f(advectionProgram.uniforms.dt, dt);
	gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
	blit(velocity.write.fbo);
	velocity.swap();

	gl.viewport(0, 0, dye.width, dye.height);

	if (!ext.supportLinearFiltering)
		gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
	gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
	gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
	gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
	blit(dye.write.fbo);
	dye.swap();
}

function render(target) {
	if (config.BLOOM)
		applyBloom(dye.read, bloom);
	if (config.SUNRAYS) {
		applySunrays(dye.read, dye.write, sunrays);
		blur(sunrays, sunraysTemp, 1);
	}

	if (target == null && fluidTransition) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.disable(gl.BLEND);
	}
	else if (target == null || !config.TRANSPARENT) {
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.BLEND);
	}
	else {
		gl.disable(gl.BLEND);
	}

	let width = target == null ? gl.drawingBufferWidth : target.width;
	let height = target == null ? gl.drawingBufferHeight : target.height;
	gl.viewport(0, 0, width, height);

	let fbo = target == null ? null : target.fbo;
	if (!config.TRANSPARENT && !fluidTransition)
		drawColor(fbo, normalizeColor(config.BACK_COLOR));
	if (target == null && config.TRANSPARENT && !fluidTransition)
		drawCheckerboard(fbo);
	drawDisplay(fbo, width, height);
}

function drawColor(fbo, color) {
	colorProgram.bind();
	gl.uniform4f(colorProgram.uniforms.color, color.r, color.g, color.b, 1);
	blit(fbo);
}

function drawCheckerboard(fbo) {
	checkerboardProgram.bind();
	gl.uniform1f(checkerboardProgram.uniforms.aspectRatio, canvas.width / canvas.height);
	blit(fbo);
}

function drawDisplay(fbo, width, height) {
	displayMaterial.bind();
	if (config.SHADING)
		gl.uniform2f(displayMaterial.uniforms.texelSize, 1.0 / width, 1.0 / height);
	gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
	if (config.BLOOM) {
		gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
		gl.uniform1i(displayMaterial.uniforms.uDithering, ditheringTexture.attach(2));
		let scale = getTextureScale(ditheringTexture, width, height);
		gl.uniform2f(displayMaterial.uniforms.ditherScale, scale.x, scale.y);
	}
	if (config.SUNRAYS)
		gl.uniform1i(displayMaterial.uniforms.uSunrays, sunrays.attach(3));
	const transitionBackground = normalizeColor(config.BACK_COLOR);
	gl.uniform1f(displayMaterial.uniforms.transitionActive, fluidTransition ? 1 : 0);
	gl.uniform1f(displayMaterial.uniforms.transitionProgress, fluidTransition ? fluidTransition.progress : 0);
	gl.uniform1f(displayMaterial.uniforms.transitionAspectRatio, canvas.width / Math.max(1, canvas.height));
	gl.uniform2f(
		displayMaterial.uniforms.transitionCenter,
		fluidTransition ? fluidTransition.sinkPoint.x : 0.5,
		fluidTransition ? fluidTransition.sinkPoint.y : 0.5
	);
	gl.uniform3f(
		displayMaterial.uniforms.transitionBackground,
		transitionBackground.r,
		transitionBackground.g,
		transitionBackground.b
	);
	blit(fbo);
}

function applyBloom(source, destination) {
	const framebufferCount = Math.min(
		bloomFramebuffers.length,
		Math.max(2, Math.round(Number(config.BLOOM_ITERATIONS) || bloomFramebuffers.length))
	);
	if (framebufferCount < 2)
		return;

	let last = destination;

	gl.disable(gl.BLEND);
	bloomPrefilterProgram.bind();
	let knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
	let curve0 = config.BLOOM_THRESHOLD - knee;
	let curve1 = knee * 2;
	let curve2 = 0.25 / knee;
	gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve0, curve1, curve2);
	gl.uniform1f(bloomPrefilterProgram.uniforms.threshold, config.BLOOM_THRESHOLD);
	gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
	gl.viewport(0, 0, last.width, last.height);
	blit(last.fbo);

	bloomBlurProgram.bind();
	for (let i = 0; i < framebufferCount; i++) {
		let dest = bloomFramebuffers[i];
		gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
		gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
		gl.viewport(0, 0, dest.width, dest.height);
		blit(dest.fbo);
		last = dest;
	}

	gl.blendFunc(gl.ONE, gl.ONE);
	gl.enable(gl.BLEND);

	for (let i = framebufferCount - 2; i >= 0; i--) {
		let baseTex = bloomFramebuffers[i];
		gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
		gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
		gl.viewport(0, 0, baseTex.width, baseTex.height);
		blit(baseTex.fbo);
		last = baseTex;
	}

	gl.disable(gl.BLEND);
	bloomFinalProgram.bind();
	gl.uniform2f(bloomFinalProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
	gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
	gl.uniform1f(bloomFinalProgram.uniforms.intensity, config.BLOOM_INTENSITY);
	gl.viewport(0, 0, destination.width, destination.height);
	blit(destination.fbo);
}

function applySunrays(source, mask, destination) {
	gl.disable(gl.BLEND);
	sunraysMaskProgram.bind();
	gl.uniform1i(sunraysMaskProgram.uniforms.uTexture, source.attach(0));
	gl.viewport(0, 0, mask.width, mask.height);
	blit(mask.fbo);

	sunraysProgram.bind();
	gl.uniform1f(sunraysProgram.uniforms.weight, config.SUNRAYS_WEIGHT);
	gl.uniform1i(sunraysProgram.uniforms.uTexture, mask.attach(0));
	gl.viewport(0, 0, destination.width, destination.height);
	blit(destination.fbo);
}

function blur(target, temp, iterations) {
	blurProgram.bind();
	for (let i = 0; i < iterations; i++) {
		gl.uniform2f(blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
		gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
		blit(temp.fbo);

		gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
		gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
		blit(target.fbo);
	}
}

function splatPointer(pointer) {
	let dx = pointer.deltaX * config.SPLAT_FORCE;
	let dy = pointer.deltaY * config.SPLAT_FORCE;
	splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
}

function multipleSplats(amount) {
	for (let i = 0; i < amount; i++) {
		const color = generateColor();
		color.r *= 10.0;
		color.g *= 10.0;
		color.b *= 10.0;
		const x = Math.random();
		const y = Math.random();
		const dx = 1000 * (Math.random() - 0.5);
		const dy = 1000 * (Math.random() - 0.5);
		splat(x, y, dx, dy, color);
	}
}

function splat(x, y, dx, dy, color) {
	gl.viewport(0, 0, velocity.width, velocity.height);
	splatProgram.bind();
	gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
	gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
	gl.uniform2f(splatProgram.uniforms.point, x, y);
	gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
	gl.uniform1f(splatProgram.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100.0));
	blit(velocity.write.fbo);
	velocity.swap();

	gl.viewport(0, 0, dye.width, dye.height);
	gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
	gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
	blit(dye.write.fbo);
	dye.swap();
}

function correctRadius(radius) {
	let aspectRatio = canvas.width / canvas.height;
	if (aspectRatio > 1)
		radius *= aspectRatio;
	return radius;
}

window.addEventListener('touchend', e => {
	const touches = e.changedTouches;
	for (let i = 0; i < touches.length; i++) {
		let pointer = pointers.find(p => p.id == touches[i].identifier);
		if (pointer == null) continue;
		updatePointerUpData(pointer);
	}
});

window.addEventListener('keydown', e => {
	if (e.code === 'KeyP')
		config.PAUSED = !config.PAUSED;
	if (e.key === ' ')
		splatStack.push(parseInt(Math.random() * 20) + 5);
});

function updatePointerDownData(pointer, id, posX, posY) {
	pointer.id = id;
	pointer.down = true;
	pointer.moved = false;
	pointer.texcoordX = posX / canvas.width;
	pointer.texcoordY = 1.0 - posY / canvas.height;
	pointer.prevTexcoordX = pointer.texcoordX;
	pointer.prevTexcoordY = pointer.texcoordY;
	pointer.deltaX = 0;
	pointer.deltaY = 0;
	pointer.color = generateColor();
}

function updatePointerMoveData(pointer, posX, posY) {
	pointer.prevTexcoordX = pointer.texcoordX;
	pointer.prevTexcoordY = pointer.texcoordY;
	pointer.texcoordX = posX / canvas.width;
	pointer.texcoordY = 1.0 - posY / canvas.height;
	pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
	pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
	pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
}

function updatePointerUpData(pointer) {
	pointer.down = false;
}

function correctDeltaX(delta) {
	let aspectRatio = canvas.width / canvas.height;
	if (aspectRatio < 1) delta *= aspectRatio;
	return delta;
}

function correctDeltaY(delta) {
	let aspectRatio = canvas.width / canvas.height;
	if (aspectRatio > 1) delta /= aspectRatio;
	return delta;
}

function generateColor() {
	let c = HSVtoRGB(Math.random(), 1.0, 1.0);
	c.r *= 0.15;
	c.g *= 0.15;
	c.b *= 0.15;
	return c;
}

function HSVtoRGB(h, s, v) {
	let r, g, b, i, f, p, q, t;
	i = Math.floor(h * 6);
	f = h * 6 - i;
	p = v * (1 - s);
	q = v * (1 - f * s);
	t = v * (1 - (1 - f) * s);

	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}

	return {
		r,
		g,
		b
	};
}

function normalizeColor(input) {
	let output = {
		r: input.r / 255,
		g: input.g / 255,
		b: input.b / 255
	};
	return output;
}

function wrap(value, min, max) {
	let range = max - min;
	if (range == 0) return min;
	return (value - min) % range + min;
}

function getResolution(resolution) {
	let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
	if (aspectRatio < 1)
		aspectRatio = 1.0 / aspectRatio;

	let min = Math.round(resolution);
	let max = Math.round(resolution * aspectRatio);

	if (gl.drawingBufferWidth > gl.drawingBufferHeight)
		return { width: max, height: min };
	else
		return { width: min, height: max };
}

function getTextureScale(texture, width, height) {
	return {
		x: width / texture.width,
		y: height / texture.height
	};
}

function scaleByPixelRatio(input) {
	let pixelRatio = Math.min(window.devicePixelRatio || 1, config.PIXEL_RATIO_CAP || 1.5);
	return Math.floor(input * pixelRatio);
}

function hashCode(s) {
	if (s.length == 0) return 0;
	let hash = 0;
	for (let i = 0; i < s.length; i++) {
		hash = (hash << 5) - hash + s.charCodeAt(i);
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
};

document.addEventListener("mousedown", e => {
	if (switchPage && switchPage.switched) {
		return
	}
	let posX = scaleByPixelRatio(e.pageX);
	let posY = scaleByPixelRatio(e.pageY);
	let pointer = pointers.find(p => p.id == -1);
	if (pointer == null) pointer = new pointerPrototype();
	updatePointerDownData(pointer, -1, posX, posY);
});

document.addEventListener("mousemove", e => {
	if (switchPage && switchPage.switched) {
		return
	}
	let pointer = pointers[0];
	if (!pointer.down) return;
	let posX = scaleByPixelRatio(e.pageX);
	let posY = scaleByPixelRatio(e.pageY);
	updatePointerMoveData(pointer, posX, posY);
});

document.addEventListener("mouseup", () => {
	if (switchPage && switchPage.switched) {
		return
	}
	updatePointerUpData(pointers[0]);
});

document.addEventListener("touchstart", e => {
	if (switchPage && switchPage.switched) {
		return
	}
	e.preventDefault();
	const touches = e.targetTouches;
	while (touches.length >= pointers.length)
		pointers.push(new pointerPrototype());
	for (let i = 0; i < touches.length; i++) {
		let posX = scaleByPixelRatio(touches[i].pageX);
		let posY = scaleByPixelRatio(touches[i].pageY);
		updatePointerDownData(pointers[i + 1], touches[i].identifier, posX, posY);
	}
});

document.addEventListener(
	"touchmove",
	e => {
		if (switchPage && switchPage.switched) {
			return
		}
		e.preventDefault();
		const touches = e.targetTouches;
		for (let i = 0; i < touches.length; i++) {
			let pointer = pointers[i + 1];
			if (!pointer.down) continue;
			let posX = scaleByPixelRatio(touches[i].pageX);
			let posY = scaleByPixelRatio(touches[i].pageY);
			updatePointerMoveData(pointer, posX, posY);
		}
	},
	false
);

document.addEventListener("touchend", e => {
	if (switchPage && switchPage.switched) {
		return
	}
	const touches = e.changedTouches;
	for (let i = 0; i < touches.length; i++) {
		let pointer = pointers.find(p => p.id == touches[i].identifier);
		if (pointer == null) continue;
		updatePointerUpData(pointer);
	}
});
